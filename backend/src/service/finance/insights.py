import json
from datetime import date
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


def _rub(minor: int) -> str:
    return f"{round(minor / 100):,}".replace(",", "\u202f") + "\u202f₽"


MONTHS_GENITIVE = (
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
)


def _day(iso: str) -> str:
    try:
        parsed = date.fromisoformat(iso)
    except ValueError:
        return iso
    return f"{parsed.day} {MONTHS_GENITIVE[parsed.month - 1]}"


CATEGORY_TITLES = {
    "groceries": "продукты",
    "restaurants": "кафе и рестораны",
    "transport": "транспорт",
    "electronics": "технику",
    "household": "дом",
    "subscriptions": "подписки",
    "health": "здоровье",
    "shopping": "покупки",
    "cash": "наличные",
    "other": "прочее",
}


class RuleBasedInsightGateway:
    """Советы из уже посчитанных агрегатов, без обращения к модели.

    Используется, когда DSLab не настроен: числа берутся только из отчёта,
    ничего не выдумывается и не додумывается за пользователя.
    """

    def advise(self, facts: dict) -> dict:
        summary = facts.get("summary", {})
        comparison = facts.get("comparison", {})
        timeline = facts.get("timeline", [])

        expense = summary.get("real_expense_minor", 0)
        income = summary.get("real_income_minor", 0)
        categories = [row for row in summary.get("categories", []) if row.get("expense_minor", 0) > 0]
        categories.sort(key=lambda row: row["expense_minor"], reverse=True)

        insights: list[dict] = []

        change = comparison.get("expense_change_percent")
        if change is not None and expense > 0:
            delta = comparison.get("expense_delta_minor", 0)
            if change >= 15:
                insights.append({
                    "title": f"Траты выросли на {round(change)}%",
                    "message": f"За период потрачено {_rub(expense)}, это на {_rub(abs(delta))} больше прошлого периода.",
                    "category": None,
                    "action": "Сравните крупные покупки с прошлым периодом и решите, какие из них были разовыми.",
                })
            elif change <= -10:
                insights.append({
                    "title": f"Траты снизились на {round(abs(change))}%",
                    "message": f"Потрачено {_rub(expense)} против {_rub(comparison.get('previous_expense_minor', 0))} в прошлом периоде.",
                    "category": None,
                    "action": "Зафиксируйте, за счёт какой категории получилось сэкономить, и повторите в следующем месяце.",
                })

        if categories and expense > 0:
            top = categories[0]
            share = round(top["expense_minor"] / expense * 100)
            if share >= 30:
                name = CATEGORY_TITLES.get(top["category"], top["category"])
                insights.append({
                    "title": f"{share}% трат уходит на {name}",
                    "message": f"На эту категорию потрачено {_rub(top['expense_minor'])} из {_rub(expense)}.",
                    "category": top["category"],
                    "action": "Задайте себе недельный лимит по этой категории — остальные расходы трогать не придётся.",
                })

        subscriptions = next((row for row in categories if row["category"] == "subscriptions"), None)
        if subscriptions:
            insights.append({
                "title": "Подписки списываются молча",
                "message": f"За период на подписки ушло {_rub(subscriptions['expense_minor'])}.",
                "category": "subscriptions",
                "action": "Проверьте список активных подписок и отключите те, которыми не пользовались.",
            })

        cash = next((row for row in categories if row["category"] == "cash"), None)
        if cash and expense > 0 and cash["expense_minor"] / expense >= 0.1:
            insights.append({
                "title": "Наличные — слепая зона",
                "message": f"Снято {_rub(cash['expense_minor'])}: по ним не видно, на что ушли деньги.",
                "category": "cash",
                "action": "Записывайте крупные покупки за наличные сразу — остальное разберётся само.",
            })

        peak = max(timeline, key=lambda point: point.get("expense_minor", 0), default=None)
        if peak and peak.get("expense_minor", 0) > 0 and len(timeline) > 1:
            insights.append({
                "title": f"Самый дорогой день — {_day(peak['date'])}",
                "message": f"В этот день потрачено {_rub(peak['expense_minor'])}.",
                "category": None,
                "action": "Посмотрите события этого дня: разовые всплески обычно объясняются одной покупкой.",
            })

        if summary.get("needs_attention_count", 0) > 0:
            insights.append({
                "title": f"Ждут уточнения: {summary['needs_attention_count']}",
                "message": "Пока операции не разобраны, итог периода может измениться.",
                "category": None,
                "action": "Ответьте на вопросы в разделе «Нужно решить» — это один тап на операцию.",
            })

        if income > 0 and expense > 0:
            saved = income - expense
            if saved > 0:
                insights.append({
                    "title": f"Отложить можно {_rub(saved)}",
                    "message": f"Доход {_rub(income)} против трат {_rub(expense)}.",
                    "category": None,
                    "action": "Переведите часть разницы на накопительный счёт в день зарплаты.",
                })

        if not insights:
            insights.append({
                "title": "Данных пока мало",
                "message": f"За период учтено трат на {_rub(expense)}.",
                "category": None,
                "action": "Загрузите выписку за больший период, чтобы появилась динамика.",
            })

        return {"insights": insights[:5]}


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
