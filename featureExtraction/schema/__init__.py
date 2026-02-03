from .judgement import Judgement
from .defendants import Defendants
from .trials import Trials
from .common import source_field, SOURCE_FIELD_DESCRIPTION

class Schema:
    Judgement = Judgement
    Defendants = Defendants
    Trials = Trials

__all__ = [
    "Judgement",
    "Defendants",
    "Trials",
    "source_field",
    "SOURCE_FIELD_DESCRIPTION",
    "Schema",
]

export_classes = __all__
