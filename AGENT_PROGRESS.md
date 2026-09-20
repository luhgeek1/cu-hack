# AGENT_PROGRESS.md

This file is the shared coordination log for all coding agents working on the project.

**Do not delete previous entries. Append or update your own task only.**

Before starting work:
1. Read `AGENT.md`.
2. Read this file.
3. Inspect current repository state.
4. Check whether another agent is already editing the same area.

---

# Current project status

Hackathon project: **«Честный месяц»**

Current core concept:

> Banks show transactions. We reconstruct what actually happened with the user's money.

Main priorities:
- mock bank connection
- transaction sync/import
- financial-event reconstruction
- correct handling of required edge cases
- analytics
- Needs Attention
- Money Graph
- live recalculation

---

# Shared decisions

## Product

- Do not require manual entry of every transaction.
- Product should feel like automatic bank synchronization.
- Hackathon implementation may use mock/sandbox bank providers.
- Normal day target: 0 user actions.
- Ambiguous case target: 1 user tap.

## Backend

- Financial arithmetic must be deterministic.
- Gemini must not be the source of truth for totals.
- Raw transactions and higher-level FinancialEvents are separate concepts.
- Analytics should be calculated from FinancialEvents.

## AI

- Gemini may interpret payment descriptions / merchant semantics.
- Prefer structured JSON responses.
- No custom model training.

## Frontend

- Mobile-first preferred.
- Exact visual design is intentionally not fixed.
- Demo clarity is more important than number of screens.

---

# Active tasks

## [DONE] Мобильный интерфейс MVP (дизайн + экраны)

Agent: Claude (frontend)
Completed: 2026-09-20

Implemented:
- Дизайн-система: графит + приглушённый шалфей, шрифт Golos Text, токены в `styles/index.css`, описание в `DESIGN.MD`.
- Оболочка `MobileShell` + нижний таб-бар: Главное / События / Аналитика / Счета.
- Главный экран: сверка «банк списал → из них ваши», карточка вопроса с ответом в один тап, три метрики, лента последних событий.
- Шторка «Откуда сумма» — реестр вычетов (killer feature «Explain my month»).
- События: лента по дням, фильтры Все / Вопросы / Не траты, карточка события с Money Graph.
- Аналитика: день / неделя / месяц / год, столбчатый график, категории, сравнение с прошлым периодом.
- Счета: балансы банков, мок-подключение нового банка, профиль и выход.
- Экран входа переведён в ту же палитру (логика auth не менялась).

Данные:
- Демо-датасет на фронте: `entities/finance/model/dataset.ts` — 4 счёта, ~190 транзакций (сентябрь собран вручную, январь–август генерируются детерминированно).
- Сентябрь покрывает все сценарии кейса: свой перевод, маркетплейс-карта, долг с частичными возвратами, общий счёт, возврат товара, снятие наличных, два непонятных входящих.
- Вся арифметика считается из транзакций в `entities/finance/model/analytics.ts`; суммы недель складываются в месяц (проверено: 11+13+11 тыс = 35 718 ₽).

Files changed:
- `frontend/index.html`, `frontend/public/favicon.svg`, `frontend/src/app/styles/index.css`
- `frontend/src/app/App.tsx`, `frontend/src/app/routes/AppRoutes.tsx`, `frontend/src/app/layouts/*`
- `frontend/src/entities/finance/**`, `frontend/src/features/{reconcile,events,attention}/**`, `frontend/src/shared/ui/**`, `frontend/src/shared/lib/format.ts`
- `frontend/src/pages/{home,events,analytics,accounts,auth}/**` (удалены `pages/Home.tsx`, `pages/Dashboard.tsx`)
- `DESIGN.MD`

API/contracts:
- Бэкенд пока не трогали: в OpenAPI есть только auth/users. Фронт берёт данные из `FinanceProvider`.
- Точка интеграции одна — `entities/finance/model/store.tsx`: заменить `initialEvents` на ответ API и `resolve()` на POST. Типы `FinancialEvent` / `Transaction` совпадают с моделью из AGENT.md.

