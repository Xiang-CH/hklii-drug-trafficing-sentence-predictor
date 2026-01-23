# Schema Directory

This directory contains Pydantic schema definitions for extracting structured features from drug trafficking court case documents.

## Directory Structure

```
schema/
├── common.py                # Shared utilities (source_field helper)
├── judgement.py             # Schema for case and charge-level information (Judgement, Charge)
├── defendants.py            # Schema for defendant background information (DefendantProfile, Defendants)
├── trials.py                # Schema for trial and sentencing information (Trial, Trials)
├── features.txt             # Reference document listing all features
├── jsonSchema/              # Auto-generated JSON Schema files
│   ├── judgement.json
│   ├── defendants.json
│   └── trials.json
└── exampleOutput/           # Example extraction outputs (organized by judgment type)
    ├── single-d-single-dt/
    │   ├── judgement.json
    │   ├── defendants.json
    │   └── trials.json
    ├── single-d-multi-dt/
    ├── single-d-dt+ndt/
    ├── multi-d-single-dt/
    ├── multi-d-multi-dt/
    ├── multi-d-multi-dt+ndt/
    ├── appeal/
    └── corrigendum/
```

## Schema Overview

| Schema | File | Purpose | Key Fields |
|--------|------|---------|------------|
| **Judgement** | judgement.py | Case-level metadata and charges | Neutral citation, judge, judgment date, representatives, charges |
| **Charge** | judgement.py | Charge-level information about the offence | Date, time, place, cross-border, trafficking mode, reasons, benefits |
| **Defendants** | defendants.py | Defendant background and personal information | Demographics, education, occupation, criminal record, family support |
| **Trial** | trials.py | Trial and sentencing factors and outcomes | Drugs, role, aggravating/mitigating factors, guilty plea, sentence progression |

---

## Feature Coverage by Schema

**Note**: For features with "Not Mentioned" values, the corresponding schema fields will be `null`.

### Table 1: [Judgement Schema](judgement.py)

The `Judgement` schema captures case-level metadata and contains a list of `Charge` objects.

#### Judgement-Level Fields

| Field | Type | Notes |
|-------|------|-------|
| `neutral_citation` | `str` | Format: `[year] court number` (e.g., `[2024] HKCFI 123`) |
| `court` | computed | Automatically derived from neutral citation |
| `judge_name` | `str` | Name of the presiding judge |
| `judgment_date_time` | `datetime` | Date and time of the judgment |
| `representatives` | `List[Representative]` | Legal representatives with name and role |
| `cases_heard` | `List[str]` | Format: `case_type case_no/year` (e.g., `CC 1/2024`) |
| `charges` | `List[Charge]` | List of charges in the case |

#### Charge-Level Fields (per charge)

| Feature # | Feature Name | Schema Field | Notes |
|-----------|--------------|--------------|-------|
| — | Charge name | `charge_name` | `ChargeName` enum (trafficking/conspiracy variants) |
| 1 | Date of offence | `offence_date` | `DateDetail` with date and source; null if not mentioned |
| 1a-d | Date derivations | `offence_date` (computed) | Day of week, public holiday derived from `date` |
| 2 | Time of offence | `offence_time` | `TimeDetail` with time and source; null if not mentioned |
| 2a-c | Time derivations | `offence_time` (computed) | Time of day (morning/afternoon/evening/night) derived from `time` |
| 3 | Place of offence | `place_of_offence` | `PlaceOfOffence` with address, sub-district, nature |
| 4 | Nature of place of offence | `place_of_offence.nature` | `NatureOfPlace` enum |
| — | Cross-border | `cross_border` | `CrossBorderDetail` with import/export type |
| — | Defendants of charge | `defendants_of_charge` | List of `ChargeForDefendant` per defendant |

#### ChargeForDefendant Fields (per defendant per charge)

| Feature # | Feature Name | Schema Field | Notes |
|-----------|--------------|--------------|-------|
| — | Defendant name | `defendant_name` | Full name as appearing in the judgment |
| 5 | Mode of drug trafficking | `trafficking_mode` | `TraffickingMode` with mode enum and source |
| 8 | Reasons for committing offence | `reasons_for_offence` | List of `ReasonForOffenceDetail` |
| 9 | Benefits received for trafficking | `benefits_received` | `BenefitsReceivedDetail` with amount in HKD |

### Table 2: [DefendantProfile Schema](defendants.py)

