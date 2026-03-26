import json
import os
from typing import Any

from langfuse import Langfuse, observe
from openai import OpenAI
from openai._exceptions import OpenAIError
from pydantic import ValidationError
from tqdm import tqdm

from schema import Defendants, Judgement, Trials

from .config import MAX_RETRIES, MODEL
from .prompts import EXTRACTION_ORDER, SCHEMA_CONFIGS

ExtractionModel = Judgement | Defendants | Trials


def _build_prompt(schema_name: str, previous_extractions: dict[str, Any] | None) -> str:
    base_prompt = SCHEMA_CONFIGS[schema_name]["prompt"]

    if schema_name == "defendants" and previous_extractions is not None:
        return base_prompt.format(
            defendant_ids_and_names="\n".join(
                [f"{d.id}. {d.name}" for d in previous_extractions["defendants"]]
            )
        )

    if schema_name == "trials" and previous_extractions is not None:
        charge_to_defendants_list: list[str] = []
        for charge in previous_extractions["charge_to_defendants"]:
            charge_to_defendants_list.append(
                f"Charge {charge.charge_no}. {charge.charge_name}"
            )
            for defendant in charge.defendants_of_charge:
                charge_to_defendants_list.append(
                    f"  -> On Defendant {defendant.defendant_id}: {defendant.defendant_name}"
                )
        return base_prompt.format(
            charge_to_defendants="\n".join(charge_to_defendants_list)
        )

    return base_prompt


@observe(name="extract_single_schema")
def extract_single_schema(
    schema_name: str,
    case_txt: str,
    judgement_type: str,
    output_path: str,
    client: OpenAI,
    langfuse: Langfuse,
    previous_extractions: dict[str, Any] | None = None,
) -> ExtractionModel:
    config = SCHEMA_CONFIGS[schema_name]
    schema_model = config["model"]

    last_error: str | None = None
    for attempt in range(MAX_RETRIES):
        try:
            error_context = ""
            if last_error:
                error_context = (
                    "\n\nPrevious attempt failed with error: "
                    f"{last_error}. Please try again carefully."
                )

            response = client.responses.parse(
                name=f"{schema_name}-extraction-{attempt + 1}",
                model=MODEL,
                input=[
                    {
                        "role": "system",
                        "content": _build_prompt(schema_name, previous_extractions),
                    },
                    {
                        "role": "user",
                        "content": case_txt + error_context,
                    },
                ],
                text_format=schema_model,
                metadata={
                    "judgement_type": judgement_type,
                    "schema_name": schema_name,
                    "attempt": str(attempt + 1),
                },
            )

            if response.output_parsed is None:
                if hasattr(response, "refusal") and response.refusal:
                    raise ValueError(
                        f"Model refused to generate output: {response.refusal}"
                    )

                raw_output = getattr(response, "output_text", None) or getattr(
                    response, "output", None
                )
                raise ValueError(f"Failed to parse response. Raw output: {raw_output}")

            output_dict = response.output_parsed.model_dump(mode="json")

            with open(output_path, "w") as file:
                output_dict_with_trace = output_dict.copy()
                output_dict_with_trace["tracing_id"] = langfuse.get_current_trace_id()
                file.write(
                    json.dumps(output_dict_with_trace, indent=2, ensure_ascii=False)
                )

            return response.output_parsed
        except (OpenAIError, ValidationError, ValueError) as exc:
            last_error = str(exc)
            if attempt == MAX_RETRIES - 1:
                print(
                    f"Failed to extract {schema_name} for {judgement_type} after {MAX_RETRIES} attempts: {last_error}"
                )
                raise

    raise RuntimeError(f"Failed to extract {schema_name}.")


@observe(name="extract_all_features")
def extract_all_features(
    case_txt: str,
    judgement_type: str,
    client: OpenAI,
    langfuse: Langfuse,
) -> tuple[Judgement, Defendants, Trials, str | None]:
    langfuse.update_current_trace(
        input={"judgement_type": judgement_type, "model": MODEL},
        tags=["feature-extraction"],
    )

    previous_extractions: dict[str, Any] = {}
    extracted_by_schema: dict[str, ExtractionModel] = {}

    for schema_name in tqdm(EXTRACTION_ORDER, desc="Schemas", leave=False):
        extracted_data = extract_single_schema(
            schema_name=schema_name,
            case_txt=case_txt,
            judgement_type=judgement_type,
            output_path=os.devnull,
            client=client,
            langfuse=langfuse,
            previous_extractions=previous_extractions if previous_extractions else None,
        )
        extracted_by_schema[schema_name] = extracted_data

        if schema_name == "judgement":
            previous_extractions["defendants"] = extracted_data.defendants
            previous_extractions["charge_to_defendants"] = extracted_data.charges

    langfuse.update_current_trace(
        output={"schemas_extracted": list(previous_extractions.keys())}
    )

    return (
        extracted_by_schema["judgement"],
        extracted_by_schema["defendants"],
        extracted_by_schema["trials"],
        langfuse.get_current_trace_id(),
    )