How to test:
- `cd frontend && npm install && npm run dev`, войти, экран «Главное».
- Ответить на вопрос в карточке «Нужно решить» — сумма дохода и счётчик вопросов пересчитываются сразу.

Remaining issues:
- Данные живут на фронте; после появления backend-эндпоинтов нужно заменить провайдер.
- `pages/Profile` остался в старом стиле (доступен по `/profile`, из навигации убран).

Next recommended task:
- Backend: эндпоинты `/api/v1/events`, `/api/v1/summary?period=`, `/api/v1/events/{id}/resolve` в форме типов из `entities/finance/model/types.ts`.

---

## [DONE] Главный экран, счета, профиль (итерация 2)

Agent: Claude (frontend)
Completed: 2026-09-20

Implemented:
- Перенёс из референса `честный-месяц` структуру главного экрана и счетов, адаптировав под нашу палитру и токены.
- Главный экран: переключатель периода, фильтр по банку, донат-диаграмма по категориям (центр — честные траты, тап по сегменту показывает категорию), полоса сверки «банк списал → из них ваши», карточка вопроса, три метрики, сводка по счетам 2×2, последние события.
- Счета: общий баланс с бейджем «4 банка онлайн», карточки банков с фирменными плитками и масками карт, кнопки «Обновить все счета» (со спиннером) и «Подключить банк».
- Зелёный акцент заменён на живой: заливки `#059669`, текст/иконки `#10b981` (было бледное `#6e9b86`).
- Навигация: 5 слотов, по центру аватар пользователя → Профиль.
- Профиль переписан под мобильный дизайн: загрузка аватара и смена имени (реальные эндпоинты `/api/v1/users/me`), 4 метрики пользы, настройка «Наличные — это трата» (мгновенно пересчитывает событие снятия наличных), список банков, выход.
- Фильтр по банку пробрасывается в События и Аналитику, активный фильтр показан чипом со сбросом.

Files changed:
- `frontend/src/app/styles/index.css`, `frontend/src/app/layouts/TabBar.tsx`, `frontend/src/app/routes/AppRoutes.tsx`
- `frontend/src/entities/finance/**` (фильтр по банку, маски карт, фирменные цвета, политика наличных)
- `frontend/src/features/reconcile/ui/{SpendDonut,ReconcileStrip}.tsx` (вместо `ReconcileHero`)
- `frontend/src/features/accounts/ui/{BankFilter,ActiveBankChip}.tsx`
- `frontend/src/pages/{home,accounts,profile,events,analytics}/**` (`pages/Profile` удалён)
- `DESIGN.MD`

Notes:
- Папка `честный-месяц/` — референс от заказчика, в сборку не входит.
- Фильтр по банку отбирает события, которые затрагивают счёт банка; эффективные суммы событий при этом не делятся между банками.

---

## [DONE] Онбординг (моковый)

Agent: Claude (frontend)
Completed: 2026-09-20

Implemented:
- Старт → вход → загрузка PDF → чтение выписки → выбор сервисов (WB / Ozon / Яндекс Маркет) → разбор операций → главная.
- Экран входа разделён на «Старт» (обещание продукта, три шага, кнопка «Начать») и форму; логика auth не менялась.
- `/onboarding` вне MobileShell: полоса прогресса 1/4…4/4, основная кнопка внизу.
- Загрузка PDF: выбор файла, drag & drop, кнопка «Взять демо-выписку» для демо жюри.
- Экраны ожидания показывают реальные шаги движка (`ProcessingSteps`).
- Итоговый экран берёт числа из того же датасета, что и главная: 74 218 → 35 718 ₽, 38 операций, 30 событий, 3 уточнить.
- Гвард `RequireOnboarding`: без пройденного онбординга любой путь ведёт на `/onboarding`.
- В профиле — «Загрузить новую выписку» (сбрасывает флаг и запускает онбординг заново).

Files changed:
- `frontend/src/features/onboarding/**` (storage, ProcessingSteps)
- `frontend/src/pages/onboarding/ui/OnboardingPage.tsx`
- `frontend/src/pages/auth/ui/AuthPage.tsx`, `frontend/src/pages/profile/ui/ProfilePage.tsx`
- `frontend/src/app/routes/AppRoutes.tsx`, `frontend/src/entities/finance/index.ts` (`demoIntake`)

