from datetime import datetime, timezone
from uuid import uuid4

import pytest

from core.errors import UnprocessableEntityError
from domain.finance.schemas import TransactionData
from service.finance.voice import VoiceService, matching_expense_transaction_ids


class FakeVoiceGateway:
    def __init__(self, transcript, payload):
        self.transcript = transcript
        self.payload = payload
        self.calls = []

    def transcribe(self, content, filename, content_type):
        self.calls.append((content, filename, content_type))
        return self.transcript

    def extract_transaction(self, transcript, now):
        assert transcript == self.transcript
        return self.payload


def test_voice_creates_unconfirmed_normalized_transaction():
    account_id = uuid4()
    gateway = FakeVoiceGateway("Вчера купил продукты в Пятерочке за 450 рублей", {
        "amount_minor": -45000,
        "occurred_at": "2026-09-19T18:30:00+03:00",
        "merchant": "Пятерочка",
        "description": "Покупка продуктов",
        "category": "groceries",
    })
    preview = VoiceService(gateway, now=lambda: datetime(2026, 9, 20, tzinfo=timezone.utc)).preview(
        b"audio", "operation.webm", "audio/webm", account_id)
    assert preview.transcript == gateway.transcript
    assert preview.transaction.account_id == account_id
    assert preview.transaction.amount_minor == -45000
    assert preview.transaction.source == "voice"
    assert preview.requires_confirmation
    assert preview.transaction.external_id.startswith("voice:")


def test_voice_rejects_invalid_model_json_before_import():
    gateway = FakeVoiceGateway("что-то", {"amount_minor": 0, "occurred_at": "not-a-date"})
    with pytest.raises(UnprocessableEntityError, match="invalid transaction"):
        VoiceService(gateway).preview(b"audio", "operation.ogg", "audio/ogg", uuid4())


def test_voice_rejects_empty_transcript():
    gateway = FakeVoiceGateway("  ", {})
    with pytest.raises(UnprocessableEntityError, match="speech"):
        VoiceService(gateway).preview(b"audio", "operation.ogg", "audio/ogg", uuid4())


def test_voice_matches_only_nearby_expenses_with_the_same_amount():
    account_id, matching_id, wrong_amount_id, wrong_date_id = uuid4(), uuid4(), uuid4(), uuid4()
    preview = VoiceService(FakeVoiceGateway("купил продукты", {
        "amount_minor": -45000,
        "occurred_at": "2026-09-19T18:30:00+03:00",
        "description": "Покупка продуктов",
    })).preview(b"audio", "operation.ogg", "audio/ogg", account_id)
    transactions = [
        TransactionData(id=matching_id, external_id="bank-match", account_id=account_id, amount_minor=-45000,
                        occurred_at="2026-09-18T18:30:00+03:00", merchant="Пятерочка"),
        TransactionData(id=wrong_amount_id, external_id="bank-amount", account_id=account_id, amount_minor=-44000,
                        occurred_at="2026-09-19T18:30:00+03:00"),
        TransactionData(id=wrong_date_id, external_id="bank-date", account_id=account_id, amount_minor=-45000,
                        occurred_at="2026-09-10T18:30:00+03:00"),
    ]

    assert matching_expense_transaction_ids(preview.transaction, transactions) == [matching_id]
