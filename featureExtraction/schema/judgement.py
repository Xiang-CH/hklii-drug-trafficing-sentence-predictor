import os
import re
import holidays

from enum import Enum
from typing import List, Optional, Dict
from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    computed_field,
    field_validator,
    model_validator,
)
from datetime import date as date_type, time as time_type, datetime, timedelta
from schema.common import source_field
from utils.hkDistricts import (
    District,
    SubDistrict,
    get_district_for_subdistrict,
)


class ChargeName(str, Enum):
    TRAFFICKIING_A_DRUG = "Trafficking in a dangerous drug"
    TRAFFICKIING_DRUGS = "Trafficking in dangerous drugs"
    CONSPIRACY_TO_TRAFFIC_A_DRUG = "Conspiracy to traffic in a dangerous drug"
    CONSPIRACY_TO_TRAFFIC_DRUGS = "Conspiracy to traffic in dangerous drugs"


class NatureOfPlace(str, Enum):
    RESIDENTIAL = "Residential building"
    COMMERCIAL = "Commercial building"
    INDUSTRIAL = "Industrial building"
    GOVERNMENT = "Government or public building"
    ENTERTAINMENT = "Entertainment venue"
    STREET = "Street"
    CAR_PARK = "Car park or parking lot"
    SHOPPING_MALL = "Shopping mall"
    PUBLIC_TRANSPORT = "Public transport"
    PRIVATE_VEHICLE = "Private vehicle"
    RESTAURANT = "Restaurant"
    EDUCATION = "Educational institution"
    HOSPITAL = "Hospital or medical facility"
    METHADONE_CLINIC = "Outside methadone clinic"
    RECREATIONAL = "Recreational area"
    HOTEL = "Hotel or guesthouse"
    CONSTRUCTION = "Construction site"
    VACANT = "Vacant or abandoned property"
    BORDER = "Border checkpoint"
    OTHER = "Other"


class TraffickingModeEnum(str, Enum):
    STREET_DEALING = "Street-level dealing"
    SOCIAL_SUPPLY = "Social supply"
    COURIER = "Courier delivery"
    PARCEL = "Parcel delivery"
    DRUG_HOUSES = "Drug houses"
    VEHICLE_DEALING = "Vehicle-based dealing"
    VEHICLE_CONCEALMENT = "Vehicle concealment"
    MULE = "Mule trafficking"
    DRUG_STORAGE = "Drug repackaging or storage"
    MARITIME = "Maritime transport"
    FESTIVAL = "Festival or event dealing"
    ONLINE = "Online trafficking"
    OTHER = "Other"


class ReasonForOffence(str, Enum):
    FINANCIAL_GAIN = "Financial gain"
    ECONOMIC_HARDSHIP = "Economic hardship"
    COERCION = "Coercion"
    DECEPTION = "Deception"
    ADDICTION_DRIVEN = "Addiction-driven"
    PEER_INFLUENCE = "Peer influence"
    HELPING_OTHERS = "Helping other people"
    OTHER = "Other"


class DateDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: date_type | List[date_type] = Field(
        description="The date of offence in ISO 8601 format (YYYY-MM-DD), or a list of two elements if a date range is mentioned"
    )

    @field_validator("date")
    @classmethod
    def validate_date(
        cls, v: date_type | List[date_type]
    ) -> date_type | List[date_type]:
        if isinstance(v, list):
            if len(v) != 2:
                raise ValueError("Date range must be a list of two dates")
            if v[0] > v[1]:
                raise ValueError("Start date must be before or equal to end date")
        return v

    source: str = source_field("date")

    @computed_field
    @property
    def day_of_week(self) -> int | List[int]:
        """Automatically computed day of the week from the date (1=Monday, 7=Sunday)."""
        if isinstance(self.date, list):
            current = self.date[0]
            days = []
            while current <= self.date[1]:
                days.append(current.weekday() + 1)
                current += timedelta(days=1)
            return days
        return self.date.weekday() + 1

    @computed_field
    @property
    def is_hk_public_holiday(self) -> bool:
        """Automatically computed whether the date is a Hong Kong public holiday."""
        hk_holidays = holidays.country_holidays("HK")
        if isinstance(self.date, list):
            # Generate all dates in the range and check if any is a holiday
            current = self.date[0]
            while current <= self.date[1]:
                if current in hk_holidays:
                    return True
                current += timedelta(days=1)
            return False
        return self.date in hk_holidays


class TimeDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    time: time_type = Field(
        description="The time offence in ISO 8601 format (HH:MM:SS), if no timezone is specified, it is assumed to be in UTC +8 timezone"
    )

    @computed_field
    @property
    def time_of_day(self) -> str:
        """Automatically computed time of day (morning, afternoon, evening, night)."""
        hour = self.time.hour
        if 6 <= hour < 12:
            return "morning"
        elif 12 <= hour < 18:
            return "afternoon"
        elif 18 <= hour < 23:
            return "evening"
        else:
            return "night"

    source: str = source_field("time")


