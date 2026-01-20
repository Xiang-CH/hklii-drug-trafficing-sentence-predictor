# Schema Directory

This directory contains Pydantic schema definitions for extracting structured features from drug trafficking court case documents.

## Directory Structure

```
schema/
├── caseBasics.py            # Schema for case-level information (CaseBasics)
├── defendants.py            # Schema for defendant background information (DefendantProfile, Defendants)
├── trials.py                # Schema for trial and sentencing information (Trial, Trials)
├── features.txt             # Reference document listing all features
├── jsonSchema/              # Auto-generated JSON Schema files
│   ├── caseBasics.json
│   ├── defendants.json
│   └── trials.json
└── exampleOutput/           # Example extraction outputs (organized by judgment type)
    ├── single-d-single-dt/
    │   ├── caseBasics.json
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
| **CaseBasics** | caseBasics.py | Case-level information about the offence | Date, time, place, nature of place, trafficking mode |
| **Defendants** | defendants.py | Defendant background and personal information | Demographics, education, occupation, criminal record, family support |
| **Trial** | trials.py | Trial and sentencing factors and outcomes | Drugs, role, aggravating/mitigating factors, guilty plea, sentence progression |

---

## Feature Coverage by Schema

**Note**: For features with "Not Mentioned" values, the corresponding schema fields will be `null`.

### Table 1: [CaseBasics Schema](caseBasics.py)

| Feature # | Feature Name | Schema Field | Notes |
|-----------|--------------|--------------|-------|
| 1 | Date of offence | `date` | `DateDetail` with date and source; null if not mentioned |
| 1a-d | Date derivations | `date`(inferred) | Day of week, weekend/weekday, public holiday derived from `date.date` |
| 2 | Time of offence | `time` | `TimeDetail` with time and source; null if not mentioned |
| 2a-c | Time derivations | (inferred) | Time category (morning/afternoon/evening/night) derived from `time.time` |
| 3 | Place of offence | `placeOfOffence` | `PlaceOfOffence` with address, district, source |
| 4 | Nature of place of offence | `natureOfPlaceOfOffence` | `NatureOfPlaceOfOffence` with nature enum and source |
| 5 | Mode of drug trafficking | `traffickingMode` | `TraffickingMode` with mode enum and source |
| 8 | Reasons for committing offence | `reason_for_offence` | `ReasonForOffenceDetail` with list of reasons |
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
| - | Charge type | `charge_type` | `ChargeDetail` with charge type enum |
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

## Generating JSON Schema Files

Each schema file can generate its corresponding JSON Schema:

```bash
cd featureExtraction/schema
python caseBasics.py
python defendants.py
python trials.py
```

This outputs JSON Schema files to the `jsonSchema/` directory.

