import defaultArtifact from './data_derived_linear_model.json'

const roleFactor = 'Role of the defendant'
const courierStorekeeperRole = 'Courier / Storekeeper'
const severePrimaryRoles = [
  'Actual trafficker',
  'Manager / Organiser',
  'Operator / Financial controller',
] as const
const primaryRoles = [courierStorekeeperRole, ...severePrimaryRoles] as const
const supplementaryCircumstances = [
  'Cross-border trafficking',
  'Divan keeping',
  'Manufacturing',
] as const

type AdjustmentStrategy = 'learned' | 'legacy_percentages'
type EffectStage = 'aggravation' | 'mitigation' | 'plea' | 'role'
type FactorStage = Exclude<EffectStage, 'role'>
type PrimaryRole = (typeof primaryRoles)[number]
type SupplementaryCircumstance = (typeof supplementaryCircumstances)[number]
type FactorEffects = Partial<
  Record<EffectStage, Partial<Record<string, number>>>
>

export type DataDerivedLinearModelArtifact = {
  canonical_factor_map: Partial<Record<string, string>>
  drug_curves: Partial<Record<string, ReadonlyArray<ReadonlyArray<number>>>>
  factor_effects: FactorEffects
  legacy_percentage_effects: FactorEffects
  role_effects: {
    primary_effects: Partial<Record<PrimaryRole, number>>
    circumstance_effects: Partial<
      Record<
        Exclude<SupplementaryCircumstance, 'Cross-border trafficking'>,
        number
      >
    >
    severe_cross_border_effect: number | null
  }
}

export type PredictionRequest = {
  drugAmounts: Readonly<Record<string, number>>
  aggravatingFactors?: ReadonlyArray<string>
  mitigatingFactors?: ReadonlyArray<string>
  pleadedGuilty?: boolean
  guiltyPleaStage?: string | null
  primaryRole?: PrimaryRole | null
  additionalCircumstances?: ReadonlyArray<SupplementaryCircumstance>
}

type StageMonths = {
  startingPointMonths: number
  roleEnhancementMonths: number
  sentenceAfterRoleMonths: number
  aggravationMonths: number
  notionalSentenceMonths: number
  mitigationReductionMonths: number
  prePleaMonths: number
  pleaReductionMonths: number
  finalSentenceMonths: number
}

export type FactorContribution = {
  stage: EffectStage
  factor: string
  direction: 'increase' | 'reduction'
  status: 'supported' | 'unsupported'
  effectPercentage: number
  months: number
}

export type SupportedPrediction = {
  status: 'supported'
  adjustmentStrategy: AdjustmentStrategy
  unsupportedDrugs: []
  drugAmounts: Record<string, number>
  factors: {
    role: string
    aggravation: string
    mitigation: string
    plea: string
  }
  factorContributions: Array<FactorContribution>
  reportedMonths: Record<keyof StageMonths, number>
} & StageMonths

export type UnsupportedPrediction = {
  status: 'no positive drug quantity' | 'unsupported drug curve'
  unsupportedDrugs: Array<string>
  startingPointMonths: null
  finalSentenceMonths: null
  reportedMonths: Record<string, never>
}

export type Prediction = SupportedPrediction | UnsupportedPrediction

export const dataDerivedLinearModel: DataDerivedLinearModelArtifact =
  defaultArtifact

export class DataDerivedLinearPredictor {
  private readonly drugCurves: Partial<
    Record<string, ReadonlyArray<ReadonlyArray<number>>>
  >
  private readonly factorEffects: FactorEffects

  constructor(
    private readonly model: DataDerivedLinearModelArtifact = dataDerivedLinearModel,
    private readonly adjustmentStrategy: AdjustmentStrategy = 'learned',
  ) {
    this.drugCurves = model.drug_curves
    this.factorEffects =
      adjustmentStrategy === 'learned'
        ? model.factor_effects
        : model.legacy_percentage_effects
  }

