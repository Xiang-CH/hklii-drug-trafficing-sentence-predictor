# Agent Guidelines

This is a monorepo for the drug sentencing predictor project, containing multiple packages for different purposes. Each package has its own AGENTS.md with specific guidelines. Please cd into the relevant package directory to find the appropriate guidelines.

If your are working on:
- **Feature Extraction**: Refer to `featureExtraction/AGENTS.md`
    This is the python package responsible for extracting structured data from HK court judgments using LLMs. It defines the data schema and extraction logic.

- **Feature Verification**: Refer to `featureVerification/AGENTS.md`
    This is the Tanstack app for verifying and correcting the extracted data. It provides a UI for human annotators to review and edit the data, which is then stored in MongoDB.