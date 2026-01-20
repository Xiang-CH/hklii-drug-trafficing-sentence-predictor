from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, model_validator


class DrugType(str, Enum):
    # https://www.police.gov.hk/ppp_en/04_crime_matters/drug/common_drug.html
    CANNABIS = "Cannabis"
    THC_CBD = "THC/CBD"
    CATHINONES = "Cathinones"
    COCAINE = "Cocaine"
    COUGH_MED = "Cough medicine"
    ECSTASY = "Ecstasy"
    GHB_GBL = "GHB/GBL"
    HEROIN = "Heroin"
    KETAMINE = "Ketamine"
    NIMETAZEPAM = "Nimetazepam"
    MORPHINE = "Morphine"
    METH = "Methamphetamine"
    SALVIA = "Salvia"
    TFMPP = "TFMPP"
    ETOMIDATE = "Etomidate"
    OTHER = "Other"


class DefendantRole(str, Enum):
    COURIER = "Courier"
    STOREKEEPER = "Storekeeper"
    LOOKOUT = "Lookout/scout"
    ACTUAL_TRAFFICKER = "Actual trafficker"
    MANAGER = "Manager/organizer"
    OPERATOR = "Operator/financial controller"
    INTERNATIONAL_OPERATOR = "International operator/financial controller"
    OTHER = "Other"


class AggravatingFactorType(str, Enum):
    REFUGEE_ASYLUM = "Refugee/Asylum"
    ILLEGAL_IMMIGRANT = "Illegal immigrant"
    ON_BAIL = "On bail"
    SUSPENDED_SENTENCE = "Suspended sentence"
    CSD_SUPERVISION = "CSD supervision"
    WANTED = "Wanted"
    PERSISTENT_OFFENDER = "Persistent offender"
    CROSS_BORDER_IMPORT = "Import"
    CROSS_BORDER_EXPORT = "Export"
    USE_OF_MINORS = "Use of minors"
    MULTIPLE_DRUG_TYPES = "Multiple drugs"
    ROLE_OF_THE_DEFENDANT = "Role of the defendant"
    OTHER = "Other"


class MitigatingFactorType(str, Enum):
    VOLUNTARY_SURRENDER = "Voluntary surrender"
    SELF_CONSUMPTION = "Self-consumption"
    ASSISTANCE_LIMITED = "Assistance - limited"
    ASSISTANCE_USEFUL = "Assistance - useful"
    ASSISTANCE_TESTIFY = "Assistance - testify"
    ASSISTANCE_RISK = "Assistance - risk"
    EXTREME_YOUTH = "Extreme youth"
    YOUNG_OFFENDER = "Young offender"
    MEDICAL_CONDITIONS = "Medical conditions"
    FAMILY_ILLNESS = "Family illness"
    PROSECUTORIAL_DELAY = "Prosecutorial delay"
    MISTAKEN_BELIEF = "Mistaken belief"
    REHABILITATION_PROGRAMME = "Rehabilitation programme"
    OTHER = "Other"


class CourtType(str, Enum):
    HIGH_COURT = "High Court"
    DISTRICT_COURT = "District Court"


class HighCourtPleaStage(str, Enum):
    STAGE_UNKNOWN = "Unknown"
    UP_TO_COMMITTAL = "Up to committal"
    AFTER_COMMITTAL = "After committal"
    AFTER_TRIAL_DATES_FIXED = "After dates fixed"
    FIRST_DAY_OF_TRIAL = "First day"
    DURING_TRIAL = "During trial"


class DistrictCourtPleaStage(str, Enum):
    STAGE_UNKNOWN = "Unknown"
    AT_PLEA_DAY = "Plea day"
    AFTER_TRIAL_DATES_FIXED = "After dates fixed"
    FIRST_DAY_OF_TRIAL = "First day"
    DURING_TRIAL = "During trial"


class DrugDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    drug_type: DrugType = Field(description="Type of dangerous drug")
    other_drug_type: str | None = Field(
        description="If the drug type is 'Other', provide the most drug type specified in the source text.",
        default=None,
    )
    quantity: int = Field(description="Quantity of the drug in grams")
    source: str = Field(
        description="The exact match source text from which the drug type and quantity were extracted"
    )

    @model_validator(mode="after")
    def validate_conditional_fields(self):
        if self.drug_type == DrugType.OTHER and self.other_drug_type is None:
            raise ValueError("other_drug_type is required when drug_type is 'Other'")
        return self


class RoleDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: DefendantRole = Field(
        description="Role of the defendant in the trafficking operation. "
        "Courier: Transporter of drugs; "
        "Storekeeper: Responsible for storage or warehousing; "
        "Lookout/scout: Person monitoring for law enforcement or rivals; "
        "Actual trafficker: Directly sells or distributes dangerous drugs to the public; "
        "Manager/organizer: Coordinator or planner of trafficking activities; "
        "Operator/financial controller: Making substantial gains from drug trafficking; "
        "International operator/financial controller: Organiser or controller of a large "
        "and lucrative commercial operation which transcends jurisdictional boundaries."
    )
    source: str = Field(
        description="The exact match source text from which the role was extracted"
    )


class AggravatingFactorDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    factor: AggravatingFactorType = Field(
        description="The aggravating factor explicitly addressed by the judge. "
        "Refugee/Asylum: Refugee or asylum seeker status; "
        "Illegal immigrant: Illegal immigrant status; "
        "On bail: Offending while on bail; "
        "Suspended sentence: Offending during suspended sentence or probation; "
        "CSD supervision: Offending while under Correctional Services Department supervision; "
        "Wanted: Offending while wanted; "
        "Persistent offender: Repeat/persistent offender; "
        "Import: Cross-border drug trafficking - import; "
        "Export: Cross-border drug trafficking - export; "
        "Use of minors: Using minors in trafficking; "
        "Multiple drugs: Dealing in more than one type of dangerous drugs; "
        "Role of the defendant: Aggravation due to the role of the defendant."
    )
    other_factor: Optional[str] = Field(
        default=None, description="The mitigating factor if the factor is 'Other'"
    )
    enhancement: Optional[int] = Field(
        default=None,
        description="The specific sentence enhancement in months due to this aggravating factor, "
        "or null if the judge acknowledged the factor but decided not to impose enhancement",
    )
    source: str = Field(
        description="The exact match source text from which the aggravating factor was extracted"
    )

    @model_validator(mode="after")
    def validate_conditional_fields(self):
        if self.factor == AggravatingFactorType.OTHER and self.other_factor is None:
            raise ValueError("other_factor is required when factor is 'Other'")
        return self


class GuiltyPleaDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pleaded_guilty: bool = Field(description="Whether the defendant pleaded guilty")
    court_type: Optional[CourtType] = Field(
        default=None, description="The court where the plea was entered"
    )
    high_court_stage: Optional[HighCourtPleaStage] = Field(
        default=None,
        description="Stage of guilty plea if in High Court. "
        "Unknown: Stage unknown; "
        "Up to committal: Up to committal in Magistrates' Courts; "
        "After committal: After committal and up to and until trial dates are fixed; "
        "After dates fixed: After trial dates are fixed but before the first date of trial; "
        "First day: First day of trial; "
        "During trial: During the trial.",
    )
    district_court_stage: Optional[DistrictCourtPleaStage] = Field(
        default=None,
        description="Stage of guilty plea if in District Court. "
        "Unknown: Stage unknown; "
        "Plea day: At plea day; "
        "After dates fixed: After trial dates are fixed but before the first date of trial; "
        "First day: First day of trial; "
        "During trial: During the trial.",
    )
    source: str = Field(
        description="The exact match source text from which the guilty plea information was extracted"
    )


class MitigatingFactorDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    factor: MitigatingFactorType = Field(
        description="The mitigating factor explicitly addressed by the judge (excluding guilty plea). "
        "Voluntary surrender: Defendant voluntarily surrendered to authorities; "
        "Self-consumption: Self-consumption of significant proportion of drugs; "
        "Assistance - limited: Of some limited help to authorities but unfruitful; "
        "Assistance - useful: Useful assistance leading to arrest/conviction of another accused; "
        "Assistance - testify: Testified in court successfully against another accused; "
        "Assistance - risk: Assisted authorities at considerable personal risk; "
        "Extreme youth: 15 years old or below; "
        "Young offender: 16-20 years old; "
        "Medical conditions: Defendant's medical conditions; "
        "Family illness: Family illness or tragedy; "
        "Prosecutorial delay: Delay in prosecution; "
        "Mistaken belief: Mistaken belief about drug type; "
        "Rehabilitation programme: Participation in anti-trafficking or rehabilitative programmes."
    )
    other_factor: Optional[str] = Field(
        default=None, description="The mitigating factor if the factor is 'Other'"
    )
    reduction: Optional[int] = Field(
        default=None,
        description="The specific sentence reduction in months due to this mitigating factor, "
        "or null if the judge acknowledged the factor but decided not to impose reduction",
    )
    source: str = Field(
        description="The exact match source text from which the mitigating factor was extracted"
    )

    @model_validator(mode="after")
    def validate_conditional_fields(self):
        if self.factor == MitigatingFactorType.OTHER and self.other_factor is None:
            raise ValueError("other_factor is required when factor is 'Other'")
        return self


class StartingPointDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sentence_months: int = Field(
        description="Starting point of sentence in months based on drug type and quantity"
    )
    source: str = Field(
        description="The exact match source text from which the starting point was extracted"
    )


class SentenceAfterRoleDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sentence_months: int = Field(
        description="The sentence in months after taking into account the role of the defendant"
    )
    source: str = Field(
        description="The exact match source text from which this sentence was extracted"
    )


class NotionalSentenceDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sentence_months: int = Field(
        description="Notional sentence in months (starting point plus any enhancement due to aggravating factors)"
    )
    source: str = Field(
        description="The exact match source text from which the notional sentence was extracted"
    )


class MitigationReductionDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reduction_months: int = Field(
        description="Total sentence reduction in months granted based on mitigating factors "
        "(excluding guilty plea reduction)"
    )
    source: str = Field(
        description="The exact match source text from which the mitigation reduction was extracted"
    )


class FinalSentenceDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sentence_months: int = Field(
        description="Final sentence in months for the charge, including any reduction from guilty plea"
    )
    guilty_plea_reduction_months: Optional[int] = Field(
        default=None,
        description="The reduction in months specifically due to the defendant's guilty plea",
    )
    source: str = Field(
        description="The exact match source text from which the final sentence was extracted"
    )


class ChargeType(str, Enum):
    Actual_Trafficking = "Actual Trafficking"
    Conspiracy_to_Traffic = "Conspiracy to Traffic"


class ChargeDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: ChargeType = Field(
        description="Type of charge:\n"
        "Actual Trafficking: Trafficking in a dangerous drug/dangerous drugs or \n"
        "Conspiracy to Traffic: Conspiracy to traffic in a dangerous drug/dangerous drugs \n"
        "**Ignore other types of charges**"
    )
    defendants: List[str] = Field(
        description="List of defendant names associated with this charge"
    )
    source: str = Field(
        description="The exact match source text from which the charge type was extracted"
    )


class Trial(BaseModel):
    model_config = ConfigDict(extra="forbid")

    charge_type: ChargeDetail
    drugs: List[DrugDetail] = Field(
        description="Types and quantities of drugs involved in the offence"
    )
    role: Optional[RoleDetail] = Field(default=None)
    aggravating_factors: Optional[List[AggravatingFactorDetail]] = Field(
        default=None,
        description="Aggravating factors explicitly addressed by the judge",
    )
    mitigating_factors: Optional[List[MitigatingFactorDetail]] = Field(
        default=None,
        description="Mitigating factors explicitly addressed by the judge (excluding guilty plea)",
    )
    guilty_plea: GuiltyPleaDetail
    starting_point: StartingPointDetail = Field(
        description="Starting point of sentence based on drug type and quantity"
    )
    sentence_after_role: Optional[SentenceAfterRoleDetail] = Field(
        default=None,
        description="The sentence taking into account the role of the defendant",
    )
    notional_sentence: NotionalSentenceDetail = Field(
        description="Notional sentence (starting point plus enhancement due to aggravating factors)"
    )
    mitigation_reduction: Optional[MitigationReductionDetail] = Field(
        default=None,
        description="Sentence reduction granted based on mitigating factors (excluding guilty plea)",
    )
    final_sentence: FinalSentenceDetail = Field(
        description="Final sentence for the charge including any guilty plea reduction"
    )

    @model_validator(mode="after")
    def check_sentence_flow(self) -> "Trial":
        if not self.sentence_after_role:
            self.sentence_after_role = SentenceAfterRoleDetail(
                sentence_months=self.starting_point.sentence_months,
                source="Inferred as starting point since role adjustment not provided",
            )

        if (
            self.notional_sentence.sentence_months
            < self.sentence_after_role.sentence_months
        ):
            raise ValueError(
                "Notional sentence cannot be less than sentence after role/starting point"
            )

        current_sentence = self.notional_sentence.sentence_months
        if self.mitigation_reduction:
            current_sentence -= self.mitigation_reduction.reduction_months

        if self.final_sentence.sentence_months > current_sentence:
            raise ValueError(
                "Final sentence cannot be greater than notional sentence minus mitigation reduction"
            )

        if (
            self.final_sentence.guilty_plea_reduction_months
            and self.final_sentence.sentence_months
            != current_sentence - self.final_sentence.guilty_plea_reduction_months
        ):
            raise ValueError(
                "Final sentence must be equal to notional sentence minus mitigation reduction minus guilty plea reduction"
            )
        return self


class Trials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    trials: List[Trial]


if __name__ == "__main__":
    import json
    import os

    schema = Trials.model_json_schema()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with open("jsonSchema/trials.json", "w") as f:
        json.dump(schema, f, indent=4)
