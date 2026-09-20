import base64
import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Protocol
from uuid import UUID

from pydantic import ValidationError

from core.errors import UnprocessableEntityError
from domain.finance.schemas import Category, Contract, Money, TransactionData, TransactionInput, VoicePreview


class VoiceGateway(Protocol):
    def transcribe(self, content: bytes, filename: str, content_type: str) -> str: ...

    def extract_transaction(self, transcript: str, now: datetime) -> dict: ...


class DSLabVoiceGateway:
    """OpenAI-compatible gateway; the finance service never sends bank statements to it."""

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
                raise RuntimeError("Install the openai package to enable voice input") from exc
            self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        return self._client

    def transcribe(self, content: bytes, filename: str, content_type: str) -> str:
        extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else content_type.removeprefix("audio/")
        response = self.client.responses.create(
            model=self.model,
            input=[{"role": "user", "content": [
                {"type": "input_text", "text": "Transcribe this Russian audio exactly. Return only the transcript."},
                {"type": "input_audio", "input_audio": {
                    "data": base64.b64encode(content).decode("ascii"), "format": extension,
                }},
            ]}],
        )
        return response.output_text

    def extract_transaction(self, transcript: str, now: datetime) -> dict:
        schema = {
            "type": "object", "additionalProperties": False,
            "properties": {
                "amount_minor": {"type": "integer", "description": "Signed Russian kopecks; expense is negative."},
                "occurred_at": {"type": "string", "description": "RFC3339 datetime with UTC offset."},
                "merchant": {"type": ["string", "null"]},
                "description": {"type": "string"},
                "category": {"type": ["string", "null"], "enum": ["groceries", "restaurants", "transport", "electronics", "household", "subscriptions", "health", "shopping", "cash", "other", None]},
            },
            "required": ["amount_minor", "occurred_at", "merchant", "description", "category"],
        }
        prompt = ("Extract one financial operation from the Russian transcript. Use only stated facts; do not invent. "
                  f"The current UTC time is {now.isoformat()}. Return the required JSON.\nTranscript: {transcript}")
        response = self.client.responses.create(
            model=self.model,
            input=prompt,
            text={"format": {"type": "json_schema", "name": "voice_transaction", "strict": True, "schema": schema}},
        )
        try:
            return json.loads(response.output_text)
        except (TypeError, json.JSONDecodeError) as exc:
            raise ValueError("Voice model did not return JSON") from exc


class VoiceExtraction(Contract):
    amount_minor: Money
    occurred_at: datetime
    merchant: str | None = None
    description: str = ""
    category: Category | None = None

    def to_transaction(self, account_id: UUID, content: bytes) -> TransactionInput:
        if self.amount_minor == 0:
            raise ValueError("Zero-value operations are not supported")
        digest = hashlib.sha256(content).hexdigest()[:24]
        return TransactionInput(
            external_id=f"voice:{digest}", account_id=account_id, amount_minor=self.amount_minor,
            occurred_at=self.occurred_at, merchant=self.merchant, description=self.description,
            category=self.category, source="voice")


class VoiceService:
    def __init__(self, gateway: VoiceGateway, now=lambda: datetime.now(timezone.utc)):
        self.gateway = gateway
        self.now = now

    def preview(self, content: bytes, filename: str, content_type: str, account_id: UUID) -> VoicePreview:
        if not content:
            raise UnprocessableEntityError("Audio file is empty")
        transcript = self.gateway.transcribe(content, filename, content_type).strip()
        if not transcript:
            raise UnprocessableEntityError("No speech was recognized")
        try:
            extraction = VoiceExtraction.model_validate(self.gateway.extract_transaction(transcript, self.now()))
            transaction = extraction.to_transaction(account_id, content)
        except (TypeError, ValidationError, ValueError) as exc:
            raise UnprocessableEntityError("Voice model returned invalid transaction JSON") from exc
        return VoicePreview(transcript=transcript, transaction=transaction)


def matching_expense_transaction_ids(transaction: TransactionInput, transactions: list[TransactionData]) -> list[UUID]:
    candidates = [item for item in transactions if item.account_id == transaction.account_id
                  and item.amount_minor == transaction.amount_minor < 0
                  and abs(item.occurred_at - transaction.occurred_at) <= timedelta(days=3)]
    return [item.id for item in sorted(candidates, key=lambda item: abs(item.occurred_at - transaction.occurred_at))]