  interpolateCurve(drugType: string, quantityGrams: number): number | null {
    const knots = this.drugCurves[drugType]
    if (!knots) {
      return null
    }
    if (!Number.isFinite(quantityGrams) || quantityGrams < 0) {
      throw new Error('Drug quantity must be a finite, non-negative number')
    }
    if (quantityGrams <= knots[0][0]) {
      return knots[0][1]
    }
    if (quantityGrams >= knots[knots.length - 1][0]) {
      return knots[knots.length - 1][1]
    }
    const rightIndex = knots.findIndex(([quantity]) => quantity > quantityGrams)
    const [leftQuantity, leftMonths] = knots[rightIndex - 1]
    const [rightQuantity, rightMonths] = knots[rightIndex]
    return (
      leftMonths +
      ((rightMonths - leftMonths) * (quantityGrams - leftQuantity)) /
        (rightQuantity - leftQuantity)
    )
  }

  getStartingPoint(
    drugAmounts: Readonly<Record<string, number>>,
  ): number | null {
    const amounts = this.normaliseDrugAmounts(drugAmounts)
    if (!Object.keys(amounts).length) {
      return null
    }
    if (Object.keys(amounts).some((drug) => !this.drugCurves[drug])) {
      return null
    }
    const total = Object.values(amounts).reduce(
      (sum, amount) => sum + amount,
      0,
    )
    return (
      Object.entries(amounts).reduce((weightedMonths, [drug, amount]) => {
        const interpolatedMonths = this.interpolateCurve(drug, total)
        if (interpolatedMonths === null) {
          throw new Error(`Missing supported curve for ${drug}`)
        }
        return weightedMonths + interpolatedMonths * amount
      }, 0) / total
    )
  }

  predict(request: PredictionRequest): Prediction {
    const amounts = this.normaliseDrugAmounts(request.drugAmounts)
    if (!Object.keys(amounts).length) {
      return this.unsupportedPrediction('no positive drug quantity', [])
    }
    const unsupportedDrugs = Object.keys(amounts)
      .filter((drug) => !this.drugCurves[drug])
      .sort()
    if (unsupportedDrugs.length) {
      return this.unsupportedPrediction(
        'unsupported drug curve',
        unsupportedDrugs,
      )
    }

    const startingPoint = this.getStartingPoint(amounts)
    if (startingPoint === null) {
      return this.unsupportedPrediction('unsupported drug curve', [])
    }
    const canonicalAggravating = this.canonicalFactors(
      request.aggravatingFactors,
    )
    const canonicalMitigating = this.canonicalFactors(request.mitigatingFactors)
    let aggravatingFactors = canonicalAggravating.filter(
      (factor) => factor !== roleFactor,
    )
    const profileSelected =
      request.primaryRole != null ||
      Boolean(request.additionalCircumstances?.length)
    let roleEnhancement = 0
    let roleStatus = 'no sentencing role profile'
    let roleContributions: Array<FactorContribution> = []
    if (profileSelected) {
      const primaryRole = this.normalisePrimaryRole(request.primaryRole)
      const circumstances = this.normaliseCircumstances(
        request.additionalCircumstances ?? [],
      )
      const roleEffect = this.roleProfileEffect(
        primaryRole,
        circumstances,
        startingPoint,
      )
      roleEnhancement = roleEffect.months
      roleStatus = roleEffect.status
      roleContributions = roleEffect.contributions
      if (roleEffect.courierCrossBorder) {
        aggravatingFactors = unique([
          ...aggravatingFactors,
          'Cross-border trafficking',
        ])
      } else if (
        isSeverePrimaryRole(primaryRole) &&
        circumstances.includes('Cross-border trafficking')
      ) {
        aggravatingFactors = aggravatingFactors.filter(
          (factor) => factor !== 'Cross-border trafficking',
        )
      }
    }
    const sentenceAfterRole = Math.max(0, startingPoint + roleEnhancement)
    const aggravationContributions = this.factorContributions(
      aggravatingFactors,
      'aggravation',
      startingPoint,
      'increase',
    )
    const aggravation = sumContributionMonths(aggravationContributions)
    const notionalSentence = Math.max(0, sentenceAfterRole + aggravation)
    const mitigationContributions = this.factorContributions(
      canonicalMitigating,
      'mitigation',
      notionalSentence,
      'reduction',
    )
    const mitigation = Math.min(
      notionalSentence,
      Math.max(0, sumContributionMonths(mitigationContributions)),
    )
    const prePlea = Math.max(0, notionalSentence - mitigation)
    const pleaFactors = request.pleadedGuilty
      ? [`Guilty plea: ${request.guiltyPleaStage ?? 'Unknown'}`]
      : []
    const pleaContributions = this.factorContributions(
      pleaFactors,
      'plea',
      prePlea,
      'reduction',
    )
    const pleaReduction = Math.min(
      prePlea,
      Math.max(0, sumContributionMonths(pleaContributions)),
    )
    const finalSentence = Math.max(0, prePlea - pleaReduction)
    const stages: StageMonths = {
      startingPointMonths: startingPoint,
      roleEnhancementMonths: roleEnhancement,
      sentenceAfterRoleMonths: sentenceAfterRole,
      aggravationMonths: aggravation,
      notionalSentenceMonths: notionalSentence,
      mitigationReductionMonths: mitigation,
      prePleaMonths: prePlea,
      pleaReductionMonths: pleaReduction,
      finalSentenceMonths: finalSentence,
    }
    return {
      status: 'supported',
      adjustmentStrategy: this.adjustmentStrategy,
      unsupportedDrugs: [],
      drugAmounts: amounts,
      factors: {
        role: roleStatus,
        aggravation: this.factorStatus(aggravatingFactors, 'aggravation'),
        mitigation: this.factorStatus(canonicalMitigating, 'mitigation'),
        plea: this.factorStatus(pleaFactors, 'plea'),
      },
      factorContributions: [
        ...roleContributions,
        ...aggravationContributions,
        ...mitigationContributions,
        ...pleaContributions,
      ],
      ...stages,
      reportedMonths: Object.fromEntries(
        Object.entries(stages).map(([name, value]) => [
          name,
          roundToNearestEven(value),
        ]),
      ) as Record<keyof StageMonths, number>,
    }
  }

