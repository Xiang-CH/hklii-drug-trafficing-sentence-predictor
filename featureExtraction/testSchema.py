import os
from openai import OpenAI
from schema import CaseBasics, Defendants, Trials
from bs4 import BeautifulSoup
from tqdm import tqdm

from dotenv import load_dotenv

load_dotenv()

RERUN_ALL = False
MAX_RETRIES = 3

judgement_base_path = "sampleJudgments"
judgement_types = [
    "single-d-single-dt",
    "single-d-multi-dt",
    "single-d-dt+ndt",
    "multi-d-single-dt",
    "multi-d-multi-dt",
    "multi-d-multi-dt+ndt",
    "appeal",
    "corrigendum",
]
schemas = [
    ("caseBasics", CaseBasics),
    ("defendants", Defendants),
    ("trials", Trials),
]

os.chdir(os.path.dirname(os.path.abspath(__file__)))
client = OpenAI(
    base_url=os.getenv("OPENAI_BASE_URL"),
)

for judgement_type in tqdm(judgement_types, desc="Judgement Types"):
    os.makedirs(f"schema/exampleOutput/{judgement_type}", exist_ok=True)

    # Load case file
    if judgement_type == "corrigendum":
        judgement_path_1 = os.path.join(
            judgement_base_path, "case-with-corrigendum.htm"
        )
        judgement_path_2 = os.path.join(judgement_base_path, "corrigendum.htm")
        with open(judgement_path_1, "r") as f:
            case_html_1 = f.read()
        with open(judgement_path_2, "r") as f:
            case_html_2 = f.read()
        case_txt = (
            BeautifulSoup(case_html_1, "html.parser").get_text()
            + BeautifulSoup(case_html_2, "html.parser").get_text()
        )
    elif judgement_type == "appeal":
        judgement_path_1 = os.path.join(judgement_base_path, "appeal.htm")
        judgement_path_2 = os.path.join(judgement_base_path, "appeal-from.htm")
        with open(judgement_path_1, "r") as f:
            case_html_1 = f.read()
        with open(judgement_path_2, "r") as f:
            case_html_2 = f.read()
        case_txt = (
            BeautifulSoup(case_html_1, "html.parser").get_text()
            + BeautifulSoup(case_html_2, "html.parser").get_text()
        )
    else:
        judgement_path = os.path.join(judgement_base_path, judgement_type + ".htm")
        with open(judgement_path, "r") as f:
            case_html = f.read()
        case_txt = BeautifulSoup(case_html, "html.parser").get_text()

    # Extract features
    for schema_name, schema_model in tqdm(schemas, desc="Schemas", leave=False):
        output_path = f"schema/exampleOutput/{judgement_type}/{schema_name}.json"

        if not RERUN_ALL and os.path.exists(output_path):
            continue

        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                error_context = ""
                if last_error:
                    error_context = f"\n\nPrevious attempt failed with error: {last_error}. Please try again carefully."

                response = client.responses.parse(
                    model="gpt-5-mini",
                    instructions=f"Extract {schema_name} according to the provided schema. "
                    "If a feature is not mentioned in the case, set the corresponding field to null, but check the case text thoroughly."
                    + error_context,
                    input=case_txt,
                    reasoning={"effort": "low"},
                    text_format=schema_model,
                )

                with open(output_path, "w") as f:
                    f.write(response.output_parsed.model_dump_json(indent=2))
                break  # Success, exit retry loop

            except Exception as e:
                last_error = str(e)
                if attempt == MAX_RETRIES - 1:
                    print(
                        f"Failed to extract {schema_name} for {judgement_type} after {MAX_RETRIES} attempts: {last_error}"
                    )
                    raise
