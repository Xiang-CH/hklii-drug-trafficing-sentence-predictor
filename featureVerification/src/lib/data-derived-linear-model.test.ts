import { describe, expect, it } from 'vitest'
import { DataDerivedLinearPredictor } from './data-derived-linear-model'
import type { DataDerivedLinearModelArtifact } from './data-derived-linear-model'

const model: DataDerivedLinearModelArtifact = {
  canonical_factor_map: {
    Import: 'Cross-border trafficking',
  },
  drug_curves: {
    Cocaine: [
      [0, 24],
      [10, 60],
    ],
  },
  factor_effects: {
    aggravation: {
      'Cross-border trafficking': 0.1,
      'On bail': 0.1,
    },
    mitigation: {
      'Self-consumption': 0.1,
    },
    plea: {
      'Guilty plea: Plea day': 1 / 3,
    },
  },
  legacy_percentage_effects: {
    aggravation: {
      'Cross-border trafficking': 0.1,
      'On bail': 0.1,
    },
    mitigation: {
      'Self-consumption': 0.1,
    },
    plea: {
      'Guilty plea: Plea day': 1 / 3,
    },
  },
  role_effects: {
    primary_effects: {
      'Courier / Storekeeper': 0,
      'Actual trafficker': 0.1,
      'Manager / Organiser': 0.2,
      'Operator / Financial controller': 0.3,
    },
    circumstance_effects: {
      'Divan keeping': 0.2,
      Manufacturing: 0.3,
    },
    severe_cross_border_effect: 0.4,
  },
}

describe('DataDerivedLinearPredictor', () => {
  it('uses the starting point as the aggravation base after a role adjustment', () => {
    const prediction = new DataDerivedLinearPredictor(model).predict({
      drugAmounts: { Cocaine: 10 },
      aggravatingFactors: ['On bail'],
      primaryRole: 'Actual trafficker',
    })

    expect(prediction.status).toBe('supported')
    if (prediction.status !== 'supported') {
      return
    }
    expect(prediction.startingPointMonths).toBe(60)
    expect(prediction.roleEnhancementMonths).toBe(6)
    expect(prediction.aggravationMonths).toBe(6)
    expect(prediction.notionalSentenceMonths).toBe(72)
    expect(prediction.factorContributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factor: 'Actual trafficker',
          months: 6,
        }),
        expect.objectContaining({ factor: 'On bail', months: 6 }),
      ]),
    )
  })

  it('uses the generic cross-border effect for courier profiles', () => {
    const prediction = new DataDerivedLinearPredictor(model).predict({
      drugAmounts: { Cocaine: 10 },
      primaryRole: 'Courier / Storekeeper',
      additionalCircumstances: ['Cross-border trafficking'],
    })

    expect(prediction.status).toBe('supported')
    if (prediction.status !== 'supported') {
      return
    }
    expect(prediction.roleEnhancementMonths).toBe(0)
    expect(prediction.aggravationMonths).toBe(6)
  })

  it('rejects duplicate supplementary circumstances and unsupported drug curves', () => {
    const predictor = new DataDerivedLinearPredictor(model)

    expect(() =>
      predictor.predict({
        drugAmounts: { Cocaine: 10 },
        primaryRole: 'Courier / Storekeeper',
        additionalCircumstances: ['Manufacturing', 'Manufacturing'],
      }),
    ).toThrow('must not contain duplicates')
    expect(predictor.predict({ drugAmounts: { Heroin: 1 } })).toMatchObject({
      status: 'unsupported drug curve',
      unsupportedDrugs: ['Heroin'],
    })
  })
})
