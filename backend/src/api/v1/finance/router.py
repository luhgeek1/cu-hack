from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Query, UploadFile

from core.errors import PayloadTooLargeError, UnprocessableEntityError
from core.security import auth_user, parse_token, verify_auth_version
from database.relational_db import get_session_factory
from domain.finance.schemas import (
    AccountCreate, AccountData, AccountView, Analytics, AttentionItem, BankView, Dashboard, DemoRequest,
    Digest, EventDetail, EventStatus, EventType, FinanceDate, FinancialEvent, ImportRequest, ImportResult, Page,
    Resolution, ResolveResult, TransactionData,
)
from service.finance.analytics import period_bounds
from service.finance.importer import parse_csv
from service.finance.service import FinanceService
from domain.finance.statements import StatementPreview, StatementResult
from service.finance.statements import parse_tbank_pdf, parse_tbank_text
from starlette.concurrency import run_in_threadpool
from domain.finance.marketplaces import IntegrationView, Marketplace, OrderImport, OrderImportResult, OrderLink, OrderView
from service.finance.marketplaces import MarketplaceService

router = APIRouter(tags=["Honest Month"])


async def current_finance_user(user=Depends(auth_user), payload=Depends(parse_token)):
    verify_auth_version(payload.get("av"), user)
    return user


async def get_finance_service(user=Depends(current_finance_user)):
    async with get_session_factory()() as session:
        async with session.begin():
            yield FinanceService(session, user.id)


Service = Annotated[FinanceService, Depends(get_finance_service, scope="function")]


@router.get("/integrations", response_model=list[IntegrationView])
async def integrations(svc: Service):
    return await MarketplaceService(svc).integrations()


@router.post("/integrations/{provider}/orders", response_model=OrderImportResult)
async def import_orders(provider: Marketplace, payload: OrderImport, svc: Service):
    return await MarketplaceService(svc).import_orders(provider, payload.orders)


@router.get("/marketplace-orders", response_model=list[OrderView])
async def marketplace_orders(svc: Service):
    return await MarketplaceService(svc).list_orders()


@router.post("/marketplace-orders/{order_id}/link", response_model=OrderView)
async def link_order(order_id: UUID, payload: OrderLink, svc: Service):
    return await MarketplaceService(svc).link(order_id, payload.transaction_id)


def dates(
    period: Literal["day", "week", "month", "year"] = "month",
    date: FinanceDate | None = None,
    start_date: FinanceDate | None = None,
    end_date: FinanceDate | None = None,
    timezone: str = "Europe/Moscow",
):
    try:
        tz = ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise UnprocessableEntityError("Unknown timezone") from exc
    if (start_date is None) != (end_date is None):
        raise UnprocessableEntityError("Supply both start_date and end_date")
    if start_date is not None:
        if start_date > end_date or (end_date - start_date).days > 3660:
            raise UnprocessableEntityError("Invalid date range (maximum 3661 days)")
        return start_date, end_date, timezone, None
    start, end = period_bounds(period, date or datetime.now(tz).date())
    return start, end, timezone, period


def page(items, limit, offset):
    return dict(items=items[offset:offset+limit], total=len(items), limit=limit, offset=offset)


@router.get("/banks", response_model=list[BankView])
async def banks(svc: Service):
    return await svc.banks()


@router.post("/banks/{provider}/connect-and-sync", response_model=ImportResult)
@router.post("/banks/{provider}/sync", response_model=ImportResult)
async def sync_bank(provider: str, payload: DemoRequest, svc: Service):
    return await svc.load_demo(payload.month, provider)


@router.post("/demo/load", response_model=ImportResult, summary="Load repeatable 70-operation demonstration")
async def load_demo(payload: DemoRequest, svc: Service):
    return await svc.load_demo(payload.month)


@router.get("/accounts", response_model=list[AccountView])
async def accounts(svc: Service):
    return await svc.accounts()


@router.post("/accounts", response_model=AccountData, status_code=201)
async def create_account(payload: AccountCreate, svc: Service):
    return await svc.create_account(payload)


@router.post("/imports", response_model=ImportResult)
async def import_json(payload: ImportRequest, svc: Service):
    return await svc.import_transactions(payload.transactions)


