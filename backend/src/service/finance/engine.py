"""Pure, deterministic reconstruction. Never uses an LLM for money or linking."""
from collections import defaultdict
from datetime import timedelta

from domain.finance.schemas import AccountData, Contribution, FinancialEvent, FundingLink, TransactionData


def normalized(value: str | None) -> str:
    return " ".join((value or "").casefold().replace("ё", "е").split())


def contains(text: str, *words: str) -> bool:
    return any(word in text for word in words)


def category_for(t: TransactionData) -> str:
    if t.resolution and t.resolution.category:
        return t.resolution.category
    if t.category:
        return t.category
    text = normalized(f"{t.merchant or ''} {t.description}")
    rules = {
        "groceries": ("продукт", "пятероч", "перекрест", "вкусвилл", "grocer"),
        "restaurants": ("ресторан", "кафе", "ужин", "обед", "рестик", "restaurant"),
        "transport": ("такси", "метро", "транспорт", "taxi"),
        "electronics": ("техник", "электроник", "electronics"),
        "household": ("хозтовар", "для дома", "household"),
        "subscriptions": ("подписк", "яндекс плюс", "subscription"),
        "health": ("аптек", "клиник"),
        "shopping": ("одежд", "магазин", "shop"),
    }
    return next((key for key, words in rules.items() if contains(text, *words)), "other")


def _initial(t: TransactionData) -> FinancialEvent:
    text = normalized(t.description)
    action = t.resolution.action if t.resolution else None
    category = category_for(t)
    expense, income = 0, 0
    status, confidence = "auto", 0.95
    if t.amount_minor < 0:
        expense = -t.amount_minor
        kind, reason = "expense", "Покупка: расход равен сумме списания."
        if action == "debt_given" or (not action and contains(text, "в долг", "выдача займа")):
            kind, expense, category = "debt_given", 0, "other"
            reason = "Выданный долг — дебиторская задолженность, а не расход."
        elif not action and contains(text, "снятие налич", "банкомат", "cash withdrawal"):
            kind, category = "cash_withdrawal", "cash"
            reason = "Политика MVP: наличные учитываются расходом при снятии; повторно наличные покупки не учитываются."
        elif not action and not t.merchant:
            kind, status, confidence = "unknown", "needs_attention", 0.4
            reason = "Назначение перевода неизвестно. Пока учтен как предварительный расход."
    else:
        kind, status, confidence = "unknown", "needs_attention", 0.4
        reason = "Неизвестное поступление не включено в доход до уточнения."
        if action == "income" or (not action and contains(text, "зарплат", "salary", "заработная плата")):
            kind, status, confidence, income = "income", "auto", 0.99, t.amount_minor
            reason = "Доход: подтвержденный источник поступления."
    if action:
        status, confidence = "confirmed", 1.0
        if action == "expense":
            kind, expense = "expense", -t.amount_minor
        reason = "Классификация подтверждена пользователем."
    contribution = Contribution(transaction_id=t.id, occurred_at=t.occurred_at, amount_minor=t.amount_minor,
                                expense_minor=expense, income_minor=income, role="original", category=category)
    return FinancialEvent(id=t.id, type=kind, status=status, title=t.merchant or t.description or "Операция",
                          occurred_at=t.occurred_at, category=category, confidence=confidence, reason=reason,
                          remaining_minor=-t.amount_minor if kind == "debt_given" else None,
                          contributions=[contribution])


