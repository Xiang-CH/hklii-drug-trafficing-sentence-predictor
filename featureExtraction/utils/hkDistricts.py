"""
Hong Kong Districts and Sub-districts

Based on Hong Kong's 18 districts organized by area:
- Hong Kong Island (4 districts)
- Kowloon (5 districts)
- New Territories (9 districts)
"""

from enum import Enum
from typing import Dict, List, Set


class District(str, Enum):
    # Hong Kong Island
    CENTRAL_AND_WESTERN = "Central and Western"
    WAN_CHAI = "Wan Chai"
    EASTERN = "Eastern"
    SOUTHERN = "Southern"
    # Kowloon
    YAU_TSIM_MONG = "Yau Tsim Mong"
    SHAM_SHUI_PO = "Sham Shui Po"
    KOWLOON_CITY = "Kowloon City"
    WONG_TAI_SIN = "Wong Tai Sin"
    KWUN_TONG = "Kwun Tong"
    # New Territories
    KWAI_TSING = "Kwai Tsing"
    TSUEN_WAN = "Tsuen Wan"
    TUEN_MUN = "Tuen Mun"
    YUEN_LONG = "Yuen Long"
    NORTH = "North"
    TAI_PO = "Tai Po"
    SHA_TIN = "Sha Tin"
    SAI_KUNG = "Sai Kung"
    ISLANDS = "Islands"


