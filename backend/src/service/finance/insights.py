import json
from typing import Protocol

from pydantic import ValidationError

from core.errors import UnprocessableEntityError
from domain.finance.schemas import Analytics, Contract, SpendingAdvice, SpendingInsight


class InsightGateway(Protocol):
    def advise(self, facts: dict) -> dict: ...


class InsightPayload(Contract):
    insights: list[SpendingInsight]


class DSLabInsightGateway:
    def __init__(self, api_key: str, base_url: str, model: str, client=None):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self._client = client

    @property
    def client(self):
        if self._client is None:
            try:
                from openai import OpenAI
            except ImportError as exc:  # pragma: no cover - configuration error outside unit tests
                raise RuntimeError("Install the openai package to enable spending insights") from exc
            self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        return self._client

    def advise(self, facts: dict) -> dict:
        schema = {
            "type": "object", "additionalProperties": False,
            "properties": {
                "insights": {"type": "array", "minItems": 1, "maxItems": 5, "items": {
                    "type": "object", "additionalProperties": False,
                    "properties": {
                        "title": {"type": "string"}, "message": {"type": "string"},
                        "category": {"type": ["string", "null"], "enum": ["groceries", "restaurants", "transport", "electronics", "household", "subscriptions", "health", "shopping", "cash", "other", None]},
                        "action": {"type": "string"},
                    },
                    "required": ["title", "message", "category", "action"],
                }},
            },
            "required": ["insights"],
        }
        prompt = ("You provide concise, practical Russian spending suggestions. Use only the supplied aggregate facts. "
                  "Do not claim access to individual transactions, do not invent numbers, do not give investment advice, "
                  "and do not recommend borrowing. Return the required JSON.\nFacts:\n" + json.dumps(facts, ensure_ascii=False))
        response = self.client.responses.create(
            model=self.model,
            input=prompt,
            text={"format": {"type": "json_schema", "name": "spending_advice", "strict": True, "schema": schema}},
        )
        try:
            return json.loads(response.output_text)
        except (TypeError, json.JSONDecodeError) as exc:
            raise ValueError("Insight model did not return JSON") from exc


class SpendingInsightService:
    def __init__(self, gateway: InsightGateway):
        self.gateway = gateway

    def generate(self, report: Analytics) -> SpendingAdvice:
        facts = {
            "summary": report.summary.model_dump(mode="json"),
            "comparison": report.comparison.model_dump(mode="json"),
            "timeline": [point.model_dump(mode="json") for point in report.summary.timeline],
        }
        try:
            payload = InsightPayload.model_validate(self.gateway.advise(facts))
        except (TypeError, ValidationError, ValueError) as exc:
            raise UnprocessableEntityError("Insight model returned invalid JSON") from exc
        return SpendingAdvice(basis=report.summary, insights=payload.insights)
