import re
from collections import defaultdict
from datetime import timedelta
from uuid import uuid5

from sqlalchemy import select

from core.errors import ConflictError, NotFoundError, UnprocessableEntityError
from database.relational_db.tables.finance import MarketplaceOrder
from domain.finance.marketplaces import IntegrationView, OrderImportResult, OrderView

PROVIDERS = {"ozon": "Ozon", "wildberries": "Wildberries", "yandex_market": "Яндекс Маркет"}


def detect_marketplace(text):
    text = text.casefold()
    if re.search(r"\b(ozon|озон)\b", text):
        return "ozon"
    if re.search(r"\b(wildberries|вайлдберриз|вб)\b|\bwb\.ru\b", text):
        return "wildberries"
    if re.search(r"yandex\*5399\*market|яндекс\s*маркет|yandex\s*market", text):
        return "yandex_market"
    return None


def enrich_events(events, orders):
    by_tx = {str(c.transaction_id): (e, c) for e in events for c in e.contributions}
    for order in orders:
        pair = by_tx.get(str(order["transaction_id"]))
        if not pair:
            continue
        e, c = pair
        # Refunds/shared changes must retain their accounting; do not overwrite their impacts.
        if e.type != "expense" or len(e.contributions) != 1:
            continue
        allocations = defaultdict(int)
        for item in order["items"]:
            allocations[item["category"]] += item["total_minor"]
        if sum(allocations.values()) != c.expense_minor:
            continue
        c.category_allocations = dict(allocations)
        if len(allocations) == 1:
            c.category = e.category = next(iter(allocations))
        e.marketplace_orders.append(order)


class MarketplaceService:
    def __init__(self, finance):
        self.finance = finance
        self.session = finance.session

    async def rows(self):
        return list((await self.session.scalars(select(MarketplaceOrder).where(
            MarketplaceOrder.user_id == self.finance.user_id).order_by(MarketplaceOrder.id))).all())

    async def list_orders(self):
        transactions = await self.finance.transactions()
        events = await self.finance.events()
        expenses = {e.id for e in events if e.type == "expense" and len(e.contributions) == 1}
        rows = await self.rows()
        used = {r.transaction_id for r in rows if r.transaction_id}
        result = []
        for row in rows:
            view = OrderView(**row.payload, id=row.id, marketplace=row.marketplace,
                             transaction_id=row.transaction_id, status="matched" if row.transaction_id else "unmatched")
            if not row.transaction_id:
                view.candidate_transaction_ids = [t.id for t in transactions if t.id in expenses and t.id not in used
                    and -t.amount_minor == view.paid_minor
                    and abs(t.occurred_at - view.purchased_at) <= timedelta(days=7)
                    and detect_marketplace(f"{t.merchant or ''} {t.description}") == row.marketplace]
            result.append(view)
        return result

    async def integrations(self):
        rows = await self.rows()
        return [IntegrationView(code=key, name=name, imported_orders_count=sum(r.marketplace == key for r in rows),
                linked_orders_count=sum(r.marketplace == key and r.transaction_id is not None for r in rows)) for key, name in PROVIDERS.items()]

    async def import_orders(self, provider, orders):
        await self.finance.lock()
        existing = {(r.marketplace, r.external_id): r for r in await self.rows()}
        imported = duplicates = 0
        for order in orders:
            key = (provider, order.external_id)
            payload = order.model_dump(mode="json")
            if key in existing:
                if existing[key].payload != payload:
                    raise ConflictError("Order external_id already exists with different data")
                duplicates += 1
                continue
            row = MarketplaceOrder(id=uuid5(self.finance.user_id, f"order:{provider}:{order.external_id}"),
                user_id=self.finance.user_id, marketplace=provider, external_id=order.external_id, payload=payload)
            self.session.add(row)
            existing[key] = row
            imported += 1
        await self.session.flush()
        return OrderImportResult(imported_count=imported, duplicate_count=duplicates, orders=await self.list_orders())

    async def link(self, order_id, transaction_id):
        await self.finance.lock()
        rows = await self.rows()
        row = next((r for r in rows if r.id == order_id), None)
        if not row:
            raise NotFoundError("Order not found")
        if any(r.id != order_id and r.transaction_id == transaction_id for r in rows):
            raise ConflictError("Transaction is already linked to another order")
        event = next((e for e in await self.finance.events() if e.id == transaction_id), None)
        if not event or event.type != "expense" or len(event.contributions) != 1:
            raise UnprocessableEntityError("Select an owned, ungrouped purchase transaction")
        if event.expense_impact_minor != row.payload["paid_minor"]:
            raise UnprocessableEntityError("Order total must exactly match the bank purchase")
        row.transaction_id = transaction_id
        await self.session.flush()
        await self.finance.rebuild()
        return next(o for o in await self.list_orders() if o.id == order_id)
