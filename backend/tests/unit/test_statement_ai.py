from uuid import uuid4

import pytest

from core.errors import UnprocessableEntityError
from service.finance.statement_ai import DSLabStatementAiGateway, StatementAiService
from service.finance.statements import parse_tbank_text
from tests.unit.test_statements import FOOTER, HEADER, ROW


class Gateway:
    def __init__(self, result):
        self.result = result
        self.batches = []

    def classify(self, transactions):
        self.batches.append(transactions)
        return self.result


def test_statement_ai_returns_valid_suggestions_without_persisting_statement_data():
    statement = parse_tbank_text(HEADER + ROW + FOOTER, uuid4())
    gateway = Gateway([{
        "external_id": statement.transactions[1].external_id,
        "kind": "expense",
        "category": "groceries",
        "confidence": 0.92,
        "reason": "Merchant is a grocery store.",
    }])

    preview = StatementAiService(gateway).preview(statement)

    assert preview.requires_confirmation
    assert preview.suggestions[0].category == "groceries"
    sent = gateway.batches[0][0]
    assert "account_id" not in sent
    assert "card_last4" not in sent
    assert "counterparty" not in sent


def test_statement_ai_rejects_suggestion_for_unknown_transaction():
    statement = parse_tbank_text(HEADER + ROW + FOOTER, uuid4())
    gateway = Gateway([{
        "external_id": "not-from-statement", "kind": "expense", "confidence": 0.9, "reason": "Invalid",
    }])

    with pytest.raises(UnprocessableEntityError, match="unknown transaction"):
        StatementAiService(gateway).preview(statement)


def test_statement_ai_rejects_unknown_related_transaction():
    statement = parse_tbank_text(HEADER + ROW + FOOTER, uuid4())
    gateway = Gateway([{
        "external_id": statement.transactions[0].external_id, "kind": "refund", "confidence": 0.9,
        "reason": "Invalid relation", "related_external_id": "not-from-statement",
    }])

    with pytest.raises(UnprocessableEntityError, match="unknown transaction"):
        StatementAiService(gateway).preview(statement)


def test_dslab_statement_gateway_sends_normalized_json_and_reads_json_response():
    class Responses:
        def create(self, **kwargs):
            self.kwargs = kwargs
            return type("Response", (), {"output_text": '[{"external_id":"tx-1","kind":"expense","confidence":0.9,"reason":"Purchase"}]'})()

    responses = Responses()
    client = type("Client", (), {"responses": responses})()
    gateway = DSLabStatementAiGateway("test-key", "https://api.dslab.tech/v1", "gemini-3.7-flash", client=client)

    assert gateway.classify([{"external_id": "tx-1", "amount_minor": -5000}])[0]["external_id"] == "tx-1"
    assert responses.kwargs["model"] == "gemini-3.7-flash"
    assert '"amount_minor": -5000' in responses.kwargs["input"]
