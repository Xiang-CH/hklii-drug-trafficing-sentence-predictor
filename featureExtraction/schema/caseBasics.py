from enum import Enum
import os
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict, computed_field
from datetime import date as date_type, time as time_type
import holidays


class District(str, Enum):
    CENTRAL_AND_WESTERN = "Central and Western"
    EASTERN = "Eastern"
    SOUTHERN = "Southern"
    WAN_CHAI = "Wan Chai"
    KOWLOON_CITY = "Kowloon City"
    KWUN_TONG = "Kwun Tong"
    SHAM_SHUI_PO = "Sham Shui Po"
    WONG_TAI_SIN = "Wong Tai Sin"
    YAU_TSIM_MONG = "Yau Tsim Mong"
    ISLANDS = "Islands"
    KWAI_TSING = "Kwai Tsing"
    NORTH = "North"
    SAI_KUNG = "Sai Kung"
    SHA_TIN = "Sha Tin"
    TAI_PO = "Tai Po"
    TSUEN_WAN = "Tuen Wan"
    TUEN_MUN = "Tuen Mun"
    YUEN_LONG = "Yuen Long"


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
    DRUG_STORAGE = "Drug storage"
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
    OTHER = "Other"


class DateDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: date_type = Field(description="The date in ISO 8601 format (YYYY-MM-DD)")
    source: str = Field(
        description="The exact match source text from which the date was extracted"
    )

    @computed_field
    @property
    def day_of_week(self) -> int:
        """Automatically computed day of the week from the date (1=Monday, 7=Sunday)."""
        return self.date.weekday() + 1

    @computed_field
    @property
    def is_hk_public_holiday(self) -> bool:
        """Automatically computed whether the date is a Hong Kong public holiday."""
        hk_holidays = holidays.country_holidays("HK")
        return self.date in hk_holidays


class TimeDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    time: time_type = Field(
        description="The time in ISO 8601 format (HH:MM:SS), UTC +8 timezone"
    )
    source: str = Field(
        description="The exact match source text from which the time was extracted"
    )


class PlaceOfOffence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    address: str = Field(description="The full address of the place of offence")
    district: District = Field(
        description="The district where the place of offence is located"
    )
    source: str = Field(
        description="The exact match source text from which the place of offence was extracted"
    )


class NatureOfPlaceOfOffence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nature: NatureOfPlace = Field(description="The nature of the place of offence.")
    source: str = Field(
        description="The exact match source text from which the nature of the place of offence was extracted"
    )


class TraffickingMode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: TraffickingModeEnum = Field(
        description="The mode of drug trafficking. Options include:"
        "'Street-level dealing' (Selling drugs directly to users in public spaces like streets, parks, or clubs); "
        "'Social supply' (Sharing or selling drugs within social circles); "
        "'Courier delivery' (Transporting drugs personally from one location to another for delivery to buyers); "
        "'Parcel delivery' (Shipping drugs through postal or courier services); "
        "'Drug houses' (Operating from fixed locations (e.g., apartments or houses) where buyers visit to purchase drugs); "
        "'Vehicle-based dealing' (Conducting drug transactions from cars, either through drive-by exchanges, quick meetings in parking lots, or mobile delivery to buyers); "
        "'Vehicle concealment' (Hiding drugs in vehicles); "
        "'Mule trafficking' (Using individuals to transport drugs across borders); "
        "'Drug storage' (Storing drugs in specific locations before distribution); "
        "'Maritime transport'; "
        "'Festival or event dealing' (Selling drugs at music festivals, raves, or large gatherings where drug use is prevalent); "
        "'Online trafficking' (Selling and distributing drugs through internet platforms), or 'Other'."
    )
    source: str = Field(
        description="The exact match source text from which the mode of drug trafficking was extracted"
    )


class ReasonForOffenceDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reasons: List[ReasonForOffence] = Field(
        description="Reasons for committing the offence. "
        "Financial gain: To obtain money, valuables, or other material benefit, regardless of financial need; "
        "Economic hardship: Motivated by financial difficulties facing the offender, such as debt, unemployment, or other economic pressures; "
        "Coercion: Compelled to commit the offence due to threats, intimidation, or pressure from criminal groups or other parties; "
        "Deception: Misled or deceived about the nature or consequences of the activity, leading to involvement in the offence; "
        "Addiction-driven: To support the individual's substance abuse or addiction, such as funding personal drug use; "
        "Peer influence: Influenced by social pressure or encouragement from peers or associates; "
    )
    source: str = Field(
        description="The exact match source text from which the reasons for committing the offence were extracted"
    )


class BenefitsReceivedDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: Optional[float] = Field(
        default=None,
        description="Amount of benefits received or to be received for trafficking in HKD, "
        "excluding the value of the drug itself",
    )
    source: str = Field(
        description="The exact match source text from which the benefits amount was extracted"
    )


class CaseBasics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: Optional[DateDetail] = Field(default=None)
    time: Optional[TimeDetail] = Field(default=None)
    placeOfOffence: Optional[PlaceOfOffence] = Field(default=None)
    natureOfPlaceOfOffence: NatureOfPlaceOfOffence
    traffickingMode: Optional[TraffickingMode] = Field(default=None)
    reason_for_offence: Optional[ReasonForOffenceDetail] = Field(default=None)
    benefits_received: Optional[BenefitsReceivedDetail] = Field(default=None)


if __name__ == "__main__":
    import os
    import json

    schema = CaseBasics.model_json_schema()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with open("jsonSchema/caseBasics.json", "w") as f:
        json.dump(schema, f, indent=4)
