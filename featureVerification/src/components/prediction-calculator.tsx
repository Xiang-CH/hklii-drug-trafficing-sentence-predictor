import { useState } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Scale,
  Trash2,
} from 'lucide-react'
import type {FactorContribution} from '@/lib/data-derived-linear-model';
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DataDerivedLinearPredictor,
  
  dataDerivedLinearModel
} from '@/lib/data-derived-linear-model'

const predictor = new DataDerivedLinearPredictor()
const supportedDrugTypes = Object.keys(
  dataDerivedLinearModel.drug_curves,
).toSorted()
const aggravatingFactorOptions = Object.keys(
  dataDerivedLinearModel.factor_effects.aggravation ?? {},
).toSorted()
const mitigatingFactorOptions = Object.keys(
  dataDerivedLinearModel.factor_effects.mitigation ?? {},
).toSorted()
const pleaStageOptions = Object.keys(
  dataDerivedLinearModel.factor_effects.plea ?? {},
)
  .map((factor) => factor.replace('Guilty plea: ', ''))
  .toSorted()
const primaryRoleOptions = [
  'Courier / Storekeeper',
  'Actual trafficker',
  'Manager / Organiser',
  'Operator / Financial controller',
] as const
const circumstanceOptions = [
  'Cross-border trafficking',
  'Divan keeping',
  'Manufacturing',
] as const

type DrugInput = {
  id: number
  drugType: string
  quantity: string
}

type FactorListProps = {
  title: string
  factors: ReadonlyArray<string>
  selectedFactors: ReadonlyArray<string>
  onToggle: (factor: string) => void
}

