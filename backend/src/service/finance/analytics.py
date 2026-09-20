from collections import defaultdict
from datetime import date, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from domain.finance.schemas import Analytics, Breakdown, CategoryTotal, Comparison, PeriodSummary, TimelinePoint, Reconciliation, PeriodReview


def period_bounds(period: str, anchor: date) -> tuple[date, date]:
    if period == "day":
        return anchor, anchor
    if period == "week":
        start = anchor - timedelta(days=anchor.weekday())
        return start, start + timedelta(days=6)
    if period == "month":
        start = anchor.replace(day=1)
        end = (start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        return start, end
    if period == "year":
        return date(anchor.year, 1, 1), date(anchor.year, 12, 31)
    raise ValueError("period must be day, week, month or year")


def summarize(events, start: date, end: date, timezone: str = "Europe/Moscow") -> PeriodSummary:
    if start > end or (end - start).days > 3660:
        raise ValueError("Date range must be ordered and at most 3661 days")
    try:
        tz = ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError("Unknown timezone") from exc
    result = PeriodSummary(start_date=start, end_date=end, timezone=timezone)
    timeline = {start + timedelta(days=i): TimelinePoint(date=start + timedelta(days=i)) for i in range((end - start).days + 1)}
    categories = defaultdict(int)
    exclusions = {}
    for e in events:
        counted = False
        for c in e.contributions:
            day = c.occurred_at.astimezone(tz).date()
            if not start <= day <= end:
                continue
            counted = True
            outflow = max(-c.amount_minor, 0) if not c.is_cash else 0
            result.bank_outflow_minor += outflow
            result.bank_inflow_minor += max(c.amount_minor, 0) if not c.is_cash else 0
            result.real_expense_minor += c.expense_minor
            result.real_income_minor += c.income_minor
            timeline[day].expense_minor += c.expense_minor
            timeline[day].income_minor += c.income_minor
            if c.expense_minor:
                if c.category_allocations:
                    for category, amount in c.category_allocations.items():
                        categories[category] += amount
                else:
                    categories[c.category] += c.expense_minor
            if e.status == "needs_attention":
                result.unresolved_inflow_minor += max(c.amount_minor, 0)
            excluded = outflow - c.expense_minor
            if excluded:
                kind = "shared_expense_reimbursement" if c.role == "shared_expense_repayment" else e.type
                row = exclusions.setdefault(kind, Breakdown(type=kind, amount_minor=0))
                row.amount_minor += excluded
                if e.id not in row.event_ids:
                    row.event_ids.append(e.id)
        if counted and e.status == "needs_attention":
            result.needs_attention_count += 1
    result.is_provisional = result.needs_attention_count > 0
    result.net_income_minor = result.real_income_minor - result.real_expense_minor
    result.excluded_minor = result.bank_outflow_minor - result.real_expense_minor
    result.timeline = list(timeline.values())
    result.categories = [CategoryTotal(category=k, expense_minor=v) for k, v in sorted(categories.items())]
    result.excluded_breakdown = sorted(exclusions.values(), key=lambda e: e.type)
    return result


def analytics(events, start, end, timezone="Europe/Moscow", period=None):
    summary = summarize(events, start, end, timezone)
    previous_end = start - timedelta(days=1)
    if period in {"month", "year"}:
        previous_start, previous_end = period_bounds(period, previous_end)
    else:
        previous_start = start - timedelta(days=(end - start).days + 1)
    previous = summarize(events, previous_start, previous_end, timezone)
    delta = summary.real_expense_minor - previous.real_expense_minor
    if period == "month":
        ranges = [(start.replace(day=d), start.replace(day=d + 6) if d < 22 else end) for d in (1, 8, 15, 22)]
    else:
        ranges = [(start + timedelta(days=i), start + timedelta(days=i)) for i in range((end - start).days + 1)]
    parts = [summarize(events, a, b, timezone) for a, b in ranges]
    expense_sum = sum(p.real_expense_minor for p in parts)
    income_sum = sum(p.real_income_minor for p in parts)
    proof = Reconciliation(parts=parts, expense_sum_minor=expense_sum, income_sum_minor=income_sum,
                           matches=expense_sum == summary.real_expense_minor and income_sum == summary.real_income_minor)
    count = summary.needs_attention_count
    review = PeriodReview(status="needs_attention" if count else "complete", needs_attention_count=count,
                          message=f"Осталось уточнить операций: {count}. Они могут изменить итог." if count else "Все операции за период разобраны.")
    return Analytics(summary=summary, reconciliation=proof, review=review, comparison=Comparison(
        previous_start_date=previous_start, previous_end_date=previous_end,
        previous_expense_minor=previous.real_expense_minor, previous_income_minor=previous.real_income_minor,
        expense_delta_minor=delta, income_delta_minor=summary.real_income_minor - previous.real_income_minor,
        expense_change_percent=round(delta / abs(previous.real_expense_minor) * 100, 2) if previous.real_expense_minor else None,
    ))
