from db import DB
from dotenv import load_dotenv
import pandas as pd
import os

load_dotenv()

years = ["2021", "2022", "2023", "2024", "2025"]

file_path = os.getenv("JUDGEMENT_DATA_BASE_PATH")


def read_judgement_list(year: str) -> pd.DataFrame:
    directory = os.path.join(file_path, year)
    judgements = list(filter(lambda x: x.endswith(".htm"), os.listdir(directory)))
    df = pd.DataFrame(judgements, columns=["filename"])
    df["year"] = year
    df["trial"] = df["filename"].apply(lambda x: x.split(".")[0].split("_")[0])
    df["appeal"] = df["filename"].apply(
        lambda x: x.split(".")[0].split("_")[1]
        if len(x.split(".")[0].split("_")) > 1
        and len(x.split(".")[0].split("_")[1]) > 2
        else None
    )
    df["corrigendum"] = df["filename"].apply(
        lambda x: x.split(".")[0]
        if len(x.split(".")[0].split("_")) > 1
        and len(x.split(".")[0].split("_")[1]) <= 2
        else None
    )

    # Remove rows that are just the base trial when there exists another row for the same trial
    # that contains an appeal or corrigendum (keep the detailed rows instead).
    trials_with_variants = df.loc[
        df["appeal"].notna() | df["corrigendum"].notna(), "trial"
    ].unique()
    df = df[
        ~(
            df["trial"].isin(trials_with_variants)
            & df["appeal"].isna()
            & df["corrigendum"].isna()
        )
    ].reset_index(drop=True)

    return df


def get_trial_html(trial, year):
    trial_file_path = os.path.join(file_path, year, f"{trial}.htm")
    if os.path.exists(trial_file_path):
        with open(trial_file_path, "r") as f:
            return f.read().strip()
    print(f"File not found: {os.path.join(year, f'{trial}.htm')}")
    return None


def get_appeal_html(row, year):
    if not row["appeal"] or pd.isna(row["appeal"]):
        return None
    appeal_file_path = os.path.join(
        file_path, year, f"{row['trial']}_{row['appeal']}.htm"
    )
    if os.path.exists(appeal_file_path):
        with open(appeal_file_path, "r") as f:
            return f.read().strip()

    print(
        f"File not found: {os.path.join(year, f'{row["trial"]}_{row["appeal"]}.htm')}"
    )
    return None


def get_corrigendum_html(x, year):
    if not x or pd.isna(x):
        return None
    corrigendum_file_path = os.path.join(file_path, year, f"{x}.htm")
    if os.path.exists(corrigendum_file_path):
        with open(corrigendum_file_path, "r") as f:
            return f.read().strip()
    print(f"File not found: {os.path.join(year, f'{x}.htm')}")
    return None


if __name__ == "__main__":
    db = DB()
    judgements_collection = db.get_judgements_collection()

    for year in years:
        df = read_judgement_list(year)

        # df.info()

        df["html"] = df["trial"].apply(lambda x: get_trial_html(x, year))
        df["appeal_html"] = df.apply(lambda row: get_appeal_html(row, year), axis=1)
        df["corrigendum_html"] = df["corrigendum"].apply(
            lambda x: get_corrigendum_html(x, year)
        )
        print(df)

        df.to_excel(os.path.join(file_path, f"judgements_{year}.xlsx"), index=False)

        judgements_collection.insert_many(df.to_dict("records"))

        break