  private normaliseDrugAmounts(
    drugAmounts: Readonly<Record<string, number>>,
  ): Record<string, number> {
    const amounts: Record<string, number> = {}
    for (const [drug, amount] of Object.entries(drugAmounts)) {
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`${drug} amount must be a finite, non-negative number`)
      }
      if (amount > 0) {
        amounts[drug] = (amounts[drug] ?? 0) + amount
      }
    }
    return amounts
  }

  private canonicalFactors(factors: ReadonlyArray<string> = []): Array<string> {
    return unique(
      factors
        .filter(Boolean)
        .map((factor) => this.model.canonical_factor_map[factor] ?? factor),
    )
  }

  private normalisePrimaryRole(
    primaryRole: PrimaryRole | null | undefined,
  ): PrimaryRole {
    if (!primaryRole || !primaryRoles.includes(primaryRole)) {
      throw new Error(`primaryRole must be one of ${primaryRoles.join(', ')}`)
    }
    return primaryRole
  }

  private normaliseCircumstances(
    circumstances: ReadonlyArray<SupplementaryCircumstance>,
  ): Array<SupplementaryCircumstance> {
    if (new Set(circumstances).size !== circumstances.length) {
      throw new Error('additionalCircumstances must not contain duplicates')
    }
    if (
      circumstances.some(
        (circumstance) => !supplementaryCircumstances.includes(circumstance),
      )
    ) {
      throw new Error(
        `additionalCircumstances must contain only ${supplementaryCircumstances.join(', ')}`,
      )
    }
    return [...circumstances]
  }

  private roleProfileEffect(
    primaryRole: PrimaryRole,
    circumstances: ReadonlyArray<SupplementaryCircumstance>,
    startingPoint: number,
  ): {
    months: number
    status: string
    courierCrossBorder: boolean
    contributions: Array<FactorContribution>
  } {
    const primaryEffect = this.model.role_effects.primary_effects[primaryRole]
    if (primaryEffect === undefined) {
      return {
        months: 0,
        status: `unsupported primary role: ${primaryRole}`,
        courierCrossBorder: false,
        contributions: [
          {
            stage: 'role',
            factor: primaryRole,
            direction: 'increase',
            status: 'unsupported',
            effectPercentage: 0,
            months: 0,
          },
        ],
      }
    }
    let effect = primaryEffect
    const statuses = ['primary role supported']
    const contributions: Array<FactorContribution> = [
      {
        stage: 'role',
        factor: primaryRole,
        direction: 'increase',
        status: 'supported',
        effectPercentage: primaryEffect * 100,
        months: startingPoint * primaryEffect,
      },
    ]
    for (const circumstance of circumstances) {
      if (circumstance === 'Cross-border trafficking') {
        if (primaryRole === courierStorekeeperRole) {
          statuses.push('cross-border uses Import/Export effect')
          continue
        }
        const crossBorderEffect =
          this.model.role_effects.severe_cross_border_effect
        if (crossBorderEffect === null) {
          statuses.push('unsupported severe-role cross-border effect')
          contributions.push({
            stage: 'role',
            factor: circumstance,
            direction: 'increase',
            status: 'unsupported',
            effectPercentage: 0,
            months: 0,
          })
        } else {
          effect += crossBorderEffect
          statuses.push('severe-role cross-border supported')
          contributions.push({
            stage: 'role',
            factor: circumstance,
            direction: 'increase',
            status: 'supported',
            effectPercentage: crossBorderEffect * 100,
            months: startingPoint * crossBorderEffect,
          })
        }
        continue
      }
      const circumstanceEffect =
        this.model.role_effects.circumstance_effects[circumstance]
      if (circumstanceEffect === undefined) {
        statuses.push(`unsupported circumstance: ${circumstance}`)
        contributions.push({
          stage: 'role',
          factor: circumstance,
          direction: 'increase',
          status: 'unsupported',
          effectPercentage: 0,
          months: 0,
        })
      } else {
        effect += circumstanceEffect
        statuses.push(`${circumstance} supported`)
        contributions.push({
          stage: 'role',
          factor: circumstance,
          direction: 'increase',
          status: 'supported',
          effectPercentage: circumstanceEffect * 100,
          months: startingPoint * circumstanceEffect,
        })
      }
    }
    return {
      months: startingPoint * effect,
      status: statuses.join(' | '),
      courierCrossBorder:
        primaryRole === courierStorekeeperRole &&
        circumstances.includes('Cross-border trafficking'),
      contributions,
    }
  }

  private factorContributions(
    factors: ReadonlyArray<string>,
    stage: FactorStage,
    baseMonths: number,
    direction: FactorContribution['direction'],
  ): Array<FactorContribution> {
    const effects = this.factorEffects[stage] ?? {}
    return factors.map((factor) => {
      const effect = effects[factor]
      return {
        stage,
        factor,
        direction,
        status: effect === undefined ? 'unsupported' : 'supported',
        effectPercentage: (effect ?? 0) * 100,
        months: baseMonths * (effect ?? 0),
      }
    })
  }

  private factorStatus(
    factors: ReadonlyArray<string>,
    stage: EffectStage,
  ): string {
    if (!factors.length) {
      return 'no factors'
    }
    const effects = this.factorEffects[stage] ?? {}
    const unsupported = factors.filter(
      (factor) => effects[factor] === undefined,
    )
    return unsupported.length
      ? `unsupported factors: ${unsupported.join(' | ')}`
      : 'supported'
  }

  private unsupportedPrediction(
    status: UnsupportedPrediction['status'],
    unsupportedDrugs: Array<string>,
  ): UnsupportedPrediction {
    return {
      status,
      unsupportedDrugs,
      startingPointMonths: null,
      finalSentenceMonths: null,
      reportedMonths: {},
    }
  }
}

function unique(values: ReadonlyArray<string>): Array<string> {
  return [...new Set(values)]
}

function sumContributionMonths(
  contributions: ReadonlyArray<FactorContribution>,
): number {
  return contributions.reduce(
    (total, contribution) => total + contribution.months,
    0,
  )
}

function isSeverePrimaryRole(
  role: PrimaryRole,
): role is (typeof severePrimaryRoles)[number] {
  return severePrimaryRoles.includes(
    role as (typeof severePrimaryRoles)[number],
  )
}

function roundToNearestEven(value: number): number {
  const lower = Math.floor(value)
  const fraction = value - lower
  if (fraction < 0.5) {
    return lower
  }
  if (fraction > 0.5) {
    return lower + 1
  }
  return lower % 2 === 0 ? lower : lower + 1
}
