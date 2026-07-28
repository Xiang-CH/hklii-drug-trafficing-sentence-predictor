# Current system data schema

## Sources of truth

The extraction-side schemas are Pydantic models in
`featureExtraction/schema/`. The verification application redefines the
editable payload using Zod schemas in `featureVerification/src/lib/schema/`.
The model-analysis notebook reads the verified version of the payload.

The extraction runner stores one document per source judgment in
`llm-extracted-features` with this envelope:

```text
{
  source_judgement_id,
  trial, appeal, corrigendum,
  judgement, defendants, trials,
  model, judgement_type, trace_id
}
```

The verifier persists the reviewed equivalent in `verified-features` and adds
workflow metadata such as `is_verified`, `exclude`, `verified_by`, timestamps,
and source identifiers. The exact workflow envelope is not the sentencing
schema; the nested `judgement`, `defendants`, and `trials` objects are.

Every extraction detail has a `source` quotation. In verification, editable
factor and sentence-detail fields also carry `inferred: boolean`; false means
the value was explicitly extracted or verified, while true marks a derived
value.

## Judgement payload

`judgement` is case-level metadata plus `charges`.

| Field | Shape | Notes |
| --- | --- | --- |
| `neutral_citation` | string | Citation such as `[2024] HKCFI 123`; used as the model split group. |
| `court` | computed string | Derived from the citation. |
| `judge_name` | string/null | Presiding judge. |
| `judgment_date_time` | datetime/null | Judgment date and time. |
| `representatives` | array | Each representative has name, role, and source. |
| `cases_heard` | array of strings | Case references. |
| `charges` | array of `Charge` | Offence-level records. |

Each `Charge` contains the charge name, offence date/time, place of offence,
cross-border detail, and a `defendants_of_charge` array. A charge-for-defendant
record contains defendant name, trafficking mode(s), reasons for the offence,
benefits received, role facts, and source evidence. Cross-border detail has an
`import` or `export` type; the trial-level factor list separately records the
judge-addressed aggravating factor used by the analysis.

The full nested shape is:

```text
Judgement
├── neutral_citation: string
├── court: computed string
├── judge_name: string
├── judgment_date_time: datetime
├── representatives: Representative[]
│   └── { name: string, role: string, source: string }
├── cases_heard: string[]
└── charges: Charge[]
    ├── charge_no: integer | null
    ├── charge_name: ChargeName enum
    ├── offence_date: DateDetail | null
    │   └── { date: date | date[], day_of_week*, is_hk_public_holiday*, source }
    ├── offence_time: TimeDetail | null
    │   └── { time: time | null, time_of_day*, source }
    ├── place_of_offence: PlaceOfOffence | null
    │   └── { address, nature, sub_district*, district*, source }
    ├── cross_border: { cross_border: boolean, type: import | export | null, source }
    └── defendants_of_charge: ChargeForDefendant[]
        ├── defendant_name: string
        ├── defendant_id: integer | null
        ├── trafficking_mode: { mode, other_mode, source }[] | null
        ├── roles_facts: { role, other_role, source }[] | null
        ├── reasons_for_offence: { reason, other_reason, source }[] | null
        └── benefits_received: { received, amount, amount_currency,
                                 amount_type, amount_type_other,
                                 non_monetary_benefits, source } | null
```

`*` denotes a computed field. The extraction models reject unspecified extra
fields. A value represented by an optional nested object is `null` when the
judgment does not mention it.

## Defendant payload

`defendants.defendants` is an array of defendant profiles. A profile is linked
to trial records by defendant ID/name and may contain the following sourced
detail objects:

| Area | Fields |
| --- | --- |
| Identity and demographics | defendant name, nationality/HK-resident status, age at offence, age at sentencing, gender, marital status |
| Family and household | parental status, household composition, family support |
| Health and treatment | health conditions/status, drug-treatment participation |
| Socioeconomic context | education level, occupation, monthly wage, government subsidy recipient |
| History and conduct | criminal records, positive habits after arrest |

Many detail values are nullable when not mentioned. Some values use an enum,
some permit a range, and most include a source quotation. These fields are not
inputs to the first stage-model notebook unless explicitly added in a later
experiment.