def reconstruct(accounts: list[AccountData], transactions: list[TransactionData]) -> list[FinancialEvent]:
    """Each raw transaction contributes exactly once. IDs are stable anchor transaction IDs."""
    ordered = sorted(transactions, key=lambda t: (t.occurred_at, str(t.id)))
    account_map = {a.id: a for a in accounts}
    tx_map = {t.id: t for t in ordered}
    if len(tx_map) != len(ordered) or any(t.account_id not in account_map for t in ordered):
        raise ValueError("Transactions must be unique and belong to supplied accounts")
    for t in ordered:
        if t.resolution:
            action = t.resolution.action
            if action in {"expense", "debt_given"} and t.amount_minor > 0:
                raise ValueError("This resolution requires an outgoing operation")
            if action in {"income", "debt_repayment", "shared_expense_repayment", "refund"} and t.amount_minor < 0:
                raise ValueError("This resolution requires an incoming operation")
    events = {t.id: _initial(t) for t in ordered}

    def pair(debit, credit, manual=False):
        event = events[debit.id]
        event.type = "marketplace_transfer" if account_map[credit.account_id].account_type == "marketplace" else "own_transfer"
        event.status, event.confidence = ("confirmed", 1.0) if manual else ("auto", 0.99)
        event.reason = "Сопоставлены списание и зачисление между своими счетами. Расход и доход равны нулю."
        event.contributions[0].expense_minor = 0
        event.contributions[0].role = "transfer_out"
        c = events.pop(credit.id).contributions[0]
        c.expense_minor = c.income_minor = 0
        c.role = "transfer_in"
        event.contributions.append(c)

    for t in ordered:
        if not t.resolution or t.resolution.action != "own_transfer":
            continue
        other = tx_map.get(t.resolution.related_event_id)
        if (not other or other.account_id == t.account_id or other.amount_minor != -t.amount_minor
                or t.id not in events or other.id not in events
                or (other.resolution and other.resolution.action != "own_transfer")):
            raise ValueError("Own transfer requires an unallocated opposite operation on another own account")
        pair(t if t.amount_minor < 0 else other, other if t.amount_minor < 0 else t, True)

    def transfer_candidates(t):
        own = contains(normalized(t.description), "себе", "своими", "свой счет")
        return [o for o in ordered if o.id != t.id and o.id in events and not o.resolution
                and o.account_id != t.account_id and o.amount_minor == -t.amount_minor
                and abs(o.occurred_at - t.occurred_at) <= timedelta(days=2)
                and ((t.transfer_reference and t.transfer_reference == o.transfer_reference)
                     or (own and contains(normalized(o.description), "себе", "своими", "свой счет")))]

    for t in ordered:
        if t.amount_minor >= 0 or t.id not in events or t.resolution or len(events[t.id].contributions) > 1:
            continue
        candidates = transfer_candidates(t)
        if len(candidates) == 1 and len(transfer_candidates(candidates[0])) == 1:
            pair(t, candidates[0])

    # Reserve user-confirmed links before heuristic matches, so new imports cannot override them.
    incoming = sorted((t for t in ordered if t.amount_minor > 0), key=lambda t: (not bool(t.resolution), t.occurred_at, str(t.id)))
    refunded = defaultdict(int)
    for t in incoming:
        if t.id not in events:
            continue
        action = t.resolution.action if t.resolution else None
        if action in {"income", "own_transfer"}:
            continue
        text = normalized(t.description)
        intent = action
        if not intent:
            if contains(text, "возврат долг", "вернул долг", "возвращаю долг"):
                intent = "debt_repayment"
            elif contains(text, "возврат", "refund") and t.merchant:
                intent = "refund"
            elif contains(text, "за ужин", "за обед", "за рестик", "за ресторан"):
                intent = "shared_expense_repayment"
        if intent not in {"debt_repayment", "refund", "shared_expense_repayment"}:
            continue
        candidates = []
        for e in events.values():
            original = tx_map[e.id]
            if original.amount_minor >= 0 or original.occurred_at > t.occurred_at:
                continue
            if action and e.id != t.resolution.related_event_id:
                continue
            available = -original.amount_minor - refunded[e.id]
            if intent == "debt_repayment":
                valid = (e.type == "debt_given" and e.remaining_minor >= t.amount_minor
                         and (action or (t.counterparty and normalized(t.counterparty) == normalized(original.counterparty))))
            elif intent == "refund":
                valid = (e.type in {"expense", "shared_expense"} and available >= t.amount_minor
                         and (action or (t.merchant and normalized(t.merchant) == normalized(original.merchant))))
            else:
                valid = (e.type in {"expense", "shared_expense"} and available >= t.amount_minor
                         and (action or (e.category == "restaurants" and t.occurred_at - original.occurred_at <= timedelta(days=7))))
            if valid:
                candidates.append(e)
        if len(candidates) != 1:
            if action:
                raise ValueError("Related event is incompatible, missing, or has insufficient remaining amount")
            continue
        target = candidates[0]
        event = events[t.id]
        c = event.contributions[0]
        c.income_minor = c.expense_minor = 0
        c.role = intent
        c.category = target.category
        event.category = target.category
        event.related_event_id = target.id
        event.status = "confirmed" if action else "auto"
        event.confidence = 1.0 if action else 0.94
        if intent == "debt_repayment":
            event.type = "debt_repayment"
            target.remaining_minor -= t.amount_minor
            event.reason = "Возврат сопоставлен с выданным долгом; доход не возникает."
        elif intent == "refund":
            event.type = "refund"
            c.expense_minor = -t.amount_minor
            refunded[target.id] += t.amount_minor
            event.reason = "Возврат уменьшает расходы в дату поступления; не является доходом."
        else:
            c.expense_minor = -t.amount_minor
            refunded[target.id] += t.amount_minor
            target.type = "shared_expense"
            target.contributions.append(c)
            if action:
                target.status = "confirmed"
            target.reason = "Общий счет минус связанные компенсации друзей. Каждая компенсация учитывается в дату поступления."
            target.confidence = 1.0 if target.status == "confirmed" else 0.88
            del events[t.id]

    # FIFO provenance within the marketplace account. These links never add money impacts.
    tx_events = {c.transaction_id: e for e in events.values() for c in e.contributions}
    pools = defaultdict(list)
    for t in ordered:
        e = tx_events[t.id]
        if account_map[t.account_id].account_type != "marketplace":
            continue
        if t.amount_minor > 0 and e.type == "marketplace_transfer":
            pools[t.account_id].append([e.id, t.amount_minor])
        elif t.amount_minor < 0:
            remaining = -t.amount_minor
            for pool in pools[t.account_id]:
                allocated = min(remaining, pool[1])
                if allocated and e.type in {"expense", "shared_expense"}:
                    e.funding_links.append(FundingLink(event_id=pool[0], amount_minor=allocated))
                pool[1] -= allocated
                remaining -= allocated
                if not remaining:
                    break

    for e in events.values():
        e.contributions.sort(key=lambda c: (c.occurred_at, str(c.transaction_id)))
        e.expense_impact_minor = sum(c.expense_minor for c in e.contributions)
        e.income_impact_minor = sum(c.income_minor for c in e.contributions)
        e.bank_outflow_minor = sum(max(-c.amount_minor, 0) for c in e.contributions)
        e.bank_inflow_minor = sum(max(c.amount_minor, 0) for c in e.contributions)
    return sorted(events.values(), key=lambda e: (e.occurred_at, str(e.id)))