class PlaceOfOffence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    address: str = Field(description="The full address of the place of offence")
    nature: NatureOfPlace = Field(description="The nature of the place of offence.")
    subDistrict: SubDistrict = Field(
        description="The sub-district within the district where the place of offence is located",
    )

    @computed_field
    @property
    def district(self) -> District:
        """Automatically computed district from the sub-district."""
        return get_district_for_subdistrict(self.subDistrict)

    source: str = source_field("place of offence")


class TraffickingMode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: TraffickingModeEnum = Field(
        description="The mode of drug trafficking. Options include:"
        "'Street-level dealing' (Selling drugs directly to users in public spaces like streets, parks, or clubs); "
        "'Social supply' (Sharing or selling drugs within social circles); "
        "'Courier delivery' (Transporting drugs personally from one location to another including delivering them directly to buyers); "
        "'Parcel delivery' (Shipping drugs through postal or courier services); "
        "'Drug houses' (Operating from fixed locations (e.g., apartments or houses) where buyers visit to purchase drugs); "
        "'Vehicle-based dealing' (Conducting drug transactions from cars, either through drive-by exchanges, quick meetings in parking lots, or mobile delivery to buyers); "
        "'Vehicle concealment' (Hiding drugs in vehicles); "
        "'Mule trafficking' (Using individuals to transport drugs across borders); "
        "'Drug repackaging or storage' (Repackaging or storing drugs in specific locations before distribution); "
        "'Maritime transport'; "
        "'Festival or event dealing' (Selling drugs at music festivals, raves, or large gatherings where drug use is prevalent); "
        "'Online trafficking' (Selling and distributing drugs through internet platforms), or 'Other'."
    )
    source: str = source_field("mode of drug trafficking")


class ReasonForOffenceDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: ReasonForOffence = Field(
        description="Reasons for committing the offence. "
        "Financial gain: To obtain money, valuables, or other material benefit primarily for profit or improvement of lifestyle, and not mainly driven by financial difficulties or economic pressure; "
        "Economic hardship: Motivated primarily by financial difficulties facing the offender, such as debt, unemployment, inability to meet basic living expenses, or other economic pressures; "
        "Coercion: Compelled to commit the offence due to threats, intimidation, or pressure from criminal groups or other parties; "
        "Deception: Misled or deceived about the nature or consequences of the activity, leading to involvement in the offence; "
        "Addiction-driven: To support the individual's substance abuse or addiction, such as funding personal drug use; "
        "Peer influence: Influenced by social pressure or encouragement from peers or associates; "
        "Helping other people: Committed with the voluntary intent to assist or benefit another person (e.g., providing resources, support, or fulfilling a request), where this assistance is not driven by the offender's own financial need, coercion, deception, addiction, or peer pressure, and without expectation of material gain; "
    )
    source: str = source_field("reasons for committing the offence")


class BenefitsReceivedDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    received: bool = Field(
        description="Whether benefits were received or to be received for trafficking."
    )
    amount: Optional[float] = Field(
        default=None,
        description="Amount of benefits received or to be received for trafficking in HKD, "
        "excluding the value of the drug itself. Only set to null if benefit amount is not explicitly stated.",
    )
    source: str = source_field("benefits amount")


class ImportExportEnum(str, Enum):
    IMPORT = "import"
    EXPORT = "export"


class CrossBorderDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cross_border: bool = Field(
        description="Whether the trafficking involved cross-border activities."
    )
    type: Optional[ImportExportEnum] = Field(
        default=None,
        description="Indicates whether the cross-border trafficking was an import or export. "
        "Set to null if not mentioned.",
    )
    source: str = source_field("cross-border trafficking")


class ChargeForDefendant(BaseModel):
    model_config = ConfigDict(extra="forbid")

    defendant_name: str = Field(
        description="Full name of the defendant given the charge as appearing in the judgment"
    )
    defendant_id: Optional[int] = Field(
        default=None,
        description="Defendant ID (1-indexed), automatically assigned based on first appearance order across all charges",
    )
    trafficking_mode: Optional[TraffickingMode] = Field(default=None)
    reasons_for_offence: Optional[List[ReasonForOffenceDetail]] = Field(default=None)
    benefits_received: Optional[BenefitsReceivedDetail] = Field(
        default=None,
        description="Extract a monetary benefit only if the judgment explicitly says the defendant received: "
        "a ‘payment’, ‘reward’, ‘profit’, ‘proceeds’, ‘benefit’, ‘gain’, or ‘income’ from drug trafficking "
        "and for the defendant’s personal benefit (not merely handled or transported).\n"
        "Ignore cash simply because it was found on the defendant’s person or in a car/room; "
        "Do not infer benefits from drug quantity, street value, or general trafficking profitability; "
        "Attribute a benefit solely when the text clearly links that specific benefit to that defendant.",
    )


