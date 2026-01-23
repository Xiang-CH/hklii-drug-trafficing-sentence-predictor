import os
import re
import json

# from openai import OpenAI
from langfuse.openai import openai  # Langfuse OpenAI wrapper for observability
from openai._exceptions import OpenAIError
from bs4 import BeautifulSoup
from pydantic import ValidationError
from tqdm import tqdm
from langfuse import observe

from schema import Judgement, Defendants, Trials
from utils.htmlToText import html_to_text_with_tables

from dotenv import load_dotenv
load_dotenv()

from langfuse import Langfuse
langfuse = Langfuse()

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
    ("judgement", Judgement),
    ("defendants", Defendants),
    ("trials", Trials),
]

os.chdir(os.path.dirname(os.path.abspath(__file__)))
client = openai.OpenAI(
    base_url=os.getenv("OPENAI_BASE_URL"),
)

@observe(name="extract_feature.callLLM")
def callLLM(schema_name, schema_model, case_txt, judgement_type, output_path):
    langfuse.update_current_trace(
        input={"schema_name": schema_name, "judgement_type": judgement_type}
    )
    parent_trace_id = None
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            error_context = ""
            if last_error:
                error_context = f"\n\nPrevious attempt failed with error: {last_error}. Please try again carefully."

            response = client.responses.parse(
                name = f"{schema_name}-feature-extraction-{attempt + 1}",
                model="gpt-5-mini",
                instructions=f"Extract {schema_name} according to the provided schema. "
                "If a feature is not mentioned in the case, set the corresponding field to null, but check the case text thoroughly."
                + error_context,
                input=case_txt,
                reasoning={"effort": "medium", "summary": "detailed"},
                text_format=schema_model,
                metadata={
                    "judgement_type": judgement_type,
                    "schema_name": schema_name,
                    "attempt": str(attempt + 1),
                },
            )

            if not parent_trace_id:
                parent_trace_id = langfuse.get_current_trace_id()

            langfuse.update_current_trace(
                output={"extracted_data": response.output_parsed.model_dump_json(indent=2)}
            )

            with open(output_path, "w") as f:
                output_dict = response.output_parsed.model_dump(mode="json")
                output_dict["tracing_id"] = parent_trace_id
                f.write(json.dumps(output_dict, indent=2, ensure_ascii=False))
            break  # Success, exit retry loop

        except (OpenAIError, ValidationError) as e:
            if isinstance(e, ValidationError):
                last_error = str(e)
            if attempt == MAX_RETRIES - 1:
                print(
                    f"Failed to extract {schema_name} for {judgement_type} after {MAX_RETRIES} attempts: {last_error}"
                )
                raise

for judgement_type in tqdm(judgement_types, desc="Judgement Types"):
    os.makedirs(f"schema/exampleOutput/{judgement_type}", exist_ok=True)

    # Load case file
    if judgement_type in  ["corrigendum", "appeal"]:
        if judgement_type == "corrigendum":
            judgement_path_1 = os.path.join(
                judgement_base_path, "case-with-corrigendum.htm"
            )
            judgement_path_2 = os.path.join(judgement_base_path, "corrigendum.htm")
        else:
            judgement_path_1 = os.path.join(judgement_base_path, "appeal.htm")
            judgement_path_2 = os.path.join(judgement_base_path, "appeal-from.htm")

        with open(judgement_path_1, "r") as f:
            case_html = BeautifulSoup(f.read(), "html.parser")
        with open(judgement_path_2, "r") as f:
            case_html_2 = BeautifulSoup(f.read(), "html.parser")
        case_txt = (
            html_to_text_with_tables(case_html)
            + html_to_text_with_tables(case_html_2)
        )
    else:
        judgement_path = os.path.join(judgement_base_path, judgement_type + ".htm")
        with open(judgement_path, "r") as f:
            case_html = BeautifulSoup(f.read(), "html.parser")
        case_txt = html_to_text_with_tables(case_html)

    case_txt = re.sub(r"\n\s*\n", "\n\n", case_txt)  # Remove excessive newlines
    case_txt = case_txt.strip()
    # print(case_txt)
    
    # Extract features
    for schema_name, schema_model in tqdm(schemas, desc="Schemas", leave=False):
        output_path = f"schema/exampleOutput/{judgement_type}/{schema_name}.json"

        if not RERUN_ALL and os.path.exists(output_path):
            continue
        
        callLLM(schema_name, schema_model, case_txt, judgement_type, output_path)
        langfuse.flush()

# Flush Langfuse to ensure all traces are sent
langfuse.flush()