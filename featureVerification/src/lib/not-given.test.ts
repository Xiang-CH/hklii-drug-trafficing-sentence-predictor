import { describe, expect, it } from 'vitest'
import {
  applyNotGivenToPayload,
  deriveNotGivenMapFromPayload,
} from './not-given'

describe('deriveNotGivenMapFromPayload', () => {
  it('marks mandatory fields with empty-like values as not-given', () => {
    const map = deriveNotGivenMapFromPayload({
      judgement: {
        charges: [
          {
            offence_date: null,
            place_of_offence: {},
            defendants_of_charge: [
              {
                trafficking_mode: {},
                roles_facts: [],
              },
            ],
            representatives: [],
          },
        ],
      },
      defendants: {
        defendants: [
          {
            criminal_records: [],
            age_at_offence: undefined,
            gender: { gender: 'Male', source: 'txt' },
          },
        ],
      },
      trials: {
        trials: [
          {
            final_sentence: {
              sentence_years: 5,
              sentence_months: 0,
              source: 'txt',
            },
          },
        ],
      },
    })

    expect(map['judgement.charges[0].offence_date']).toBe(true)
    expect(map['judgement.charges[0].place_of_offence']).toBe(true)
    expect(
      map['judgement.charges[0].defendants_of_charge[0].trafficking_mode'],
    ).toBe(true)
    expect(
      map['judgement.charges[0].defendants_of_charge[0].roles_facts'],
    ).toBe(true)
    expect(map['defendants.defendants[0].criminal_records']).toBe(true)
    expect(map['defendants.defendants[0].age_at_offence']).toBe(true)

    expect(map['judgement.charges[0].representatives']).toBeUndefined()
    expect(map['defendants.defendants[0].gender']).toBeUndefined()
    expect(map['trials.trials[0].final_sentence']).toBeUndefined()
  })

  it('builds correct paths for nested array items', () => {
    const map = deriveNotGivenMapFromPayload({
      judgement: {},
      defendants: {
        defendants: [{ criminal_records: [] }],
      },
      trials: {
        trials: [{ drugs: [{ quantity: 1 }] }, { drugs: [] }],
      },
    })

    expect(map['defendants.defendants[0].criminal_records']).toBe(true)
    expect(map['trials.trials[1].drugs']).toBeUndefined()
    expect(map['trials.trials[0].drugs']).toBeUndefined()
  })
})

describe('applyNotGivenToPayload', () => {
  it('keeps existing behavior for applying schema-derived defaults', () => {
    const payload = {
      judgement: {
        charges: [
          {
            offence_time: {
              time: '12:00:00',
              source: 'source',
            },
          },
        ],
      },
      defendants: {},
      trials: {},
    }

    const result = applyNotGivenToPayload(payload, {
      'judgement.charges[0].offence_time': true,
      'other.path': true,
    })

    expect(result.judgement.charges[0].offence_time).toBeNull()
  })
})