Notes для интеграции с бэком:
- Факт прохождения сейчас в `localStorage` — заменить на `isOnboarded` пользователя.
- Точки подключения: загрузка файла (`POST /imports` или `/imports/csv`), обработка и разбор (сейчас таймеры), выбор сервисов (нужен эндпоинт или сохранение в профиле).

---

Agents: when you start work, append an `[IN PROGRESS]` section below.

---

# Entry template

## [IN PROGRESS] Task name

Agent:
Started:

Goal:
- 

Files expected to change:
- 

Dependencies:
- 

Notes:
- 

---

When finished, replace/add:

## [DONE] Task name

Agent:
Completed:

Implemented:
- 

Files changed:
- 

API/contracts added or changed:
- 

How to test:
- 

Remaining issues:
- 

Next recommended task:
- 

---

If blocked:

## [BLOCKED] Task name

Agent:

Reason:
- 

Need:
- 

Safe workaround:
- 

## [DONE] Honest Month backend

Agent: OpenCode
Started: 2026-09-20
Goal: Implement the PDF case end-to-end: imports, deterministic events, attention, analytics, demo.
Files expected to change: backend/src/{domain/finance,service/finance,api/v1/finance,database/relational_db/tables/finance.py,migrations}, backend/tests, docs.
Decisions:
- API prefix /api/v1, snake_case fields, integer kopecks, RUB-only MVP.
- Immutable normalized transactions; deterministic events rebuilt atomically on import/resolve. Manual decisions persist on source transactions.
- Event contributions are dated by each original transaction, including negative expense adjustments on refund/reimbursement dates. All periods aggregate the same contributions in Europe/Moscow by default.
- Cash withdrawals count as expenses immediately (explicit policy); no second accounting of cash purchases in this MVP.
- Unknown credits contribute zero income and are explicitly provisional; unknown outgoing person transfers remain provisional expenses until resolved.
- Mock bank imports and CSV/JSON import; no production banking dependencies.
- Existing untracked backend/uv.lock belongs to prior work.

Implemented:
- Immutable accounts/transactions, stored event projections and transaction links; migration c31f20260920.
- Deterministic transfer, marketplace FIFO provenance, debt/partial repayment, shared bill, refund, cash and attention handling.
- 70-operation demo source; per-bank sync; JSON/CSV imports with atomic deduplication/conflict checks.
- Period analytics/custom ranges, previous-period comparison, dashboard balance card, Money Graph, daily digest and one-click resolutions.
- Pulled DESIGN.MD from origin/main (7da40dd); dashboard supplies Total Balance and mobile card data.
- Backend contract is snake_case, documented in docs/BACKEND_API.md and typed OpenAPI.

Verification:
- 27 unit/API tests passed (including existing unit suite). Financial API uses real SQLite async persistence and overridden auth; production app route mounting/auth-required checks are covered.
- Ruff on new modules/tests passed; poetry check --lock passed; PostgreSQL migration compiled with alembic upgrade a629654c84b7:c31f20260920 --sql.
- Docker is unavailable and local PostgreSQL/Redis/MinIO ports are closed, so live PostgreSQL migrations and the existing external-service integration suite were not run here.

Next task: frontend integration against docs/BACKEND_API.md; deploy existing compose and run demo steps.

## [DONE] T-Bank statements and marketplace purchase imports
Agent: OpenCode, 2026-09-20
Scope: bank PDF/text parser, reported-total reconciliation, statement metadata; buyer order imports for ozon/wildberries/yandex_market and transaction enrichment without duplicate spending.
Files: finance schemas/services/routes/tests, new marketplace table/migration, dependency lock and API docs.
Decisions: supplied private statement is not a repository fixture; synthetic fixtures only. Preserve operation and posting dates and card-currency amount. Internal contract transfers are ambiguous without ownership evidence. Generic Y.M/YandexBank descriptors do not establish Yandex Market purchases. Public seller APIs do not imply buyer-history access; report import support honestly, not simulated live connection.
Implemented: PDF/text preview/import with strict footer reconciliation, ordinal duplicate preservation, merchant aliases; marketplace buyer-order JSON import, candidate links, owner-scoped persistent linkage, item category enrichment without added expenses. Migration d42f20260920, pypdf dependency.
Verification: 43 unit/API tests pass, including statement-to-order-to-analytics and reimport. Original binary PDF unavailable; parser tested using synthetic representations of supplied text/layout. Live marketplace sync is not available (seller APIs are not consumer purchase-history APIs).

