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

from langfuse import Langfuse
from dotenv import load_dotenv

load_dotenv()
langfuse = Langfuse()

RERUN_ALL = False
MAX_RETRIES = 5

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

# Define schemas with their specific prompts in sequence order
SCHEMA_CONFIGS = {
    "judgement": {
        "model": Judgement,
        "prompt": (
            "Extract the judgement metadata according to the provided schema. "
            "There may be multiple charges in a single defendant; single charge for multiple defendants; "
            "or multiple charges for multiple defendants; etc. So ensure to capture all charges and link them to the correct defendants. "
            "If a feature is not mentioned in the case, set the corresponding field to null, "
            "but check the case text thoroughly."
        ),
    },
    "defendants": {
        "model": Defendants,
        "prompt": (
            "Extract all defendant information according to the provided schema. "
            "Here are the list of defendant ids and names: \n{defendant_ids_and_names}.\n\n "
            "If a feature is not mentioned in the case, set the corresponding field to null, "
            "but check the case text thoroughly."
        ),
    },
    "trials": {
        "model": Trials,
        "prompt": (
            "Extract all trial information according to the provided schema. "
            "You need to extract the information for each charge to defendant pair separately. "
            "Here are the list of charge to defendant mappings extracted from the judgement: \n{charge_to_defendants}.\n\n "
            "If a feature is not mentioned in the case, set the corresponding field to null, "
            "but check the case text thoroughly."
        ),
    },
}

# Extraction order - each can use context from previous extractions
EXTRACTION_ORDER = ["judgement", "defendants", "trials"]

os.chdir(os.path.dirname(os.path.abspath(__file__)))
client = openai.OpenAI(
    base_url=os.getenv("OPENAI_BASE_URL"),
)


@observe(name="extract_single_schema")
def extract_single_schema(
    schema_name: str,
    case_txt: str,
    judgement_type: str,
    output_path: str,
    previous_extractions: dict[str, dict] | None = None,
) -> Judgement | Defendants | Trials:
    """Extract a single schema, optionally using context from previous extractions."""
    config = SCHEMA_CONFIGS[schema_name]
    schema_model = config["model"]
    base_prompt = config["prompt"]

    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            error_context = ""
            if last_error:
                error_context = f"\n\nPrevious attempt failed with error: {last_error}. Please try again carefully."

            full_input = case_txt + error_context

            if schema_name == "defendants":
                base_prompt = base_prompt.format(
                    defendant_ids_and_names="\n".join(
                        [f"{d[0]}. {d[1]}" for d in previous_extractions["defendants"]]
                    )
                )
            elif schema_name == "trials":
                charge_to_defendants_list = []
                for charge in previous_extractions["charge_to_defendants"]:
                    charge_to_defendants_list.append(
                        f"Charge {charge.charge_no}. {charge.charge_name}"
                    )
                    for defendant in charge.defendants_of_charge:
                        charge_to_defendants_list.append(
                            f"  -> On Defendant {defendant.defendant_id}: {defendant.defendant_name}"
                        )
                base_prompt = base_prompt.format(
                    charge_to_defendants="\n".join(charge_to_defendants_list)
                )

            response = client.responses.parse(
                name=f"{schema_name}-extraction-{attempt + 1}",
                model="gpt-5-mini",
                instructions=base_prompt,
                input=full_input,
                reasoning={"effort": "low", "summary": "detailed"},
                text_format=schema_model,
                metadata={
                    "judgement_type": judgement_type,
                    "schema_name": schema_name,
                    "attempt": str(attempt + 1),
                },
            )

            # Check if parsing succeeded
            if response.output_parsed is None:
                # Check for refusal
                if hasattr(response, "refusal") and response.refusal:
                    raise ValueError(
                        f"Model refused to generate output: {response.refusal}"
                    )
                # Check raw output for debugging
                raw_output = getattr(response, "output_text", None) or getattr(
                    response, "output", None
                )
                raise ValueError(f"Failed to parse response. Raw output: {raw_output}")

            output_dict = response.output_parsed.model_dump(mode="json")

            with open(output_path, "w") as f:
                output_dict_with_trace = output_dict.copy()
                output_dict_with_trace["tracing_id"] = langfuse.get_current_trace_id()
                f.write(
                    json.dumps(output_dict_with_trace, indent=2, ensure_ascii=False)
                )

            return response.output_parsed  # Return for use in subsequent extractions

        except (OpenAIError, ValidationError) as e:
            # print(f"Attempt {attempt + 1} failed for {schema_name}: {str(e)}")
            if isinstance(e, ValidationError):
                last_error = str(e)
            if attempt == MAX_RETRIES - 1:
                print(
                    f"Failed to extract {schema_name} for {judgement_type} after {MAX_RETRIES} attempts: {last_error}"
                )
                raise

    return {}


@observe(name="extract_all_features")
def extract_all_features(case_txt: str, judgement_type: str, output_dir: str) -> None:
    """Extract all features in sequence, passing context between extractions."""
    langfuse.update_current_trace(
        input={"judgement_type": judgement_type},
        tags=["feature-extraction"],
    )

    previous_extractions: dict[str, dict] = {}

    for schema_name in tqdm(EXTRACTION_ORDER, desc="Schemas", leave=False):
        output_path = f"{output_dir}/{schema_name}.json"

        # Extract with context from previous extractions
        extracted_data = extract_single_schema(
            schema_name=schema_name,
            case_txt=case_txt,
            judgement_type=judgement_type,
            output_path=output_path,
            previous_extractions=previous_extractions if previous_extractions else None,
        )

        # Store for use in subsequent extractions
        if schema_name == "judgement":
            previous_extractions["defendants"] = extracted_data.defendants
            previous_extractions["charge_to_defendants"] = extracted_data.charges

    langfuse.update_current_trace(
        output={"schemas_extracted": list(previous_extractions.keys())}
    )


for judgement_type in tqdm(judgement_types, desc="Judgement Types"):
    output_dir = f"schema/exampleOutput/{judgement_type}"
    os.makedirs(output_dir, exist_ok=True)

    # Skip if all outputs already exist and not rerunning all
    if not RERUN_ALL:
        all_outputs_exist = all(
            os.path.exists(f"{output_dir}/{schema_name}.json")
            for schema_name in EXTRACTION_ORDER
        )
        if all_outputs_exist:
            continue

    # Load case file
    if judgement_type in ["corrigendum", "appeal"]:
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
        case_txt = html_to_text_with_tables(case_html) + html_to_text_with_tables(
            case_html_2
        )
    else:
        judgement_path = os.path.join(judgement_base_path, judgement_type + ".htm")
        with open(judgement_path, "r") as f:
            case_html = BeautifulSoup(f.read(), "html.parser")
        case_txt = html_to_text_with_tables(case_html)

    case_txt = re.sub(r"\n\s*\n", "\n\n", case_txt)  # Remove excessive newlines
    case_txt = case_txt.strip()

    # Extract all features in sequence within a single trace
    extract_all_features(case_txt, judgement_type, output_dir)
    langfuse.flush()

# Flush Langfuse to ensure all traces are sent
langfuse.flush()
