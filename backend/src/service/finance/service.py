from collections import defaultdict
from datetime import date, datetime, timezone
from uuid import uuid5
from zoneinfo import ZoneInfo

from sqlalchemy import delete, insert, select
from starlette.concurrency import run_in_threadpool

from core.errors import ConflictError, NotFoundError, UnprocessableEntityError
from database.relational_db.tables.finance import FinanceAccount, FinanceEvent, FinanceEventLink, FinanceTransaction
from database.relational_db.tables.users.users_table import User
from domain.finance.schemas import (
    AccountCreate, AccountData, AccountView, AttentionItem, BankView, Dashboard, Digest, EventDetail, FinancialEvent,
    GraphEdge, GraphNode, ImportResult, Resolution, ResolutionOption, ResolveResult, TransactionData, TransactionInput,
    VoiceConfirmation, VoiceConfirmationResult,
)
from service.finance.analytics import analytics, summarize
from service.finance.engine import reconstruct
from service.finance.providers import BANKS, MockBankProvider, demo_dataset


class FinanceService:
    def __init__(self, session, user_id):
        self.session = session
        self.user_id = user_id
        self._locked = False

    async def lock(self):
        if not self._locked:
            # Serializes import and resolve per user across workers, not just within one process.
            owner = await self.session.scalar(select(User.id).where(User.id == self.user_id).with_for_update())
            if owner is None:
                raise NotFoundError("User not found")
            self._locked = True

    async def accounts(self):
        rows = (await self.session.scalars(select(FinanceAccount).where(FinanceAccount.user_id == self.user_id)
                                          .order_by(FinanceAccount.bank, FinanceAccount.external_id))).all()
        amounts = defaultdict(int)
        for t in await self.transactions():
            amounts[t.account_id] += t.amount_minor
        amounts[uuid5(self.user_id, "account:cash:wallet")] += sum(e.cash_wallet_delta_minor for e in await self.events())
        return [AccountView(**AccountData.model_validate(a).model_dump(),
                            balance_minor=a.opening_balance_minor + amounts[a.id], last_synced_at=a.last_synced_at) for a in rows]

    async def create_account(self, payload, account_id=None):
        await self.lock()
        existing = await self.session.scalar(select(FinanceAccount).where(
            FinanceAccount.user_id == self.user_id, FinanceAccount.bank == payload.bank,
            FinanceAccount.external_id == payload.external_id))
        data = payload.model_dump(exclude={"id"})
        if existing:
            old = AccountData.model_validate(existing).model_dump(exclude={"id"})
            if old != data:
                raise ConflictError("Account already exists with different metadata")
            return AccountData.model_validate(existing)
        account = FinanceAccount(id=account_id or uuid5(self.user_id, f"account:{payload.bank}:{payload.external_id}"),
                                 user_id=self.user_id, **data)
        self.session.add(account)
        await self.session.flush()
        return AccountData.model_validate(account)

    async def transactions(self):
        rows = (await self.session.scalars(select(FinanceTransaction).where(FinanceTransaction.user_id == self.user_id)
                                          .order_by(FinanceTransaction.occurred_at, FinanceTransaction.id))).all()
        return [TransactionData(**r.payload, resolution=r.resolution) for r in rows]

    async def events(self):
        rows = (await self.session.scalars(select(FinanceEvent).where(FinanceEvent.user_id == self.user_id)
                                          .order_by(FinanceEvent.occurred_at, FinanceEvent.id))).all()
        return [FinancialEvent.model_validate(r.payload) for r in rows]

    async def rebuild(self):
        accounts = (await self.session.scalars(select(FinanceAccount).where(FinanceAccount.user_id == self.user_id))).all()
        try:
            events = reconstruct([AccountData.model_validate(a) for a in accounts], await self.transactions())
        except ValueError as exc:
            raise UnprocessableEntityError(str(exc)) from exc
        if any(e.cash_wallet_delta_minor for e in events):
            await self.create_account(AccountCreate(external_id="wallet", bank="cash", name="Кошелёк наличных", account_type="cash"))
        from service.finance.marketplaces import MarketplaceService, enrich_events
        orders = await MarketplaceService(self).rows()
        enrich_events(events, [{**r.payload, "id": str(r.id), "marketplace": r.marketplace,
                               "transaction_id": str(r.transaction_id)} for r in orders if r.transaction_id])
        own_events = select(FinanceEvent.id).where(FinanceEvent.user_id == self.user_id)
        await self.session.execute(delete(FinanceEventLink).where(FinanceEventLink.event_id.in_(own_events)))
        await self.session.execute(delete(FinanceEvent).where(FinanceEvent.user_id == self.user_id))
        if events:
            await self.session.execute(insert(FinanceEvent), [dict(id=e.id, user_id=self.user_id, type=e.type,
                status=e.status, occurred_at=e.occurred_at, payload=e.model_dump(mode="json")) for e in events])
            await self.session.execute(insert(FinanceEventLink), [dict(event_id=e.id, transaction_id=c.transaction_id,
                role=c.role, expense_minor=c.expense_minor, income_minor=c.income_minor) for e in events for c in e.contributions])
        return events

    async def import_transactions(self, transactions):
        await self.lock()
        accounts = (await self.session.scalars(select(FinanceAccount).where(FinanceAccount.user_id == self.user_id))).all()
        account_map = {a.id: a for a in accounts}
        if any(t.account_id not in account_map for t in transactions):
            raise NotFoundError("Account not found")
        existing = {(t.account_id, t.external_id): t for t in await self.transactions()}
        imported = duplicates = 0
        now = datetime.now(timezone.utc)
        for t in transactions:
            # Canonical UTC dates make equivalent +03:00 and Z imports idempotent.
            data = TransactionInput.model_validate(t.model_dump(exclude={"id", "resolution"}))
            data.occurred_at = data.occurred_at.astimezone(timezone.utc)
            key = (data.account_id, data.external_id)
            if key in existing:
                prior = existing[key].model_dump(exclude={"id", "resolution"})
                if prior != data.model_dump():
                    raise ConflictError(f"external_id already exists with different data: {data.external_id}")
                duplicates += 1
                continue
            item = TransactionData(id=uuid5(data.account_id, data.external_id), **data.model_dump())
            self.session.add(FinanceTransaction(id=item.id, user_id=self.user_id, account_id=item.account_id,
                external_id=item.external_id, occurred_at=item.occurred_at, amount_minor=item.amount_minor,
                payload=item.model_dump(mode="json", exclude={"resolution"}), resolution=None))
            existing[key] = item
            imported += 1
        for account_id in {t.account_id for t in transactions}:
            account_map[account_id].last_synced_at = now
        await self.session.flush()
        events = await self.rebuild()
        return ImportResult(imported_count=imported, duplicate_count=duplicates, event_count=len(events),
                            needs_attention_count=sum(e.status == "needs_attention" for e in events), synced_at=now)

    async def voice_candidates(self, transaction):
        if transaction.account_id not in {account.id for account in await self.accounts()}:
            raise NotFoundError("Account not found")
        from service.finance.voice import matching_expense_transaction_ids
        expense_ids = {event.id for event in await self.events()
                       if event.type == "expense" and len(event.contributions) == 1}
        return [transaction_id for transaction_id in matching_expense_transaction_ids(transaction, await self.transactions())
                if transaction_id in expense_ids]

    async def confirm_voice(self, payload: VoiceConfirmation):
        if payload.matched_transaction_id is not None:
            if payload.matched_transaction_id not in await self.voice_candidates(payload.transaction):
                raise UnprocessableEntityError("Selected transaction is not a matching expense")
            resolution = await self.resolve(payload.matched_transaction_id,
                                            Resolution(action="expense", category=payload.transaction.category))
            return VoiceConfirmationResult(matched_transaction_id=payload.matched_transaction_id, resolution=resolution)
        result = await self.import_transactions([payload.transaction])
        return VoiceConfirmationResult(import_result=result)

    async def load_demo(self, month: date, bank=None):
        await self.lock()
        if bank:
            if bank not in BANKS:
                raise NotFoundError("Bank provider not found")
            accounts, transactions = MockBankProvider(bank).fetch(self.user_id, month)
        else:
            accounts, transactions = demo_dataset(self.user_id, month)
        # External IDs let an earlier manual creation of the demo account be reused safely.
        mapping = {}
        for account in accounts:
            saved = await self.create_account(account, account.id)
            mapping[account.id] = saved.id
        for t in transactions:
            t.account_id = mapping[t.account_id]
        return await self.import_transactions(transactions)

    async def banks(self):
        accounts = await self.accounts()
        return [BankView(code=code, name=name, connected=any(a.bank == code for a in accounts),
                         last_synced_at=max((a.last_synced_at for a in accounts if a.bank == code and a.last_synced_at), default=None))
                for code, name in BANKS.items()]

    async def detail(self, event_id):
        events = await self.events()
        event = next((e for e in events if e.id == event_id), None)
        if not event:
            raise NotFoundError("Event not found")
        ids = {c.transaction_id for c in event.contributions}
        transactions = [t for t in await self.transactions() if t.id in ids]
        related_ids = {link.event_id for link in event.funding_links}
        if event.related_event_id:
            related_ids.add(event.related_event_id)
        related = [e for e in events if e.id in related_ids or e.related_event_id == event.id
                   or any(link.event_id == event.id for link in e.funding_links)]
        nodes = [GraphNode(id=f"event:{event.id}", kind="event", label=event.title, amount_minor=event.expense_impact_minor)]
        nodes += [GraphNode(id=f"tx:{t.id}", kind="transaction", label=t.merchant or t.description, amount_minor=t.amount_minor) for t in transactions]
        nodes += [GraphNode(id=f"event:{e.id}", kind="event", label=e.title, amount_minor=e.expense_impact_minor) for e in related]
        edges = [GraphEdge(source=f"tx:{c.transaction_id}", target=f"event:{event.id}", role=c.role, amount_minor=c.amount_minor) for c in event.contributions]
        for e in [event, *related]:
            if e.related_event_id and (e.id == event.id or e.related_event_id == event.id):
                edges.append(GraphEdge(source=f"event:{e.id}", target=f"event:{e.related_event_id}", role=e.type))
            for link in e.funding_links:
                if e.id == event.id or link.event_id == event.id:
                    edges.append(GraphEdge(source=f"event:{link.event_id}", target=f"event:{e.id}", role="marketplace_funding", amount_minor=link.amount_minor))
        return EventDetail(event=event, transactions=transactions, related_events=related, nodes=nodes, edges=edges)

    async def attention(self, start=None, end=None, tz="Europe/Moscow", limit=None):
        events = await self.events()
        transactions = await self.transactions()
        # The scan below is pure CPU over the whole ledger; keep it off the event loop.
        return await run_in_threadpool(self._attention, events, transactions, start, end, tz, limit)

    def _attention(self, events, transactions, start, end, tz, limit=None):
        zone = None
        if start is not None:
            try:
                summarize(events, start, end, tz)
                zone = ZoneInfo(tz)
            except ValueError as exc:
                raise UnprocessableEntityError(str(exc)) from exc
        tx_map = {t.id: t for t in transactions}
        refunds = defaultdict(int)
        for e in events:
            if e.type == "refund":
                refunds[e.related_event_id] += e.bank_inflow_minor
        # Candidate pools are built once per call. Rescanning every event per button was quadratic:
        # a 3k-event ledger with 2k unresolved rows meant ~28M inner iterations and tens of seconds.
        # Each pool keeps ledger order, so scanning it backwards yields the same candidates, and in
        # the same order, as the original reversed(events) walk. The `caps` arrays are running maxima
        # of the amount each candidate can absorb, which lets a hopeless scan stop instead of running
        # to the start of the ledger.
        transfers = defaultdict(list)
        debts, debt_caps = [], []
        expenses, expense_caps = [], []
        restaurants, restaurant_caps = [], []
        for candidate in events:
            original = tx_map[candidate.id]
            if len(candidate.contributions) == 1 and original.resolution is None:
                transfers[original.amount_minor].append(candidate)
            if candidate.type == "debt_given":
                debts.append(candidate)
                debt_caps.append(max(debt_caps[-1] if debt_caps else 0, candidate.remaining_minor or 0))
            if candidate.type in {"expense", "shared_expense"}:
                available = candidate.expense_impact_minor - refunds[candidate.id]
                expenses.append(candidate)
                expense_caps.append(max(expense_caps[-1] if expense_caps else 0, available))
                if candidate.category == "restaurants":
                    restaurants.append(candidate)
                    restaurant_caps.append(max(restaurant_caps[-1] if restaurant_caps else 0, available))
        result = []
        for event in events:
            if event.status != "needs_attention":
                continue
            if start is not None and not any(start <= c.occurred_at.astimezone(zone).date() <= end for c in event.contributions):
                continue
            t = tx_map[event.id]
            if t.amount_minor > 0:
                options = [ResolutionOption(action="income", label="Это доход")]
                actions = [("debt_repayment", "Возврат долга"), ("shared_expense_repayment", "Компенсация общей покупки"), ("refund", "Возврат покупки")]
            else:
                options = [ResolutionOption(action="expense", label="Это расход"), ResolutionOption(action="debt_given", label="Дал в долг")]
                actions = []
            actions.append(("own_transfer", "Перевод между своими счетами"))
            # Offer bounded, concrete candidates; never reconstruct the whole ledger for every button.
            for action, label in actions:
                if action == "own_transfer":
                    pool, caps = transfers.get(-t.amount_minor, ()), None
                elif action == "debt_repayment":
                    pool, caps = debts, debt_caps
                elif action == "shared_expense_repayment":
                    pool, caps = restaurants, restaurant_caps
                else:
                    pool, caps = expenses, expense_caps
                count = 0
                for i in range(len(pool) - 1, -1, -1):
                    if caps is not None and caps[i] < t.amount_minor:
                        break
                    candidate = pool[i]
                    original = tx_map[candidate.id]
                    if candidate.id == event.id or original.occurred_at > t.occurred_at:
                        continue
                    if action == "own_transfer":
                        valid = original.account_id != t.account_id
                    elif action == "debt_repayment":
                        valid = (candidate.remaining_minor or 0) >= t.amount_minor
                    else:
                        valid = candidate.expense_impact_minor - refunds[candidate.id] >= t.amount_minor
                    if not valid:
                        continue
                    options.append(ResolutionOption(action=action, label=f"{label}: {candidate.title}", related_event_id=candidate.id))
                    count += 1
                    if count == 5:
                        break
            options.append(ResolutionOption(action="later", label="Позже"))
            result.append(AttentionItem(event=event, options=options))
            if limit is not None and len(result) >= limit:
                break
        return result

    async def resolve(self, event_id, resolution):
        await self.lock()
        event = next((e for e in await self.events() if e.id == event_id), None)
        if event is None:
            raise NotFoundError("Event not found")
        if len(event.contributions) != 1:
            raise ConflictError("Resolve individual operations before grouping; grouped events cannot be reclassified")
        row = await self.session.scalar(select(FinanceTransaction).where(
            FinanceTransaction.user_id == self.user_id, FinanceTransaction.id == event.id))
        row.resolution = resolution.model_dump(mode="json")
        await self.session.flush()
        events = await self.rebuild()
        updated = next(e for e in events if any(c.transaction_id == event_id for c in e.contributions))
        return ResolveResult(event=updated, needs_attention_count=sum(e.status == "needs_attention" for e in events))

    async def analytics(self, start, end, tz, period=None):
        try:
            result = analytics(await self.events(), start, end, tz, period)
        except ValueError as exc:
            raise UnprocessableEntityError(str(exc)) from exc
        result.last_synced_at = max((a.last_synced_at for a in await self.accounts() if a.last_synced_at), default=None)
        return result

    async def dashboard(self, start, end, tz, period=None):
        report = await self.analytics(start, end, tz, period)
        accounts = await self.accounts()
        return Dashboard(**report.model_dump(), total_balance_minor=sum(a.balance_minor for a in accounts),
                         accounts=accounts, recent_events=list(reversed(await self.events()))[:10],
                          attention_preview=await self.attention(start, end, tz, limit=3))

    async def digest(self, day, tz):
        events = await self.events()
        try:
            summary = summarize(events, day, day, tz)
        except ValueError as exc:
            raise UnprocessableEntityError(str(exc)) from exc
        attention = await self.attention()
        message = (f"Нужно уточнить операций: {len(attention)}. Подтвердите подходящий вариант одним нажатием."
                   if attention else "Все операции разобраны. Сегодня дополнительных действий не требуется.")
        return Digest(date=day, summary=summary, attention=attention,
                      outstanding_debt_minor=sum(e.remaining_minor or 0 for e in events if e.type == "debt_given"), message=message)
