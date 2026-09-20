from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, Field, model_validator

from .schemas import Category, Contract, Money

Marketplace = Literal["ozon", "wildberries", "yandex_market"]


class OrderItem(Contract):
    name: str = Field(min_length=1, max_length=200)
    quantity: int = Field(ge=1, le=10000, strict=True)
    total_minor: Money = Field(ge=0)
    category: Category = "other"


class OrderInput(Contract):
    external_id: str = Field(min_length=1, max_length=128)
    purchased_at: AwareDatetime
    paid_minor: Money = Field(gt=0)
    currency: Literal["RUB"] = "RUB"
    items: list[OrderItem] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def balanced(self):
        if sum(item.total_minor for item in self.items) != self.paid_minor:
            raise ValueError("Item totals (after discounts, including delivery) must equal paid_minor")
        return self


class OrderView(OrderInput):
    id: UUID
    marketplace: Marketplace
    transaction_id: UUID | None = None
    candidate_transaction_ids: list[UUID] = Field(default_factory=list)
    status: Literal["unmatched", "matched"]


class OrderImport(Contract):
    orders: list[OrderInput] = Field(min_length=1, max_length=500)


class OrderImportResult(Contract):
    imported_count: int
    duplicate_count: int
    orders: list[OrderView]


class OrderLink(Contract):
    transaction_id: UUID


class IntegrationView(Contract):
    code: Marketplace
    name: str
    mode: Literal["file_import"] = "file_import"
    live_sync_available: bool = False
    imported_orders_count: int
    linked_orders_count: int
