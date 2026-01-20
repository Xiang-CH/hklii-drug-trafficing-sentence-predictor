from enum import Enum
from typing import Optional, List, Union
from pydantic import BaseModel, Field, ConfigDict, model_validator
from pydantic_extra_types.country import CountryAlpha2


class NationalityCategory(str, Enum):
    HK_RESIDENT = "Hong Kong resident"
    MAINLAND_CHINESE = "Mainland Chinese"
    FOREIGN = "Foreign nationality"


class HKResidentStatus(str, Enum):
    PERMANENT = "Permanent resident"
    NEW_ARRIVAL = "New arrival"
    NA = "N/A"


class Gender(str, Enum):
    MALE = "Male"
    FEMALE = "Female"


class MaritalStatus(str, Enum):
    SINGLE = "Single"
    MARRIED = "Married"
    SEPARATED_DIVORCED = "Separated/divorced"
    WIDOWED = "Widowed"
    COHABITING = "Cohabiting"


class ParentalStatusEnum(str, Enum):
    NO_CHILDREN = "No children"
    PARENT = "Parent"
    EXPECTING = "Expecting parent"


class CustodyStatus(str, Enum):
    WITH_CUSTODY = "Parent with custody"
    WITHOUT_CUSTODY = "Parent without custody"


class HouseholdComposition(str, Enum):
    ALONE = "Lives alone"
    WITH_FAMILY = "Lives with family"
    WITH_NON_FAMILY = "Lives with non-family"
    HOMELESS = "Homeless"


class EducationLevel(str, Enum):
    UNEDUCATED = "Uneducated"
    PRIMARY = "Primary"
    SECONDARY_LOWER = "Secondary - Lower"
    SECONDARY_UPPER = "Secondary - Upper"
    TERTIARY = "Tertiary"


class OccupationCategory(str, Enum):
    UNEMPLOYED = "Unemployed"
    MANAGER = "Manager"
    PROFESSIONAL = "Professional"
    ASSOCIATE_PROFESSIONAL = "Associate professional"
    CLERICAL = "Clerical support worker"
    SERVICE_SALES = "Service and sales worker"
    CRAFT = "Craft and related worker"
    PLANT_MACHINE = "Plant and machine operator and assembler"
    ELEMENTARY = "Elementary occupation"
    AGRICULTURAL = "Skilled agricultural and fishery worker"
    STUDENT = "Student"
    OTHER = "Other"


class CriminalRecord(str, Enum):
    NONE = "None"
    DRUG_TRAFFICKING = "Drug trafficking"
    OTHER_DRUG = "Dangerous drug offences"
    OTHER_OFFENCE = "Other offences"


class PositiveHabit(str, Enum):
    VOLUNTEERING = "Volunteering"
    STUDYING = "Studying"
    WORKING = "Working"
    NEGATIVE_DRUG_TESTS = "Negative drug tests"
    REHABILITATION = "Participation in rehabilitation/self-improvement"


class FamilySupport(str, Enum):
    NONE = "None"
    PRESENCE_IN_COURT = "Family presence in court"
    LETTERS_OF_SUPPORT = "Letters of support from family"
    OTHER = "Other"


class HealthStatusType(str, Enum):
    DRUG_ADDICTION = "Drug addiction"
    MENTAL_HEALTH = "Mental health"
    PHYSICAL_HEALTH = "Physical health"


class Nationality(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: NationalityCategory
    hk_resident_status: Optional[HKResidentStatus] = Field(
        default=None, description="Only applicable if category is Hong Kong resident"
    )
    foreign_country_code: Optional[CountryAlpha2] = Field(
        default=None,
        description="Specify country code in ISO 3166-1 alpha-2 format if nationality is Foreign nationality",
    )
    source: str = Field(
        description="The exact match source text from which the nationality was extracted"
    )

    @model_validator(mode="after")
    def validate_conditional_fields(self):
        if (
            self.category == NationalityCategory.HK_RESIDENT
            and self.hk_resident_status is None
        ):
            raise ValueError(
                "hk_resident_status is required when category is 'Hong Kong resident'"
            )
        if (
            self.category == NationalityCategory.FOREIGN
            and self.foreign_country_code is None
        ):
            raise ValueError(
                "foreign_country_code is required when category is 'Foreign nationality'"
            )
        return self


class AgeAtOffence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    age: Union[int, List[int]] = Field(
        description="Exact age or estimated range at time of offence by using a list with two integers"
    )
    source: str = Field(
        description="The exact match source text from which the age at offence was extracted"
    )


class AgeAtSentencing(BaseModel):
    model_config = ConfigDict(extra="forbid")

    age: Union[int, List[int]] = Field(
        description="Exact age or estimated range at sentencing by using a list with two integers"
    )
    source: str = Field(
        description="The exact match source text from which the age at sentencing was extracted"
    )


class ParentalStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ParentalStatusEnum
    custody: Optional[CustodyStatus] = Field(
        default=None,
        description="Only applicable if status is Parent. Parent with custody means: Has one or more children and primary or shared custody; Parent without custody means: Has one or more children but does not have custody (e.g., children live with another parent or guardian)",
    )
    source: str = Field(
        description="The exact match source text from which the parental status was extracted"
    )


class HealthStatusCondition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: HealthStatusType = Field(description="Type of health status")
    source: str = Field(
        description="The exact match source text from which this health status was extracted"
    )


class HealthStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    conditions: List[HealthStatusCondition] = Field(
        description="List of health status items found in the judgment"
    )


class Occupation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    occupation: OccupationCategory = Field(description="Occupation at time of offence.")

    source: str = Field(
        description="The exact match source text from which the occupation was extracted"
    )


class DefendantNameDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        description="Full name of the defendant as appearing in the judgment"
    )
    source: str = Field(
        description="The exact match source text from which the name was extracted"
    )


class GenderDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gender: Gender
    source: str = Field(
        description="The exact match source text from which the gender was extracted"
    )


class MaritalStatusDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: MaritalStatus
    source: str = Field(
        description="The exact match source text from which the marital status was extracted"
    )


class HouseholdCompositionDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    composition: HouseholdComposition
    source: str = Field(
        description="The exact match source text from which the household composition was extracted"
    )


class DrugTreatmentDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    participated: bool = Field(
        description="Whether the defendant participated in community or residential drug treatment"
    )
    source: str = Field(
        description="The exact match source text from which the drug treatment participation was extracted"
    )


class EducationLevelDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    level: EducationLevel = Field(
        description="Lower secondary: Including Secondary 1-3 or equivalent level; Upper secondary: Including Secondary 4-7 of old academic structure (1985-2011), Secondary 4-6 of new academic structure (2012 onwards) or equivalent level, Project Yi Jin/Yi Jin Diploma, Diploma of Applied Education and craft level"
    )
    source: str = Field(
        description="The exact match source text from which the education level was extracted"
    )


class MonthlyWageDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    wage: int = Field(description="Monthly wage at time of offence in HKD")
    source: str = Field(
        description="The exact match source text from which the monthly wage was extracted"
    )


class CriminalRecordDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record: CriminalRecord
    source: str = Field(
        description="The exact match source text from which the criminal record was extracted"
    )


class PositiveHabitDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    habits: List[PositiveHabit]
    source: str = Field(
        description="The exact match source text from which the positive habits were extracted"
    )


class FamilySupportDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    support: List[FamilySupport] = Field(description="Types of family support present")
    source: str = Field(
        description="The exact match source text from which the family support was extracted"
    )


class DefendantProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    defendant_name: DefendantNameDetail
    nationality: Optional[Nationality] = Field(default=None)
    age_at_offence: Optional[AgeAtOffence] = Field(default=None)
    age_at_sentencing: Optional[AgeAtSentencing] = Field(default=None)
    gender: Optional[GenderDetail] = Field(default=None)
    marital_status: Optional[MaritalStatusDetail] = Field(default=None)
    parental_status: Optional[ParentalStatus] = Field(default=None)
    household_composition: Optional[HouseholdCompositionDetail] = Field(default=None)
    health_status: Optional[HealthStatus] = Field(default=None)
    drug_treatment_participation: Optional[DrugTreatmentDetail] = Field(default=None)
    education_level: Optional[EducationLevelDetail] = Field(default=None)
    occupation: Optional[Occupation] = Field(default=None)
    monthly_wage: Optional[MonthlyWageDetail] = Field(default=None)
    criminal_record: Optional[CriminalRecordDetail] = Field(default=None)
    positive_habits_after_arrest: Optional[PositiveHabitDetail] = Field(default=None)
    family_support: Optional[FamilySupportDetail] = Field(default=None)


class Defendants(BaseModel):
    model_config = ConfigDict(extra="forbid")

    defendants: List[DefendantProfile] = Field(
        description="List of defendant profiles extracted from the judgment"
    )

    @model_validator(mode="after")
    def check_defendant_count(self) -> "Defendants":
        if len(self.defendants) == 0:
            raise ValueError("At least one defendant must be provided")
        return self


if __name__ == "__main__":
    import json
    import os

    schema = Defendants.model_json_schema()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with open("jsonSchema/defendants.json", "w") as f:
        json.dump(schema, f, indent=4)
