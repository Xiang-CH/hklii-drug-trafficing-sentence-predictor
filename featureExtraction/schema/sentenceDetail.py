from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class DrugType(str, Enum):
    COCAINE = "Cocaine"
    HEROIN = "Heroin"
    METH = "Meth"
    KETAMINE = "Ketamine"
    NIMETAZEPAM = "Nimetazepam"
    ECSTASY = "Ecstasy"
    CANNABIS_RESIN = "Cannabis resin"
    HERBAL_CANNABIS = "Herbal cannabis"


class DefendantRole(str, Enum):
    NOT_MENTIONED = "Not mentioned"
    COURIER = "Courier"
    STOREKEEPER = "Storekeeper"
    LOOKOUT = "Lookout/scout"
    ACTUAL_TRAFFICKER = "Actual trafficker"
    MANAGER = "Manager/organizer"
    OPERATOR = "Operator/financial controller"
    INTERNATIONAL_OPERATOR = "International operator/financial controller"
    OTHER = "Other"


class AggravatingFactorType(str, Enum):
    NONE = "None"
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


class MitigatingFactorType(str, Enum):
    NONE = "None"
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
    POSITIVE_CHARACTER = "Positive character"
    REHABILITATION_PROGRAMME = "Rehabilitation programme"


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
    quantity: int = Field(
        description="Quantity of the drug in grams"
    )
    source: str = Field(
        description="The exact match source text from which the drug type and quantity were extracted"
    )


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
                    "None: No aggravating factors; "
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
                    "Multiple drugs: Dealing in more than one type of dangerous drugs."
    )
    enhancement: Optional[int] = Field(
        default=None,
        description="The specific sentence enhancement in months due to this aggravating factor, "
                    "or null if the judge acknowledged the factor but decided not to impose enhancement"
    )
    source: str = Field(
        description="The exact match source text from which the aggravating factor was extracted"
    )


class GuiltyPleaDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pleaded_guilty: bool = Field(
        description="Whether the defendant pleaded guilty"
    )
    court_type: Optional[CourtType] = Field(
        default=None,
        description="The court where the plea was entered"
    )
    high_court_stage: Optional[HighCourtPleaStage] = Field(
        default=None,
        description="Stage of guilty plea if in High Court. "
                    "Unknown: Stage unknown; "
                    "Up to committal: Up to committal in Magistrates' Courts; "
                    "After committal: After committal and up to and until trial dates are fixed; "
                    "After dates fixed: After trial dates are fixed but before the first date of trial; "
                    "First day: First day of trial; "
                    "During trial: During the trial."
    )
    district_court_stage: Optional[DistrictCourtPleaStage] = Field(
        default=None,
        description="Stage of guilty plea if in District Court. "
                    "Unknown: Stage unknown; "
                    "Plea day: At plea day; "
                    "After dates fixed: After trial dates are fixed but before the first date of trial; "
                    "First day: First day of trial; "
                    "During trial: During the trial."
    )
    source: str = Field(
        description="The exact match source text from which the guilty plea information was extracted"
    )


class BenefitsReceivedDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: Optional[float] = Field(
        default=None,
        description="Amount of benefits received or to be received for trafficking in HKD, "
                    "excluding the value of the drug itself"
    )
    source: str = Field(
        description="The exact match source text from which the benefits amount was extracted"
    )


class MitigatingFactorDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    factor: MitigatingFactorType = Field(
        description="The mitigating factor explicitly addressed by the judge (excluding guilty plea). "
                    "None: No mitigating factors; "
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
                    "Positive character: Positive good character; "
                    "Rehabilitation programme: Participation in anti-trafficking or rehabilitative programmes."
    )
    reduction: Optional[int] = Field(
        default=None,
        description="The specific sentence reduction in months due to this mitigating factor, "
                    "or null if the judge acknowledged the factor but decided not to impose reduction"
    )
    source: str = Field(
        description="The exact match source text from which the mitigating factor was extracted"
    )


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
        description="The reduction in months specifically due to the defendant's guilty plea"
    )
    source: str = Field(
        description="The exact match source text from which the final sentence was extracted"
    )


class SentenceDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    drugs: List[DrugDetail] = Field(
        description="Types and quantities of drugs involved in the offence"
    )
    role: RoleDetail
    aggravating_factors: Optional[List[AggravatingFactorDetail]] = Field(
        default=None,
        description="Aggravating factors explicitly addressed by the judge"
    )
    mitigating_factors: Optional[List[MitigatingFactorDetail]] = Field(
        default=None,
        description="Mitigating factors explicitly addressed by the judge (excluding guilty plea)"
    )
    guilty_plea: GuiltyPleaDetail
    benefits_received: Optional[BenefitsReceivedDetail] = Field(
        default=None,
        description="Benefits received or to be received for trafficking"
    )
    starting_point: Optional[StartingPointDetail] = Field(
        default=None,
        description="Starting point of sentence based on drug type and quantity"
    )
    sentence_after_role: Optional[SentenceAfterRoleDetail] = Field(
        default=None,
        description="The sentence taking into account the role of the defendant"
    )
    notional_sentence: Optional[NotionalSentenceDetail] = Field(
        default=None,
        description="Notional sentence (starting point plus enhancement due to aggravating factors)"
    )
    mitigation_reduction: Optional[MitigationReductionDetail] = Field(
        default=None,
        description="Sentence reduction granted based on mitigating factors (excluding guilty plea)"
    )
    final_sentence: Optional[FinalSentenceDetail] = Field(
        default=None,
        description="Final sentence for the charge including any guilty plea reduction"
    )


if __name__ == "__main__":
    import json
    import os

    schema = SentenceDetail.model_json_schema()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with open("jsonSchema/SentenceDetail.json", "w") as f:
        json.dump(schema, f, indent=4)