class SubDistrict(str, Enum):
    # Central and Western
    KENNEDY_TOWN = "Kennedy Town"
    SHEK_TONG_TSUI = "Shek Tong Tsui"
    SAI_YING_PUN = "Sai Ying Pun"
    SHEUNG_WAN = "Sheung Wan"
    CENTRAL = "Central"
    ADMIRALTY = "Admiralty"
    MID_LEVELS = "Mid-levels"
    PEAK = "Peak"

    # Wan Chai
    WAN_CHAI = "Wan Chai"
    CAUSEWAY_BAY = "Causeway Bay"
    HAPPY_VALLEY = "Happy Valley"
    TAI_HANG = "Tai Hang"
    SO_KON_PO = "So Kon Po"
    JARDINES_LOOKOUT = "Jardine's Lookout"

    # Eastern
    TIN_HAU = "Tin Hau"
    BRAEMAR_HILL = "Braemar Hill"
    NORTH_POINT = "North Point"
    QUARRY_BAY = "Quarry Bay"
    SAI_WAN_HO = "Sai Wan Ho"
    SHAU_KEI_WAN = "Shau Kei Wan"
    CHAI_WAN = "Chai Wan"
    SIU_SAI_WAN = "Siu Sai Wan"

    # Southern
    POK_FU_LAM = "Pok Fu Lam"
    ABERDEEN = "Aberdeen"
    AP_LEI_CHAU = "Ap Lei Chau"
    WONG_CHUK_HANG = "Wong Chuk Hang"
    SHOUSON_HILL = "Shouson Hill"
    REPULSE_BAY = "Repulse Bay"
    CHUNG_HOM_KOK = "Chung Hom Kok"
    STANLEY = "Stanley"
    TAI_TAM = "Tai Tam"
    SHEK_O = "Shek O"

    # Yau Tsim Mong
    TSIM_SHA_TSUI = "Tsim Sha Tsui"
    YAU_MA_TEI = "Yau Ma Tei"
    WEST_KOWLOON_RECLAMATION = "West Kowloon Reclamation"
    KINGS_PARK = "King's Park"
    MONG_KOK = "Mong Kok"
    TAI_KOK_TSUI = "Tai Kok Tsui"

    # Sham Shui Po
    MEI_FOO = "Mei Foo"
    LAI_CHI_KOK = "Lai Chi Kok"
    CHEUNG_SHA_WAN = "Cheung Sha Wan"
    SHAM_SHUI_PO = "Sham Shui Po"
    SHEK_KIP_MEI = "Shek Kip Mei"
    YAU_YAT_TSUEN = "Yau Yat Tsuen"
    TAI_WO_PING = "Tai Wo Ping"
    STONECUTTERS_ISLAND = "Stonecutters Island"

    # Kowloon City
    HUNG_HOM = "Hung Hom"
    TO_KWA_WAN = "To Kwa Wan"
    MA_TAU_KOK = "Ma Tau Kok"
    MA_TAU_WAI = "Ma Tau Wai"
    KAI_TAK = "Kai Tak"
    KOWLOON_CITY = "Kowloon City"
    HO_MAN_TIN = "Ho Man Tin"
    KOWLOON_TONG = "Kowloon Tong"
    BEACON_HILL = "Beacon Hill"

    # Wong Tai Sin
    SAN_PO_KONG = "San Po Kong"
    WONG_TAI_SIN = "Wong Tai Sin"
    TUNG_TAU = "Tung Tau"
    WANG_TAU_HOM = "Wang Tau Hom"
    LOK_FU = "Lok Fu"
    DIAMOND_HILL = "Diamond Hill"
    TSZ_WAN_SHAN = "Tsz Wan Shan"
    NGAU_CHI_WAN = "Ngau Chi Wan"

    # Kwun Tong
    PING_SHEK = "Ping Shek"
    KOWLOON_BAY = "Kowloon Bay"
    NGAU_TAU_KOK = "Ngau Tau Kok"
    JORDAN_VALLEY = "Jordan Valley"
    KWUN_TONG = "Kwun Tong"
    SAU_MAU_PING = "Sau Mau Ping"
    LAM_TIN = "Lam Tin"
    YAU_TONG = "Yau Tong"
    LEI_YUE_MUN = "Lei Yue Mun"

    # Kwai Tsing
    KWAI_CHUNG = "Kwai Chung"
    TSING_YI = "Tsing Yi"

    # Tsuen Wan
    TSUEN_WAN = "Tsuen Wan"
    LEI_MUK_SHUE = "Lei Muk Shue"
    TING_KAU = "Ting Kau"
    SHAM_TSENG = "Sham Tseng"
    TSING_LUNG_TAU = "Tsing Lung Tau"
    MA_WAN = "Ma Wan"
    SUNNY_BAY = "Sunny Bay"

    # Tuen Mun
    TAI_LAM_CHUNG = "Tai Lam Chung"
    SO_KWUN_WAT = "So Kwun Wat"
    TUEN_MUN = "Tuen Mun"
    LAM_TEI = "Lam Tei"

    # Yuen Long
    HUNG_SHUI_KIU = "Hung Shui Kiu"
    HA_TSUEN = "Ha Tsuen"
    LAU_FAU_SHAN = "Lau Fau Shan"
    TIN_SHUI_WAI = "Tin Shui Wai"
    YUEN_LONG = "Yuen Long"
    SAN_TIN = "San Tin"
    LOK_MA_CHAU = "Lok Ma Chau"
    KAM_TIN = "Kam Tin"
    SHEK_KONG = "Shek Kong"
    PAT_HEUNG = "Pat Heung"

    # North
    FANLING = "Fanling"
    LUEN_WO_HUI = "Luen Wo Hui"
    SHEUNG_SHUI = "Sheung Shui"
    SHEK_WU_HUI = "Shek Wu Hui"
    SHA_TAU_KOK = "Sha Tau Kok"
    LUK_KENG = "Luk Keng"
    WU_KAU_TANG = "Wu Kau Tang"

    # Tai Po
    TAI_PO_MARKET = "Tai Po Market"
    TAI_PO = "Tai Po"
    TAI_PO_KAU = "Tai Po Kau"
    TAI_MEI_TUK = "Tai Mei Tuk"
    SHUEN_WAN = "Shuen Wan"
    CHEUNG_MUK_TAU = "Cheung Muk Tau"
    KEI_LING_HA = "Kei Ling Ha"

    # Sha Tin
    TAI_WAI = "Tai Wai"
    SHA_TIN = "Sha Tin"
    FO_TAN = "Fo Tan"
    MA_LIU_SHUI = "Ma Liu Shui"
    WU_KAI_SHA = "Wu Kai Sha"
    MA_ON_SHAN = "Ma On Shan"

    # Sai Kung
    CLEAR_WATER_BAY = "Clear Water Bay"
    SAI_KUNG = "Sai Kung"
    TAI_MONG_TSAI = "Tai Mong Tsai"
    TSEUNG_KWAN_O = "Tseung Kwan O"
    HANG_HAU = "Hang Hau"
    TIU_KENG_LENG = "Tiu Keng Leng"
    MA_YAU_TONG = "Ma Yau Tong"

    # Islands
    CHEUNG_CHAU = "Cheung Chau"
    PENG_CHAU = "Peng Chau"
    LANTAU_ISLAND = "Lantau Island"
    TUNG_CHUNG = "Tung Chung"
    LAMMA_ISLAND = "Lamma Island"