@router.post("/imports/csv", response_model=ImportResult)
async def import_csv(account_id: UUID, file: UploadFile, svc: Service):
    content = await file.read(1024 * 1024 + 1)
    if len(content) > 1024 * 1024:
        raise PayloadTooLargeError("CSV must be at most 1 MiB")
    return await svc.import_transactions(parse_csv(content, account_id))


@router.post("/imports/tbank/preview", response_model=StatementPreview)
async def preview_statement(account_id: UUID, file: UploadFile, svc: Service):
    if account_id not in {a.id for a in await svc.accounts()}:
        from core.errors import NotFoundError
        raise NotFoundError("Account not found")
    return await read_statement(file, account_id)


async def read_statement(file, account_id):
    content = await file.read(20 * 1024 * 1024 + 1)
    if len(content) > 20 * 1024 * 1024:
        raise PayloadTooLargeError("Statement must be at most 20 MiB")
    if content.startswith(b"%PDF-"):
        return await run_in_threadpool(parse_tbank_pdf, content, account_id)
    if not (file.filename or "").lower().endswith(".txt"):
        raise UnprocessableEntityError("Upload a PDF or extracted UTF-8 .txt statement")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise UnprocessableEntityError("Text must be UTF-8") from exc
    return await run_in_threadpool(parse_tbank_text, text, account_id)


@router.post("/imports/tbank", response_model=StatementResult)
async def import_statement(account_id: UUID, file: UploadFile, svc: Service):
    statement = await read_statement(file, account_id)
    result = await svc.import_transactions(statement.transactions)
    return StatementResult(import_result=result, statement=statement)


@router.get("/transactions", response_model=Page[TransactionData])
async def transactions(svc: Service, account_id: UUID | None = None,
                       limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    items = list(reversed(await svc.transactions()))
    if account_id:
        items = [t for t in items if t.account_id == account_id]
    return page(items, limit, offset)


@router.get("/events", response_model=Page[FinancialEvent])
async def events(svc: Service, status: EventStatus | None = None, type: EventType | None = None,
                 start_date: FinanceDate | None = None, end_date: FinanceDate | None = None, timezone: str = "Europe/Moscow",
                 limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    if (start_date is None) != (end_date is None):
        raise UnprocessableEntityError("Supply both start_date and end_date")
    try:
        tz = ZoneInfo(timezone)
    except (ValueError, ZoneInfoNotFoundError) as exc:
        raise UnprocessableEntityError("Unknown timezone") from exc
    if start_date and start_date > end_date:
        raise UnprocessableEntityError("start_date must not follow end_date")
    items = [e for e in reversed(await svc.events()) if (status is None or e.status == status) and (type is None or e.type == type)]
    if start_date:
        items = [e for e in items if any(start_date <= c.occurred_at.astimezone(tz).date() <= end_date for c in e.contributions)]
    return page(items, limit, offset)


@router.get("/events/{event_id}", response_model=EventDetail)
async def detail(event_id: UUID, svc: Service):
    return await svc.detail(event_id)


@router.post("/events/{event_id}/resolve", response_model=ResolveResult)
async def resolve(event_id: UUID, payload: Resolution, svc: Service):
    return await svc.resolve(event_id, payload)


@router.get("/attention", response_model=Page[AttentionItem])
async def attention(svc: Service, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return page(await svc.attention(), limit, offset)


@router.get("/analytics", response_model=Analytics)
@router.get("/analytics/explanation", response_model=Analytics)
async def report(svc: Service, bounds=Depends(dates)):
    return await svc.analytics(*bounds)


@router.get("/dashboard", response_model=Dashboard)
async def dashboard(svc: Service, bounds=Depends(dates)):
    return await svc.dashboard(*bounds)


@router.get("/digest", response_model=Digest)
async def digest(svc: Service, date: FinanceDate | None = None, timezone: str = "Europe/Moscow"):
    try:
        day = date or datetime.now(ZoneInfo(timezone)).date()
    except (ValueError, ZoneInfoNotFoundError) as exc:
        raise UnprocessableEntityError("Unknown timezone") from exc
    return await svc.digest(day, timezone)
