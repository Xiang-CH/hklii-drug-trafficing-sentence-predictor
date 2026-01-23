from openai.types.responses import Response

def extractReasoningSummary(response: Response) -> str:
    return "\n".join(["\n".join([s.text for s in o.summary if s.type == "summary_text"]) for o in response.output if o.type == "reasoning"])