```text
Defendants
└── defendants: DefendantProfile[]
    ├── defendant_id: integer
    ├── defendant_name: { name, source }
    ├── nationality: { category, hk_resident_status, foreign_country_code,
    │                  infer_reason, source } | null
    ├── age_at_offence: { age: integer | integer[], source } | null
    ├── age_at_sentencing: { age: integer | integer[], source } | null
    ├── gender: { gender, source } | null
    ├── marital_status: { status, source } | null
    ├── parental_status: { status, custody, source } | null
    ├── household_composition: { composition, source } | null
    ├── health_conditions: { type, name, source }[] | null
    ├── drug_treatment_participation: { participated, source } | null
    ├── education_level: { level, source } | null
    ├── occupation: { occupation_category, occupation_name, source } | null
    ├── monthly_wage: { wage: integer | integer[], wage_currency, source } | null
    ├── government_subsidy_recipient: { scheme_type, other_scheme, source } | null
    ├── criminal_records: { record, source }[] | null
    ├── positive_habits_after_arrest: { habit, source }[] | null
    └── family_supports: { support, source }[] | null
```

## Trial payload

`trials.trials` is the sentence-modelling unit. Each element is one charge and
defendant pairing.

| Field | Shape | Modelling use |
| --- | --- | --- |
| `charge_type` | charge number, charge name, defendant name, defendant ID, source | Stable trial identity. |
| `drugs` | non-empty array of `{ drug_type, other_drug_type, quantity, source }` | Starting-point input; quantity is grams. |
| `aggravating_factors` | array/null of factor details | Role and aggravation inputs. |
| `sentencing_role` | nullable role profile | Model-specific primary role and supplementary circumstances. |
| `mitigating_factors` | array/null of factor details | Mitigation inputs. |
| `guilty_plea` | plea detail | Plea-reduction input. |
| `starting_point` | sentence detail, nullable in verifier | Starting-point target. |
| `sentence_after_role` | sentence detail/null | Role-stage target. |
| `notional_sentence` | sentence detail | Aggravation-stage target. |
| `mitigation_reduction` | `{ reduction_months, source, inferred }`/null | Aggregate non-plea mitigation signal. |
| `final_sentence` | sentence detail | Final target. |

The exact nesting is:

```text
Trials
└── trials: Trial[]
    ├── charge_type: { charge_no, charge_name, defendant_name, defendant_id, source }
    ├── drugs: DrugDetail[]
    │   └── { drug_type, other_drug_type, quantity: float grams, source }
    ├── aggravating_factors: AggravatingFactorDetail[] | null
    ├── sentencing_role: SentencingRoleDetail | null
    ├── mitigating_factors: MitigatingFactorDetail[] | null
    ├── guilty_plea: GuiltyPleaDetail
    ├── starting_point: SentenceDetail | null in the verifier
    ├── sentence_after_role: SentenceDetail | null
    ├── notional_sentence: SentenceDetail
    ├── mitigation_reduction: { reduction_months, source, inferred } | null
    └── final_sentence: SentenceDetail
```

Sentence details hold `sentence_years`, `sentence_months`, `source`, and in the
verification schema `inferred`. Their computed value is:

```text
total_months = sentence_years * 12 + sentence_months
```

The current `DrugType` enum is:

```text
Cannabis; THC/CBD; Cathinones; Cocaine; Cough medicine; Ecstasy; GHB/GBL;
Heroin; Ketamine; Fluorodeschloroketamine; Nimetazepam; Morphine;
Methamphetamine; Salvia; TFMPP; Etomidate; Other
```

When `drug_type` is `Other`, `other_drug_type` is required. Drug quantity is
stored as a numeric gram value. The analysis notebook preserves raw values but
flags negative, non-numeric, missing, or non-finite quantities and replaces
them with zero only in its model feature matrix.

## Factor details

An aggravating-factor detail is:

```text
{
  factor, other_factor, enhancement_months, source, inferred
}
```

`other_factor` is required when `factor` is `Other`. `enhancement_months` is
nullable: null means the factor was recognised without an individually stated
enhancement. The current aggravating enum is:

```text
Refugee/Asylum; Illegal immigrant; On bail; Suspended sentence;
CSD supervision; Wanted; Persistent offender; Import; Export; Use of minors;
Multiple drugs; Role of the defendant; Other
```

A mitigating-factor detail is:

