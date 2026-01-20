# Judgement Feature Extraction for Drug Trafficking Cases

This repository contains code and documentation for extracting structured features from drug trafficking court case documents.

## Directory Structure

```
featureExtraction/
├── README.md
├── schema/             # Pydantic schema definitions for feature extraction
├── sampleJudgments/    # Sample judgment HTML files for testing
├── testSchemas.py      # Example code for LLM schema validation
└── pyproject.toml      # Project configuration and dependencies
``` 

## Getting Started
Initialize the environment using [uv](https://docs.astral.sh/uv/):
```bash
uv sync
```

Before commiting changes, ensure code formatting and linting by running:
```bash
uv run ruff format .
uv run ruff check .
```

## Using the Schemas
To use the feature extraction schemas, navigate to the `schema` directory and refer to the `README.md` file for detailed information on each schema and its fields.

To run the example code for schema validation:
```bash
export OPENAI_API_KEY="your-api-key"
export OPENAI_BASE_URL="your-openai-base-url"
uv run testSchemas.py
```
