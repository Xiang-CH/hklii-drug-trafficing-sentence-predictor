from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, model_validator, computed_field
from schema.common import source_field


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
    quantity: float = Field(description="Quantity of the drug in grams")
    source: str = source_field("drug type and quantity")

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
    source: str = source_field("role")


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
    source: str = source_field("aggravating factor")

    @model_validator(mode="after")
    def validate_conditional_fields(self):
        if self.factor == AggravatingFactorType.OTHER and self.other_factor is None:
            raise ValueError("other_factor is required when factor is 'Other'")
        return self


class GuiltyPleaDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pleaded_guilty: bool = Field(description="Whether the defendant pleaded guilty")
    court_type: Optional[CourtType] = Field(
        description="The court where the plea was entered, Must have if pleaded_guilty is True",
        default=None,
    )
    high_court_stage: Optional[HighCourtPleaStage] = Field(
        default=None,
        description="Must have if court_type is High Court. "
        "Unknown: Stage unknown; "
        "Up to committal: Up to committal in Magistrates' Courts; "
        "After committal: After committal and up to and until trial dates are fixed; "
        "After dates fixed: After trial dates are fixed but before the first date of trial; "
        "First day: First day of trial; "
        "During trial: During the trial.",
    )
    district_court_stage: Optional[DistrictCourtPleaStage] = Field(
        default=None,
        description="Must have if court_type is District Court. "
        "Unknown: Stage unknown; "
        "Plea day: At plea day; "
        "After dates fixed: After trial dates are fixed but before the first date of trial; "
        "First day: First day of trial; "
        "During trial: During the trial.",
    )
    source: str = source_field("guilty plea information")

    @model_validator(mode="after")
    def validate_conditional_fields(self):
        if self.pleaded_guilty and self.court_type is None:
            raise ValueError("court_type is required when pleaded_guilty is True")
        if self.court_type == CourtType.HIGH_COURT and self.high_court_stage is None:
            raise ValueError(
                "high_court_stage is required when court_type is 'High Court'"
            )
        if (
            self.court_type == CourtType.DISTRICT_COURT
            and self.district_court_stage is None
        ):
            raise ValueError(
                "district_court_stage is required when court_type is 'District Court'"
            )
        return self


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
    source: str = source_field("mitigating factor")

    @model_validator(mode="after")
    def validate_conditional_fields(self):
        if self.factor == MitigatingFactorType.OTHER and self.other_factor is None:
            raise ValueError("other_factor is required when factor is 'Other'")
        return self


class StartingPointDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sentence_years: int = Field(
        description="Starting point of sentence - years component"
    )
    sentence_months: int = Field(
        description="Starting point of sentence - months component (0-11)"
    )
    source: str = source_field("starting point")

    @computed_field
    @property
    def total_months(self) -> int:
        return self.sentence_years * 12 + self.sentence_months


class SentenceAfterRoleDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sentence_years: int = Field(
        description="Sentence after role adjustment - years component"
    )
    sentence_months: int = Field(
        description="Sentence after role adjustment - months component (0-11)"
    )
    source: str = source_field("sentence after role")

    @computed_field
    @property
    def total_months(self) -> int:
        return self.sentence_years * 12 + self.sentence_months


class NotionalSentenceDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sentence_years: int = Field(description="Notional sentence - years component")
    sentence_months: int = Field(
        description="Notional sentence - months component (0-11)"
    )
    source: str = source_field("notional sentence")

    @computed_field
    @property
    def total_months(self) -> int:
        return self.sentence_years * 12 + self.sentence_months


class MitigationReductionDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reduction_months: int = Field(
        description="Total sentence reduction in months granted based on mitigating factors "
        "(excluding guilty plea reduction)"
    )
    source: str = source_field("mitigation reduction")


class FinalSentenceDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sentence_years: int = Field(description="Final sentence - years component")
    sentence_months: int = Field(description="Final sentence - months component (0-11)")
    guilty_plea_reduction_years: Optional[int] = Field(
        default=None,
        description="The reduction due to the defendant's guilty plea - years component",
    )
    guilty_plea_reduction_months: Optional[int] = Field(
        default=None,
        description="The reduction due to the defendant's guilty plea - months component (0-11)",
    )
    source: str = source_field("final sentence")

    @computed_field
    @property
    def total_months(self) -> int:
        return self.sentence_years * 12 + self.sentence_months

    @computed_field
    @property
    def guilty_plea_reduction_total_months(self) -> Optional[int]:
        if (
            self.guilty_plea_reduction_years is None
            and self.guilty_plea_reduction_months is None
        ):
            return None
        years = self.guilty_plea_reduction_years or 0
        months = self.guilty_plea_reduction_months or 0
        return years * 12 + months


