from pydantic import Field

# Shared source field description template
# Update this to change the source field description across all schema models
SOURCE_FIELD_DESCRIPTION = (
    "The exact match source text from which the {field_context} was extracted. "
    "Do not include any additional information in the source document."
)


def source_field(field_context: str = "data") -> Field:
    """
    Create a source field with a consistent description across all schema models.

    Args:
        field_context: Description of what data was extracted (e.g., "date", "nationality", "drug type and quantity")

    Returns:
        A Pydantic Field configured with the standard source field description
    """
    return Field(
        description=SOURCE_FIELD_DESCRIPTION.format(field_context=field_context)
    )