# Mapping of districts to their sub-districts
DISTRICT_TO_SUBDISTRICTS: Dict[District, List[SubDistrict]] = {
    # Hong Kong Island
    District.CENTRAL_AND_WESTERN: [
        SubDistrict.KENNEDY_TOWN,
        SubDistrict.SHEK_TONG_TSUI,
        SubDistrict.SAI_YING_PUN,
        SubDistrict.SHEUNG_WAN,
        SubDistrict.CENTRAL,
        SubDistrict.ADMIRALTY,
        SubDistrict.MID_LEVELS,
        SubDistrict.PEAK,
    ],
    District.WAN_CHAI: [
        SubDistrict.WAN_CHAI,
        SubDistrict.CAUSEWAY_BAY,
        SubDistrict.HAPPY_VALLEY,
        SubDistrict.TAI_HANG,
        SubDistrict.SO_KON_PO,
        SubDistrict.JARDINES_LOOKOUT,
    ],
    District.EASTERN: [
        SubDistrict.TIN_HAU,
        SubDistrict.BRAEMAR_HILL,
        SubDistrict.NORTH_POINT,
        SubDistrict.QUARRY_BAY,
        SubDistrict.SAI_WAN_HO,
        SubDistrict.SHAU_KEI_WAN,
        SubDistrict.CHAI_WAN,
        SubDistrict.SIU_SAI_WAN,
    ],
    District.SOUTHERN: [
        SubDistrict.POK_FU_LAM,
        SubDistrict.ABERDEEN,
        SubDistrict.AP_LEI_CHAU,
        SubDistrict.WONG_CHUK_HANG,
        SubDistrict.SHOUSON_HILL,
        SubDistrict.REPULSE_BAY,
        SubDistrict.CHUNG_HOM_KOK,
        SubDistrict.STANLEY,
        SubDistrict.TAI_TAM,
        SubDistrict.SHEK_O,
    ],
    # Kowloon
    District.YAU_TSIM_MONG: [
        SubDistrict.TSIM_SHA_TSUI,
        SubDistrict.YAU_MA_TEI,
        SubDistrict.WEST_KOWLOON_RECLAMATION,
        SubDistrict.KINGS_PARK,
        SubDistrict.MONG_KOK,
        SubDistrict.TAI_KOK_TSUI,
    ],
    District.SHAM_SHUI_PO: [
        SubDistrict.MEI_FOO,
        SubDistrict.LAI_CHI_KOK,
        SubDistrict.CHEUNG_SHA_WAN,
        SubDistrict.SHAM_SHUI_PO,
        SubDistrict.SHEK_KIP_MEI,
        SubDistrict.YAU_YAT_TSUEN,
        SubDistrict.TAI_WO_PING,
        SubDistrict.STONECUTTERS_ISLAND,
    ],
    District.KOWLOON_CITY: [
        SubDistrict.HUNG_HOM,
        SubDistrict.TO_KWA_WAN,
        SubDistrict.MA_TAU_KOK,
        SubDistrict.MA_TAU_WAI,
        SubDistrict.KAI_TAK,
        SubDistrict.KOWLOON_CITY,
        SubDistrict.HO_MAN_TIN,
        SubDistrict.KOWLOON_TONG,
        SubDistrict.BEACON_HILL,
    ],
    District.WONG_TAI_SIN: [
        SubDistrict.SAN_PO_KONG,
        SubDistrict.WONG_TAI_SIN,
        SubDistrict.TUNG_TAU,
        SubDistrict.WANG_TAU_HOM,
        SubDistrict.LOK_FU,
        SubDistrict.DIAMOND_HILL,
        SubDistrict.TSZ_WAN_SHAN,
        SubDistrict.NGAU_CHI_WAN,
    ],
    District.KWUN_TONG: [
        SubDistrict.PING_SHEK,
        SubDistrict.KOWLOON_BAY,
        SubDistrict.NGAU_TAU_KOK,
        SubDistrict.JORDAN_VALLEY,
        SubDistrict.KWUN_TONG,
        SubDistrict.SAU_MAU_PING,
        SubDistrict.LAM_TIN,
        SubDistrict.YAU_TONG,
        SubDistrict.LEI_YUE_MUN,
    ],
    # New Territories
    District.KWAI_TSING: [
        SubDistrict.KWAI_CHUNG,
        SubDistrict.TSING_YI,
    ],
    District.TSUEN_WAN: [
        SubDistrict.TSUEN_WAN,
        SubDistrict.LEI_MUK_SHUE,
        SubDistrict.TING_KAU,
        SubDistrict.SHAM_TSENG,
        SubDistrict.TSING_LUNG_TAU,
        SubDistrict.MA_WAN,
        SubDistrict.SUNNY_BAY,
    ],
    District.TUEN_MUN: [
        SubDistrict.TAI_LAM_CHUNG,
        SubDistrict.SO_KWUN_WAT,
        SubDistrict.TUEN_MUN,
        SubDistrict.LAM_TEI,
    ],
    District.YUEN_LONG: [
        SubDistrict.HUNG_SHUI_KIU,
        SubDistrict.HA_TSUEN,
        SubDistrict.LAU_FAU_SHAN,
        SubDistrict.TIN_SHUI_WAI,
        SubDistrict.YUEN_LONG,
        SubDistrict.SAN_TIN,
        SubDistrict.LOK_MA_CHAU,
        SubDistrict.KAM_TIN,
        SubDistrict.SHEK_KONG,
        SubDistrict.PAT_HEUNG,
    ],
    District.NORTH: [
        SubDistrict.FANLING,
        SubDistrict.LUEN_WO_HUI,
        SubDistrict.SHEUNG_SHUI,
        SubDistrict.SHEK_WU_HUI,
        SubDistrict.SHA_TAU_KOK,
        SubDistrict.LUK_KENG,
        SubDistrict.WU_KAU_TANG,
    ],
    District.TAI_PO: [
        SubDistrict.TAI_PO_MARKET,
        SubDistrict.TAI_PO,
        SubDistrict.TAI_PO_KAU,
        SubDistrict.TAI_MEI_TUK,
        SubDistrict.SHUEN_WAN,
        SubDistrict.CHEUNG_MUK_TAU,
        SubDistrict.KEI_LING_HA,
    ],
    District.SHA_TIN: [
        SubDistrict.TAI_WAI,
        SubDistrict.SHA_TIN,
        SubDistrict.FO_TAN,
        SubDistrict.MA_LIU_SHUI,
        SubDistrict.WU_KAI_SHA,
        SubDistrict.MA_ON_SHAN,
    ],
    District.SAI_KUNG: [
        SubDistrict.CLEAR_WATER_BAY,
        SubDistrict.SAI_KUNG,
        SubDistrict.TAI_MONG_TSAI,
        SubDistrict.TSEUNG_KWAN_O,
        SubDistrict.HANG_HAU,
        SubDistrict.TIU_KENG_LENG,
        SubDistrict.MA_YAU_TONG,
    ],
    District.ISLANDS: [
        SubDistrict.CHEUNG_CHAU,
        SubDistrict.PENG_CHAU,
        SubDistrict.LANTAU_ISLAND,
        SubDistrict.TUNG_CHUNG,
        SubDistrict.LAMMA_ISLAND,
    ],
}

# Reverse mapping: sub-district to its parent district
SUBDISTRICT_TO_DISTRICT: Dict[SubDistrict, District] = {
    sub: district for district, subs in DISTRICT_TO_SUBDISTRICTS.items() for sub in subs
}


def get_subdistricts_for_district(district: District) -> List[SubDistrict]:
    """Get all sub-districts for a given district."""
    return DISTRICT_TO_SUBDISTRICTS.get(district, [])


def get_district_for_subdistrict(subdistrict: SubDistrict) -> District:
    """Get the parent district for a given sub-district."""
    return SUBDISTRICT_TO_DISTRICT[subdistrict]


def is_subdistrict_in_district(subdistrict: SubDistrict, district: District) -> bool:
    """Check if a sub-district belongs to a given district."""
    return SUBDISTRICT_TO_DISTRICT.get(subdistrict) == district


def get_valid_subdistricts_set(district: District) -> Set[SubDistrict]:
    """Get a set of valid sub-districts for a given district (for fast lookup)."""
    return set(DISTRICT_TO_SUBDISTRICTS.get(district, []))