function FactorList({
  title,
  factors,
  selectedFactors,
  onToggle,
}: FactorListProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-foreground">
        {title}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {factors.map((factor) => {
          const checked = selectedFactors.includes(factor)
          return (
            <label
              key={factor}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/50"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => onToggle(factor)}
              />
              <span>{factor}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function StageRow({
  label,
  months,
  tone = 'neutral',
}: {
  label: string
  months: number
  tone?: 'increase' | 'neutral' | 'reduction'
}) {
  const prefix = tone === 'increase' ? '+' : tone === 'reduction' ? '−' : ''
  const className =
    tone === 'increase'
      ? 'text-amber-700 dark:text-amber-300'
      : tone === 'reduction'
        ? 'text-emerald-700 dark:text-emerald-300'
        : 'text-foreground'
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm font-semibold ${className}`}>
        {prefix}
        {formatMonths(months)}
      </span>
    </div>
  )
}

function ContributionRow({
  contribution,
}: {
  contribution: FactorContribution
}) {
  const reduction = contribution.direction === 'reduction'
  const prefix = reduction ? '−' : '+'
  const Icon = reduction ? ArrowDownRight : ArrowUpRight
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-3">
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          reduction
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
        }`}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{contribution.factor}</p>
          {contribution.status === 'unsupported' ? (
            <Badge variant="outline">Unsupported</Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {stageLabel(contribution.stage)} ·{' '}
          {formatPercentage(contribution.effectPercentage)}
        </p>
      </div>
      <span
        className={`font-mono text-sm font-semibold ${
          reduction
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-amber-700 dark:text-amber-300'
        }`}
      >
        {prefix}
        {formatMonths(contribution.months)}
      </span>
    </div>
  )
}

export default function PredictionCalculator() {
  const [drugInputs, setDrugInputs] = useState<Array<DrugInput>>([
    { id: 1, drugType: 'Cocaine', quantity: '10' },
  ])
  const [nextDrugId, setNextDrugId] = useState(2)
  const [aggravatingFactors, setAggravatingFactors] = useState<Array<string>>(
    [],
  )
  const [mitigatingFactors, setMitigatingFactors] = useState<Array<string>>([])
  const [primaryRole, setPrimaryRole] = useState<string>('none')
  const [circumstances, setCircumstances] = useState<Array<string>>([])
  const [pleadedGuilty, setPleadedGuilty] = useState(false)
  const [pleaStage, setPleaStage] = useState('Plea day')

  const drugAmounts = drugInputs.reduce<Record<string, number>>(
    (amounts, { drugType, quantity }) => {
      const parsedQuantity = Number(quantity)
      if (Number.isFinite(parsedQuantity) && parsedQuantity > 0) {
        amounts[drugType] = (amounts[drugType] ?? 0) + parsedQuantity
      }
      return amounts
    },
    {},
  )
  const prediction = predictor.predict({
    drugAmounts,
    aggravatingFactors,
    mitigatingFactors,
    pleadedGuilty,
    guiltyPleaStage: pleaStage,
    primaryRole:
      primaryRole === 'none'
        ? undefined
        : (primaryRole as (typeof primaryRoleOptions)[number]),
    additionalCircumstances: circumstances as Array<
      (typeof circumstanceOptions)[number]
    >,
  })

  function updateDrugInput(
    id: number,
    field: keyof Omit<DrugInput, 'id'>,
    value: string,
  ) {
    setDrugInputs((inputs) =>
      inputs.map((input) =>
        input.id === id ? { ...input, [field]: value } : input,
      ),
    )
  }

  function addDrugInput() {
    const selectedDrugs = new Set(drugInputs.map((input) => input.drugType))
    const nextDrug =
      supportedDrugTypes.find((drug) => !selectedDrugs.has(drug)) ??
      supportedDrugTypes[0]
    setDrugInputs((inputs) => [
      ...inputs,
      { id: nextDrugId, drugType: nextDrug, quantity: '' },
    ])
    setNextDrugId((id) => id + 1)
  }

  function removeDrugInput(id: number) {
    setDrugInputs((inputs) =>
      inputs.length === 1 ? inputs : inputs.filter((input) => input.id !== id),
    )
  }

  function changePrimaryRole(role: string) {
    setPrimaryRole(role)
    if (role === 'none') {
      setCircumstances([])
    }
  }

  function toggleValue(
    setter: React.Dispatch<React.SetStateAction<Array<string>>>,
    value: string,
  ) {
    setter((values) =>
      values.includes(value)
        ? values.filter((current) => current !== value)
        : [...values, value],
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Scale className="size-5" />
            <span className="text-sm font-semibold tracking-wide uppercase">
              Sentence calculator
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Explore a predicted sentence
          </h1>
          <p className="mt-2 text-muted-foreground">
            Adjust the verified sentencing inputs to see the model’s staged
            calculation and the month effect of each selected factor.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.9fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Case inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-medium">Drug quantities</h2>
                    <p className="text-xs text-muted-foreground">
                      Amounts are measured in grams.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={addDrugInput}>
                    <Plus />
                    Add drug
                  </Button>
                </div>
                <div className="space-y-2">
                  {drugInputs.map((input) => (
                    <div
                      key={input.id}
                      className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-center gap-2"
                    >
                      <Select
                        value={input.drugType}
                        onValueChange={(value) =>
                          updateDrugInput(input.id, 'drugType', value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {supportedDrugTypes.map((drug) => (
                            <SelectItem key={drug} value={drug}>
                              {drug}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        aria-label={`${input.drugType} quantity in grams`}
                        inputMode="decimal"
                        min="0"
                        placeholder="grams"
                        type="number"
                        value={input.quantity}
                        onChange={(event) =>
                          updateDrugInput(
                            input.id,
                            'quantity',
                            event.target.value,
                          )
                        }
                      />
                      <Button
                        aria-label={`Remove ${input.drugType}`}
                        disabled={drugInputs.length === 1}
                        onClick={() => removeDrugInput(input.id)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="primary-role">
                    Primary role
                  </label>
                  <Select value={primaryRole} onValueChange={changePrimaryRole}>
                    <SelectTrigger className="w-full" id="primary-role">
                      <SelectValue placeholder="No role profile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No role profile</SelectItem>
                      {primaryRoleOptions.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <fieldset
                  className={primaryRole === 'none' ? 'opacity-50' : undefined}
                  disabled={primaryRole === 'none'}
                >
                  <legend className="mb-2 text-sm font-medium">
                    Supplementary circumstances
                  </legend>
                  <div className="space-y-2">
                    {circumstanceOptions.map((circumstance) => (
                      <label
                        className="flex cursor-pointer items-center gap-2 text-sm"
                        key={circumstance}
                      >
                        <Checkbox
                          checked={circumstances.includes(circumstance)}
                          disabled={primaryRole === 'none'}
                          onCheckedChange={() =>
                            toggleValue(setCircumstances, circumstance)
                          }
                        />
                        {circumstance}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </section>

              <FactorList
                factors={aggravatingFactorOptions}
                onToggle={(factor) =>
                  toggleValue(setAggravatingFactors, factor)
                }
                selectedFactors={aggravatingFactors}
                title="Aggravating factors"
              />
              <FactorList
                factors={mitigatingFactorOptions}
                onToggle={(factor) => toggleValue(setMitigatingFactors, factor)}
                selectedFactors={mitigatingFactors}
                title="Mitigating factors"
              />

              <section className="rounded-lg border border-border bg-muted/30 p-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={pleadedGuilty}
                    onCheckedChange={(checked) =>
                      setPleadedGuilty(checked === true)
                    }
                  />
                  Guilty plea
                </label>
                {pleadedGuilty ? (
                  <div className="mt-3 max-w-xs">
                    <Select value={pleaStage} onValueChange={setPleaStage}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pleaStageOptions.map((stage) => (
                          <SelectItem key={stage} value={stage}>
                            {stage}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </section>
            </CardContent>
          </Card>

          <div className="space-y-6 lg:sticky lg:top-6">
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-primary text-primary-foreground">
                <p className="text-sm font-medium text-primary-foreground/80">
                  Predicted final sentence
                </p>
                {prediction.status === 'supported' ? (
                  <CardTitle className="text-4xl text-primary-foreground">
                    {formatMonths(prediction.finalSentenceMonths)}
                  </CardTitle>
                ) : (
                  <CardTitle className="text-xl text-primary-foreground">
                    Prediction unavailable
                  </CardTitle>
                )}
              </CardHeader>
              <CardContent className="pt-4">
                {prediction.status === 'supported' ? (
                  <div>
                    <StageRow
                      label="Starting point"
                      months={prediction.startingPointMonths}
                    />
                    <StageRow
                      label="Role adjustment"
                      months={prediction.roleEnhancementMonths}
                      tone="increase"
                    />
                    <StageRow
                      label="Sentence after role"
                      months={prediction.sentenceAfterRoleMonths}
                    />
                    <StageRow
                      label="Aggravation"
                      months={prediction.aggravationMonths}
                      tone="increase"
                    />
                    <StageRow
                      label="Notional sentence"
                      months={prediction.notionalSentenceMonths}
                    />
                    <StageRow
                      label="Mitigation"
                      months={prediction.mitigationReductionMonths}
                      tone="reduction"
                    />
                    <StageRow
                      label="Guilty plea reduction"
                      months={prediction.pleaReductionMonths}
                      tone="reduction"
                    />
                    <StageRow
                      label="Final sentence"
                      months={prediction.finalSentenceMonths}
                    />
                  </div>
                ) : (
                  <div className="flex gap-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <p>
                      {prediction.status === 'unsupported drug curve'
                        ? `No curve is available for ${prediction.unsupportedDrugs.join(', ')}.`
                        : 'Enter at least one positive drug quantity.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {prediction.status === 'supported' ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Selected factor effects
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {prediction.factorContributions.length ? (
                    <div className="space-y-2">
                      {prediction.factorContributions.map(
                        (contribution, index) => (
                          <ContributionRow
                            contribution={contribution}
                            key={`${contribution.stage}-${contribution.factor}-${index}`}
                          />
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select a role, circumstance, factor, or plea option to see
                      its individual month effect.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatMonths(months: number): string {
  return `${months.toFixed(1).replace(/\.0$/, '')} months`
}

function formatPercentage(percentage: number): string {
  return `${percentage.toFixed(2).replace(/\.00$/, '')}%`
}

function stageLabel(stage: FactorContribution['stage']): string {
  if (stage === 'role') {
    return 'Role'
  }
  if (stage === 'aggravation') {
    return 'Aggravation'
  }
  if (stage === 'mitigation') {
    return 'Mitigation'
  }
  return 'Guilty plea'
}