class Charge(BaseModel):
    model_config = ConfigDict(extra="forbid")

    charge_no: Optional[int] = Field(
        default=None,
        description="Charge number (1-indexed), automatically assigned after model creation",
    )
    charge_name: ChargeName = Field(
        description="Name of the charge (offence), ignore charges not in the enumeration"
    )
    offence_date: Optional[DateDetail] = Field(default=None)
    offence_time: Optional[TimeDetail] = Field(default=None)
    place_of_offence: Optional[PlaceOfOffence] = Field(default=None)
    cross_border: CrossBorderDetail = Field(
        description="Whether the trafficking involved cross-border activities.",
    )
    defendants_of_charge: List[ChargeForDefendant] = Field(
        description="List of charges for each defendant"
    )


class Representative(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(description="Name of the representative")
    role: str = Field(
        description="Role of the representative in original language of the judgment"
    )


class DefendantInfo(BaseModel):
    """Simple model for defendant ID and name in the defendants list."""

    model_config = ConfigDict(extra="forbid")

    id: int = Field(description="Defendant ID (1-indexed)")
    name: str = Field(description="Full name of the defendant")


# Regex patterns for validation
NEUTRAL_CITATION_PATTERN = re.compile(r"^\[\d{4}\]\s+[A-Z]+\s+\d+$")
CASES_HEARD_PATTERN = re.compile(r"^[A-Z]+\s+\d+/\d{4}$")


class Judgement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    neutral_citation: str = Field(
        description="Neutral citation of the case in the format <[year] court number>"
    )

    @field_validator("neutral_citation")
    @classmethod
    def validate_neutral_citation(cls, v: str) -> str:
        if not NEUTRAL_CITATION_PATTERN.match(v):
            raise ValueError(
                f"Invalid neutral citation format: '{v}'. "
                "Expected format: [year] court number (e.g., '[2024] HKCFI 123')"
            )
        return v

    @computed_field
    @property
    def court(self) -> str:
        """Automatically computed court from the neutral citation."""
        return self.neutral_citation.split(" ")[1]

    judge_name: str = Field(description="Name of the judge presiding over the case")
    judgment_date_time: datetime = Field(
        description="Date and time of the judgment in ISO 8601 format"
    )
    representatives: List[Representative] = Field(
        description="List of legal representatives involved in the case"
    )
    cases_heard: List[str] = Field(
        description="List of cases heard in the judgment in the format <case_type case_no/year>, e.g. HCCC 100/2024 at least one case must be present"
    )

    @field_validator("cases_heard")
    @classmethod
    def validate_cases_heard(cls, v: List[str]) -> List[str]:
        if len(v) == 0:
            raise ValueError("At least one case must be present")
        for case in v:
            if not CASES_HEARD_PATTERN.match(case):
                raise ValueError(
                    f"Invalid case format: '{case}'. "
                    "Expected format: case_type case_no/year (e.g., 'HCCC 100/2024')"
                )
        return v

    charges: List[Charge] = Field(description="List of charges in the case")

    @model_validator(mode="after")
    def assign_charge_and_defendant_ids(self) -> "Judgement":
        """Assign charge numbers and defendant IDs after model creation."""
        # Assign charge numbers (1-indexed)
        for idx, charge in enumerate(self.charges, start=1):
            charge.charge_no = idx

        # Assign defendant IDs based on first appearance order
        defendant_id_map: Dict[str, int] = {}
        current_id = 1
        for charge in self.charges:
            for defendant in charge.defendants_of_charge:
                if defendant.defendant_name not in defendant_id_map:
                    defendant_id_map[defendant.defendant_name] = current_id
                    current_id += 1
                defendant.defendant_id = defendant_id_map[defendant.defendant_name]

        return self

    @computed_field
    @property
    def defendants(self) -> List[DefendantInfo]:
        """Computed list of all defendants with their IDs based on first appearance order."""
        defendant_id_map: Dict[str, int] = {}
        current_id = 1
        for charge in self.charges:
            for defendant in charge.defendants_of_charge:
                if defendant.defendant_name not in defendant_id_map:
                    defendant_id_map[defendant.defendant_name] = current_id
                    current_id += 1
        # Return as list of DefendantInfo objects sorted by ID
        return sorted(
            [DefendantInfo(id=id, name=name) for name, id in defendant_id_map.items()],
            key=lambda x: x.id,
        )


if __name__ == "__main__":
    import os
    import json

    schema = Judgement.model_json_schema()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with open("jsonSchema/judgement.json", "w") as f:
        json.dump(schema, f, indent=4)
