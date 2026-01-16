import os
from openai import OpenAI

from schema import CaseBasics, DefendantProfile, SentenceDetail

from dotenv import load_dotenv
load_dotenv()

schemas = [
    ("caseBasics", CaseBasics),
    ("defendantProfile", DefendantProfile),
    ("sentenceDetail", SentenceDetail),
]

os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Load case file
with open("sampleCase.txt", "r") as f:
    case = f.read()

client = OpenAI(
    base_url=os.getenv("OPENAI_BASE_URL"),
)

for schema_name, schema_model in schemas:
    response = client.responses.parse(
        model="gpt-5-mini",
        instructions=f"Extract {schema_name} according to the provided schema.",
        input=case,
        reasoning={
            "effort": "low"
        },
        text_format=schema_model
    )

    with open(f"schema/exampleOutput/{schema_name}.json", "w") as f:
        f.write(response.output_parsed.model_dump_json(indent=2))