class ChargeType(str, Enum):
    Actual_Trafficking = "Actual Trafficking"
    Conspiracy_to_Traffic = "Conspiracy to Traffic"


class ChargeDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")
    charge_no: int = Field(
        description="Charge number (1 for first charge, 2 for second charge, etc.)"
    )
    type: ChargeType = Field(
        description="Type of charge:\n"
        "Actual Trafficking: Trafficking in a dangerous drug/dangerous drugs or \n"
        "Conspiracy to Traffic: Conspiracy to traffic in a dangerous drug/dangerous drugs \n"
        "**Ignore other types of charges**"
    )
    defendant: str = Field(
        description="Name of the defendant associated with this charge"
    )
    source: str = source_field("charge type")


class Trial(BaseModel):
    model_config = ConfigDict(extra="forbid")

    charge_type: ChargeDetail
    drugs: List[DrugDetail] = Field(
        description="Types and quantities of drugs involved **in the current charge**"
    )
    roles: List[RoleDetail] = Field(
        description="Roles of the defendant in the offence **in the current charge**"
    )
    aggravating_factors: Optional[List[AggravatingFactorDetail]] = Field(
        default=None,
        description="Aggravating factors explicitly addressed by the judge for the current charge",
    )
    mitigating_factors: Optional[List[MitigatingFactorDetail]] = Field(
        default=None,
        description="Mitigating factors explicitly addressed by the judge for the current charge (excluding guilty plea)",
    )
    guilty_plea: GuiltyPleaDetail
    starting_point: StartingPointDetail = Field(
        description="Starting point of sentence based on drug type and quantity for the current charge"
    )
    sentence_after_role: Optional[SentenceAfterRoleDetail] = Field(
        default=None,
        description="The sentence taking into account the role of the defendant for the current charge",
    )
    notional_sentence: NotionalSentenceDetail = Field(
        description="Notional sentence (starting point plus enhancement due to aggravating factors) for the current charge"
    )
    mitigation_reduction: Optional[MitigationReductionDetail] = Field(
        default=None,
        description="Sentence reduction granted based on mitigating factors for the current charge (excluding guilty plea)",
    )
    final_sentence: FinalSentenceDetail = Field(
        description="Final sentence for the charge including any guilty plea reduction for the current charge"
    )

    @model_validator(mode="after")
    def check_sentence_flow(self) -> "Trial":
        def to_total_months(years: int, months: int) -> int:
            return years * 12 + months

        if not self.sentence_after_role:
            self.sentence_after_role = SentenceAfterRoleDetail(
                sentence_years=self.starting_point.sentence_years,
                sentence_months=self.starting_point.sentence_months,
                source="Inferred as starting point since role adjustment not provided",
            )

        notional_total = to_total_months(
            self.notional_sentence.sentence_years,
            self.notional_sentence.sentence_months,
        )
        after_role_total = to_total_months(
            self.sentence_after_role.sentence_years,
            self.sentence_after_role.sentence_months,
        )

        if notional_total < after_role_total:
            raise ValueError(
                "Notional sentence cannot be less than sentence after role/starting point"
            )

        current_sentence = notional_total
        if self.mitigation_reduction:
            current_sentence -= self.mitigation_reduction.reduction_months

        final_total = to_total_months(
            self.final_sentence.sentence_years, self.final_sentence.sentence_months
        )

        if final_total > current_sentence:
            raise ValueError(
                "Final sentence cannot be greater than notional sentence minus mitigation reduction"
            )

        if (
            self.final_sentence.guilty_plea_reduction_total_months
            and final_total
            != current_sentence - self.final_sentence.guilty_plea_reduction_total_months
        ):
            raise ValueError(
                "Final sentence must be equal to notional sentence minus mitigation reduction minus guilty plea reduction"
            )
        return self


class Trials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    trials: List[Trial] = Field(
        description="List of trials for each charge against the defendant pairs, there could be multiple charges per defendant, one charge to multiple defendants, or multiple charges to multiple defendants."
    )


if __name__ == "__main__":
    import json
    import os

    schema = Trials.model_json_schema()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with open("jsonSchema/trials.json", "w") as f:
        json.dump(schema, f, indent=4)
