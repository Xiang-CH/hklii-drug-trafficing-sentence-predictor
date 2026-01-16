# Schema Directory

This directory contains Pydantic schema definitions for extracting structured features from drug trafficking court case documents.

## Directory Structure

```
schema/
├── caseBasics.py            # Schema for case-level information
├── defendantProfile.py      # Schema for defendant background information
├── sentenceDetail.py        # Schema for sentencing-related information
├── features.txt             # Reference document listing all features
├── jsonSchema/              # Auto-generated JSON Schema files
│   ├── caseBasics.json
│   ├── defendantProfile.json
│   └── sentenceDetail.json
└── exampleOutput/           # Example extraction outputs
    ├── caseBasics.json
    ├── defendantProfile.json
    └── sentenceDetail.json
```

## Schema Overview

| Schema | Purpose | Key Fields |
|--------|---------|------------|
| **CaseBasics** | Case-level information about the offence | Date, time, place, nature of place, trafficking mode |
| **DefendantProfile** | Defendant background and personal information | Demographics, education, occupation, criminal record, family support |
| **SentenceDetail** | Sentencing factors and outcomes | Drugs, role, aggravating/mitigating factors, guilty plea, sentence progression |

---

## Feature Coverage by Schema

### Table 1: [CaseBasics Schema](caseBasics.py)

| Feature # | Feature Name | Schema Field | Notes |
|-----------|--------------|--------------|-------|
| 1 | Date of offence | `date` | `DateDetail` with date and source; null if not mentioned |
| 1a-d | Date derivations | (inferred) | Day of week, weekend/weekday, public holiday derived from `date.date` |
| 2 | Time of offence | `time` | `TimeDetail` with time and source; null if not mentioned |
| 2a-c | Time derivations | (inferred) | Time category (morning/afternoon/evening/night) derived from `time.time` |
| 3 | Place of offence | `placeOfOffence` | `PlaceOfOffence` with address, district, source |
| 4 | Nature of place of offence | `natureOfPlaceOfOffence` | `NatureOfPlaceOfOffence` with nature enum and source |
| 5 | Mode of drug trafficking | `traffickingMode` | `TraffickingMode` with mode enum and source |

### Table 2: [DefendantProfile Schema](defendantProfile.py)

| Feature # | Feature Name | Schema Field | Notes |
|-----------|--------------|--------------|-------|
| 8 | Reasons for committing offence | `reason_for_offence` | `ReasonForOffenceDetail` with list of reasons |
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

### Table 3: [SentenceDetail Schema](sentenceDetail.py)

| Feature # | Feature Name | Schema Field | Notes |
|-----------|--------------|--------------|-------|
| 6 | Types and quantities of drugs | `drugs` | List of `DrugDetail` with drug type, quantity, source |
| 7 | Role of defendant | `role` | `RoleDetail` with role enum |
| 9 | Benefits received for trafficking | `benefits_received` | `BenefitsReceivedDetail` with amount in HKD |
| 12 | Aggravating factors | `aggravating_factors` | List of `AggravatingFactorDetail` |
| 13 | Enhancement for aggravating factors | `aggravating_factors[].enhancement` | Months added (null if acknowledged but no enhancement) |
| 14 | Guilty plea | `guilty_plea` | `GuiltyPleaDetail` with court type and plea stage |
| 15 | Mitigating factors | `mitigating_factors` | List of `MitigatingFactorDetail` (excluding guilty plea) |
| 16 | Reduction for mitigating factors | `mitigating_factors[].reduction` | Months reduced (null if acknowledged but no reduction) |
| 17 | Starting point of sentence | `starting_point` | `StartingPointDetail` with months |
| 18 | Sentence after role adjustment | `sentence_after_role` | `SentenceAfterRoleDetail` with months |
| 19 | Notional sentence | `notional_sentence` | `NotionalSentenceDetail` with months |
| 20 | Enhancement per aggravating factor | `aggravating_factors[].enhancement` | (Same as Feature 13) |
| 21 | Reduction for mitigating factors | `mitigation_reduction` | `MitigationReductionDetail` with total reduction |
| 22 | Final sentence | `final_sentence` | `FinalSentenceDetail` with months and guilty plea reduction |

---

## Usage

Each schema can be used with OpenAI's structured output API for extraction:

```python
from schema import CaseBasics, DefendantProfile, SentenceDetail

schemas = [
    ("caseBasics", CaseBasics),
    ("defendantProfile", DefendantProfile),
    ("sentenceDetail", SentenceDetail),
]

# Use with OpenAI API for structured extraction
response = client.responses.parse(
    model="gpt-5-mini",
    instructions=f"Extract {schema_name} according to the provided schema.",
    input=case_text,
    text_format=schema_model
)
```

## Generating JSON Schema Files

Each schema file can generate its corresponding JSON Schema:

```bash
cd featureExtraction/schema
python caseBasics.py
python defendantProfile.py
python sentenceDetail.py
```

This outputs JSON Schema files to the `jsonSchema/` directory.