| Feature # | Feature Name | Schema Field | Notes |
|-----------|--------------|--------------|-------|
| 10a | Nationality | `nationality` | `Nationality` with category, HK resident status, or foreign country code |
| 10b | Age at offence | `age_at_offence` | `AgeAtOffence` with int or range (list) |
| 10c | Age at sentencing | `age_at_sentencing` | `AgeAtSentencing` with int or range (list) |
| 10d | Gender | `gender` | `GenderDetail` with enum |
| 10e | Marital status | `marital_status` | `MaritalStatusDetail` with enum |
| 10f | Parental status | `parental_status` | `ParentalStatus` with status and custody |
| 10g | Household composition | `household_composition` | `HouseholdCompositionDetail` with enum |
| 10h | Health status | `health_status` | `HealthStatus` with drug addiction, mental, physical health |
| 10i | Drug treatment participation | `drug_treatment_participation` | `DrugTreatmentDetail` with boolean |
| 10j | Education level | `education_level` | `EducationLevelDetail` with enum |
| 10k | Occupation | `occupation` | `Occupation` with occupation category enum |
| 10l | Monthly wage | `monthly_wage` | `MonthlyWageDetail` with wage in HKD |
| 10m | Criminal record | `criminal_record` | `CriminalRecordDetail` with enum |
| 10n | Positive habits after arrest | `positive_habits_after_arrest` | `PositiveHabitDetail` with list of habits |
| 11 | Family support | `family_support` | `FamilySupportDetail` with list of support types |
| — | Defendant name | `defendant_name` | `DefendantNameDetail` (additional field) |

### Table 3: [Trial Schema](trials.py)

| Feature # | Feature Name | Schema Field | Notes |
|-----------|--------------|--------------|-------|
| — | Charge type | `charge_type` | `ChargeDetail` with charge type enum |
| 6 | Types and quantities of drugs | `drugs` | List of `DrugDetail` with drug type, quantity, source |
| 7 | Role of defendant | `role` | `RoleDetail` with role enum |
| 12 | Aggravating factors | `aggravating_factors` | List of `AggravatingFactorDetail` |
| 13 | Enhancement for aggravating factors | `aggravating_factors[].enhancement` | Months added (null if acknowledged but no enhancement) |
| 14 | Guilty plea | `guilty_plea` | `GuiltyPleaDetail` with court type and plea stage |
| 15 | Mitigating factors | `mitigating_factors` | List of `MitigatingFactorDetail` (excluding guilty plea) |
| 16 | Reduction for mitigating factors | `mitigating_factors[].reduction` | Months reduced (null if acknowledged but no reduction) |
| 17 | Starting point of sentence | `starting_point` | `StartingPointDetail` with months |
| 18 | Sentence after role adjustment | `sentence_after_role` | `SentenceAfterRoleDetail` with months |
| 19 | Notional sentence | `notional_sentence` | `NotionalSentenceDetail` with months |
| 21 | Reduction for mitigating factors | `mitigation_reduction` | `MitigationReductionDetail` with total reduction |
| 22 | Final sentence | `final_sentence` | `FinalSentenceDetail` with months and guilty plea reduction |

---

## Enumerations Reference

### Judgement Schema Enums

| Enum | Values |
|------|--------|
| `ChargeName` | Trafficking in a dangerous drug, Trafficking in dangerous drugs, Conspiracy to traffic in a dangerous drug, Conspiracy to traffic in dangerous drugs |
| `NatureOfPlace` | Residential building, Commercial building, Industrial building, Government or public building, Entertainment venue, Street, Car park, Shopping mall, Public transport, Private vehicle, Restaurant, Educational institution, Hospital, Outside methadone clinic, Recreational area, Hotel or guesthouse, Construction site, Vacant or abandoned property, Border checkpoint, Other |
| `TraffickingModeEnum` | Street-level dealing, Social supply, Courier delivery, Parcel delivery, Drug houses, Vehicle-based dealing, Vehicle concealment, Mule trafficking, Drug repackaging or storage, Maritime transport, Festival or event dealing, Online trafficking, Other |
| `ReasonForOffence` | Financial gain, Economic hardship, Coercion, Deception, Addiction-driven, Peer influence, Helping other people, Other |

---

## Generating JSON Schema Files

Each schema file can generate its corresponding JSON Schema:

```bash
cd featureExtraction/schema
python judgement.py
python defendants.py
python trials.py
```

This outputs JSON Schema files to the `jsonSchema/` directory.