```text
{
  factor, other_factor, reduction_months, reduction_percentage, source, inferred
}
```

`reduction_months` and `reduction_percentage` are nullable. The current
mitigating enum is:

```text
Voluntary surrender; Self-consumption; Assistance - limited;
Assistance - useful; Assistance - testify; Assistance - risk; Extreme youth;
Young offender; Medical conditions; Family illness; Prosecutorial delay;
Mistaken belief; Rehabilitation programme; Charity; Other
```

## Sentencing role profile

`sentencing_role` is separate from factual `roles_facts`. It records one
model-selection role for the charge/defendant pair and optional supplementary
circumstances:

```text
{
  primary_role: Courier / Storekeeper | Actual trafficker |
                Manager / Organiser | Operator / Financial controller,
  additional_circumstances: [Cross-border trafficking | Divan keeping |
                              Manufacturing],
  source,
  inferred
}
```

The primary role is a scalar, so multiple primary roles cannot be selected for
the same trial. Supplementary circumstances are unique and may be selected
together.
`Role of the defendant` remains in the raw aggravating-factor vocabulary for
legacy compatibility, but it is not fitted or applied as a generic model
factor. Only `sentencing_role` can adjust the role stage.

## Guilty plea and sentence flow

`guilty_plea` has `pleaded_guilty`, court type, High Court or District Court
plea stage, optional stage-other text, `reduction_years`, `reduction_months`,
`reduction_percentage`, source, and inferred state. Its computed direct
reduction is:

```text
total_reduction_months = reduction_years * 12 + reduction_months
```

Court type is `High Court` or `District Court`. High Court stages are `Unknown`,
`Up to committal`, `After committal`, `After dates fixed`, `First day`,
`During trial`, and `Other`; District Court stages are `Unknown`, `Plea day`,
`After dates fixed`, `First day`, `During trial`, and `Other`.

The intended sentence sequence is:

```text
starting_point
  -> sentence_after_role
  -> notional_sentence
  -> minus mitigation_reduction (excluding guilty plea)
  -> minus guilty_plea.total_reduction_months
  -> final_sentence
```

Validation requires notional sentence to be no less than sentence after role.
It also rejects a final sentence greater than notional sentence less non-plea
mitigation. When a guilty-plea reduction is explicitly present, the final
sentence must exactly equal that remaining amount less the plea reduction.

On the extraction side, if `sentence_after_role` is absent it is created by
copying `starting_point` and given the source text `Inferred as starting point
since role adjustment not provided`. The verifier permits a nullable
`starting_point` as long as `sentence_after_role` exists, and exposes explicit
`inferred` flags. The notebook excludes inferred direct adjustments from factor
effect estimation.

## Notebook modelling projection

| Model stage | Required fields | Target or direct effect |
| --- | --- | --- |
| Starting point | `drugs`, explicit `starting_point.total_months` | starting-point months |
| Role | `starting_point`, `sentence_after_role`, `sentencing_role`, and direct `enhancement_months` | enhancement / starting point |
| Aggravation | `sentence_after_role`, aggravating factors and direct `enhancement_months` | enhancement / after-role sentence |
| Mitigation | `notional_sentence`, mitigating factors and direct `reduction_months` | reduction / notional sentence |
| Guilty plea | `notional_sentence`, `mitigation_reduction`, direct plea reduction | reduction / sentence after non-plea mitigation |
| Final evaluation | all predicted stages plus explicit `final_sentence` | final-month error |

The notebook treats Import and Export as one model-only `Cross-border
trafficking` feature and Refugee/Asylum as model-only `Refugee claimant`.
It leaves the stored schemas and data unchanged.

The role-aware interpolation model additionally reads the maintained role
workbook. Its `Exclusion = 1` entries are removed from every model-development
and held-out-evaluation stage. Other workbook rows supply role labels and
direct role effects without changing historical verified records.

Verified MongoDB judgments with a document-level `exclude` flag are retained
for role and circumstance fitting and for reconciliation so workbook
exclusions can be applied at charge level. They are not used for drug curves,
generic factor effects, non-role predictions, or held-out non-role metrics.
An unambiguous citation, charge, and defendant match may repair a trial-index
mismatch with a warning; unresolved exclusions also warn rather than stop the
analysis and are recorded in the deployment artifact.
