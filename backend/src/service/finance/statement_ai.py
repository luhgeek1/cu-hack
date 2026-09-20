import json
import re
from typing import Protocol

from pydantic import ValidationError

from core.errors import UnprocessableEntityError
from domain.finance.statements import StatementAiPreview, StatementAiSuggestion, StatementPreview


class StatementAiGateway(Protocol):
    def classify(self, transactions: list[dict]) -> list[dict]: ...


class DSLabStatementAiGateway:
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
                raise RuntimeError("Install the openai package to enable statement AI") from exc
            self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        return self._client

    def classify(self, transactions: list[dict]) -> list[dict]:
        schema = {
            "type": "array", "maxItems": len(transactions), "items": {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "external_id": {"type": "string"},
                    "kind": {"type": "string", "enum": ["expense", "income", "own_transfer", "marketplace_transfer", "debt_given", "debt_repayment", "shared_expense", "refund", "cash_withdrawal", "unknown"]},
                    "category": {"type": ["string", "null"], "enum": ["groceries", "restaurants", "transport", "electronics", "household", "subscriptions", "health", "shopping", "cash", "other", None]},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    "reason": {"type": "string"},
                    "related_external_id": {"type": ["string", "null"]},
                },
                "required": ["external_id", "kind", "category", "confidence", "reason", "related_external_id"],
            },
        }
        prompt = ("Classify the normalized Russian bank operations. Use only supplied facts. "
                  "Do not invent transactions, amounts, or compensation links. An empty array is valid when uncertain. "
                  "Return only JSON matching the schema.\nTransactions:\n" + json.dumps(transactions, ensure_ascii=False))
        response = self.client.responses.create(
            model=self.model,
            input=prompt,
            text={"format": {"type": "json_schema", "name": "statement_suggestions", "strict": True, "schema": schema}},
        )
        try:
            return json.loads(response.output_text)
        except (TypeError, json.JSONDecodeError) as exc:
            raise ValueError("Statement AI did not return JSON") from exc


class StatementAiService:
    def __init__(self, gateway: StatementAiGateway, batch_size: int = 100):
        self.gateway = gateway
        self.batch_size = batch_size

    def preview(self, statement: StatementPreview) -> StatementAiPreview:
        known_ids = {transaction.external_id for transaction in statement.transactions}
        suggestions = []
        for start in range(0, len(statement.transactions), self.batch_size):
            batch = [_safe_transaction(transaction) for transaction in statement.transactions[start:start + self.batch_size]]
            try:
                suggestions.extend(StatementAiSuggestion.model_validate(item) for item in self.gateway.classify(batch))
            except (TypeError, ValidationError, ValueError) as exc:
                raise UnprocessableEntityError("Statement AI returned invalid JSON") from exc
        unknown_ids = ({suggestion.external_id for suggestion in suggestions}
                       | {suggestion.related_external_id for suggestion in suggestions if suggestion.related_external_id}) - known_ids
        if unknown_ids:
            raise UnprocessableEntityError("Statement AI suggested an unknown transaction")
        return StatementAiPreview(statement=statement, suggestions=suggestions)


def _safe_transaction(transaction) -> dict:
    def redact(value):
        return re.sub(r"(?:\+7\d{10}|\b\d{10,20}\b)", "[redacted]", value or "")

    return {
        "external_id": transaction.external_id,
        "amount_minor": transaction.amount_minor,
        "occurred_at": transaction.occurred_at.isoformat(),
        "posted_at": transaction.posted_at.isoformat() if transaction.posted_at else None,
        "description": redact(transaction.description),
        "merchant": redact(transaction.merchant),
        "category": transaction.category,
    }