## [DONE] PDF statement parser

Agent: Codex
Started: 2026-09-20
Completed: 2026-09-20

Implemented:
- Coordinate-aware parser for multi-page Russian bank statement PDFs with multiline descriptions.
- Full statement JSON and normalized `/api/v1/imports` JSON with stable transaction IDs and integer kopecks.
- Metadata extraction, Moscow timezone handling, CLI, OCR/text-layer error, and parser documentation.
- Focused tests for multiple pages, line wrapping, comma/dot amounts, stable IDs, JSON serialization, and image-only input.

Files changed:
- `backend/src/parser_pdf/`
- `backend/tests/unit/test_parser_pdf.py`
- `backend/pyproject.toml`

Dependencies:
- PyMuPDF for coordinate-aware PDF text extraction.

API/contracts added or changed:
- `parse_pdf(bytes) -> Statement` and `Statement.to_import_dict(account_id)`.
- No HTTP route changed; generated import JSON is accepted by the existing `POST /api/v1/imports` route.

How to test:
- `PYTHONPATH=src python -m pytest tests/unit/test_parser_pdf.py -q`
- Local isolated execution passed all 3 parser scenarios; Python compilation and TOML parsing passed.

Remaining issues:
- The local environment lacks the existing backend dependencies (`boto3`) and package tools, so the full pytest suite could not start.
- PyPI access failed with SSL EOF while trying to install Poetry; `poetry.lock` therefore still needs `poetry lock` in an environment with package access.
- Text-layer PDFs are supported; scanned image-only PDFs require OCR before parsing.

Follow-up fix:
- Added a fixed UTC+03:00 fallback for `Europe/Moscow` when Windows Python has no IANA `tzdata` package.
- Calibrated the six column boundaries against the supplied real T-Bank PDF and corrected reference-number extraction.
- Real-file verification: 6 pages parsed, 115 transactions written to `backend/statement.json`.
- Full statement JSON uses the backend money contract: integer kopecks such as `amount_minor=-12220`.

---

## [DONE] Frontend Honest Month Integration & Visual Analytics

Agent: Antigravity
Completed: 2026-09-20
Implemented:
- Period switching: tabs for Day, Week, Month, Year with dynamic date ranges and live query to `/api/v1/dashboard`.
- Total Balance Card: total net balance across all accounts and horizontally scrollable connected bank accounts list (Т-Банк, Сбер, Альфа, Ozon).
- RealSpendingCard with "Explain My Month" accordion: displays exact excluded breakdown (internal transfers, marketplace top-ups, friend reimbursements, refunds) explaining the difference between bank outflow and real spending.
- Interactive Recharts visual analytics (`SpendingChart.tsx`):
  - Donut / Pie chart with category percentage, colors, hover tooltips, and central total sum.
  - Timeline Area chart displaying daily spending dynamics.
- Needs Attention 1-tap resolution with instant live recalculation.
- Interactive Money Graph for individual reconstructed financial events.
Files changed:
- `frontend/src/pages/Home.tsx`
- `frontend/src/features/finance/ui/RealSpendingCard.tsx`
- `frontend/src/features/finance/ui/SpendingChart.tsx`
- `frontend/src/features/finance/ui/TotalBalanceCard.tsx`
- `frontend/src/features/finance/ui/NeedsAttention.tsx`
- `frontend/src/features/finance/ui/MoneyGraph.tsx`
- `frontend/src/shared/lib/financeLabels.ts`
- `frontend/src/shared/lib/formatters.ts`
- `frontend/src/shared/api/finance.ts`
Verification:
- `npm run build` succeeds cleanly with 0 TypeScript/bundling errors.
- Container `nginx` rebuilt and tested via `curl http://localhost` (HTTP 200).

