"""Repeatable mock banking source; no synthetic classifications are fed to the engine."""
from datetime import date, datetime, timedelta, timezone
from typing import Protocol
from uuid import UUID, uuid5

from domain.finance.schemas import AccountData, TransactionData

BANKS = {"tbank": "Т-Банк", "sber": "Сбер", "alfa": "Альфа-Банк", "ozon": "Ozon Банк"}


class BankProvider(Protocol):
    def fetch(self, owner_id: UUID, month: date) -> tuple[list[AccountData], list[TransactionData]]: ...


def demo_dataset(owner_id: UUID, month: date):
    month = month.replace(day=1)
    accounts = [AccountData(id=uuid5(owner_id, f"demo:{bank}"), external_id=f"demo:{bank}", bank=bank,
                            name=f"{name} · демо", account_type="marketplace" if bank == "ozon" else "card",
                            opening_balance_minor=2000000 if bank != "ozon" else 0)
                for bank, name in BANKS.items()]
    by_bank = {a.bank: a.id for a in accounts}
    transactions = []

    def add(key, amount, day, bank="tbank", description="", merchant=None, counterparty=None, hour=12):
        external_id = f"demo:{month.isoformat()}:{key}"
        transactions.append(TransactionData(
            id=uuid5(owner_id, external_id), external_id=external_id, account_id=by_bank[bank],
            amount_minor=amount, occurred_at=datetime(month.year, month.month, day, hour, tzinfo=timezone.utc),
            description=description, merchant=merchant, counterparty=counterparty))

    add("salary", 9500000, 1, description="Зарплата за месяц", counterparty="Работодатель")
    add("own-out", -1000000, 2, description="Перевод между своими счетами")
    add("own-in", 1000000, 2, "sber", "Перевод между своими счетами", hour=13)
    add("market-out", -600000, 3, description="Перевод себе")
    add("market-in", 600000, 3, "ozon", "Перевод себе", hour=13)
    add("market-food", -80000, 4, "ozon", merchant="Продукты")
    add("market-tech", -230000, 5, "ozon", merchant="Бытовая техника")
    add("market-home", -90000, 6, "ozon", merchant="Хозтовары для дома")
    add("loan", -300000, 4, description="Дал в долг", counterparty="Антон")
    add("loan-return-1", 150000, 11, description="Возврат долга", counterparty="Антон")
    add("loan-return-2", 150000, 18, description="Возврат долга", counterparty="Антон")
    add("dinner", -800000, 8, description="Общий ужин", merchant="Ресторан")
    for i, friend in enumerate(["Миша", "Катя", "Дима", "Оля"]):
        add(f"friend-{i}", 160000, 9, description="за ужин", counterparty=friend, hour=12+i)
    add("unknown-lunch", 50000, 20, description="за обед", counterparty="Алексей")
    add("purchase", -420000, 10, merchant="Магазин одежды")
    add("refund", 420000, 16, description="Возврат товара", merchant="Магазин одежды")
    add("cash", -500000, 17, description="Снятие наличных в банкомате")
    for day in range(1, 25):
        add(f"groceries-{day}", -(25000 + day * 713), day, "sber", merchant="Пятерочка")
        add(f"transport-{day}", -6500, day, "alfa", merchant="Метро", hour=9)
    add("subscription", -29900, 5, merchant="Яндекс Плюс", description="Подписка")
    # A previous-period operation makes comparison useful without unrelated hardcoded totals.
    previous = datetime(month.year, month.month, 1, 12, tzinfo=timezone.utc) - timedelta(days=1)
    key = f"demo:previous:{month.isoformat()}"
    transactions.append(TransactionData(id=uuid5(owner_id, key), external_id=key, account_id=by_bank["sber"],
                                        amount_minor=-100000, occurred_at=previous, merchant="Продукты"))
    return accounts, transactions


class MockBankProvider:
    def __init__(self, bank: str):
        if bank not in BANKS:
            raise ValueError("Unknown bank provider")
        self.bank = bank

    def fetch(self, owner_id: UUID, month: date):
        accounts, transactions = demo_dataset(owner_id, month)
        accounts = [a for a in accounts if a.bank == self.bank]
        ids = {a.id for a in accounts}
        return accounts, [t for t in transactions if t.account_id in ids]
