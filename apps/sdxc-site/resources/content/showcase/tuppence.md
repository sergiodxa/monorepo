---
title: Tuppence
headline: A personal bank in four currencies where every amount is a value, every filter is an address, and no money moves
summary: An invented personal bank with euro, pound, dollar and yen accounts, a statement by day, budgets, savings pots, bills, cards that freeze and a transfer flow, all with fake money.
tagline: A bank in four currencies, fake money
cover: home
shots:
  - id: home
    page: ""
    alt: Tuppence's home screen, a total balance in a serif face, this month's spending curve against last month's, a strip of upcoming bills and recent activity.
  - id: sheet
    page: "transactions?tx=t0144"
    highlight: "[data-slot='detail-sheet-panel']"
    alt: A transaction's side sheet, with its amount, a category picker, a split between people and a note, each with its own save button.
  - id: budgets
    page: "budgets"
    highlight: "[data-slot='tuppence-panel']:has([data-slot='budget-over'])"
    alt: Budget bars per category, one past its limit with the overspend drawn as a hatched segment after the solid part.
  - id: spending
    page: "spending"
    highlight: "[data-slot='tuppence-panel']:has(svg)"
    wait: 1000
    alt: Spending by category as a donut chart with one colour per category and the month's total in the middle.
  - id: card
    page: "cards"
    highlight: "[data-slot='payment-card']"
    alt: A drawn payment card in terracotta with a masked number ending 4821, the holder's name and an expiry date.
  - id: review
    page: "transfer/review?payee=tomas&amount=25.00&reference=Dinner"
    highlight: "[data-slot='tuppence-panel']:has([data-slot='review-amount'])"
    alt: The transfer review step, a step indicator above the payee, the amount in a serif face, the reference and a Send button with a note that the demo moves no money.
  - id: bills
    page: "recurring?on=2026-11-20"
    highlight: "[data-slot='day-strip']"
    alt: A strip of the next two weeks, each day with its total due, one day selected.
  - id: phone
    page: ""
    viewport: phone
    alt: Tuppence's home on a phone, a Send money button in the top bar, the total balance, a budgets alert and the spending card above a bottom tab bar.
---

Tuppence is an invented personal bank and budgeting app for an invented person: a freelance illustrator in Lisbon with euro, pound, dollar and yen accounts. It has a home screen, a statement, spending by category, budgets, savings pots, bills and subscriptions, cards, a page per currency account, and a transfer flow. The art direction is oat paper with terracotta clay, serif balances in tabular figures, and softly rounded cards.

All of its money is fake. Card and account numbers are masked placeholders, and every screen that moves money says the demo moves none. What the build shows is real, though: money handled as values rather than strings, a statement whose every filter is an address, and finance components from `@sdxc/ui` made for exactly these jobs. Every screen renders on the server, and every change a visitor makes lives in their own cookies.

## The brief

Finance apps fail in small, costly ways. A split that loses a cent. A total in the wrong currency. A yen balance printed with two decimals. A filter that resets on reload. A destructive action that asks "Are you sure?" when it should simply offer Undo. A real bank also has to stay calm: big numbers, clear trends, and nothing that looks alarming unless it is.

Tuppence takes those on directly. Amounts are parsed, split, converted and formatted by [@sdxc/money](/api/money), so the arithmetic is the package's job. Filters, the open transaction, the chosen month and the transfer's progress all live in the URL. Freezing a card acts at once and offers Undo. The statement, cards and transfer steps come from [Ledger](/api/ui/ledger), [PaymentCard](/api/ui/payment-card), [StepIndicator](/api/ui/step-indicator) and [Amount](/api/ui/amount).

## Money as values

Every figure on screen passes through [@sdxc/money](/api/money). It parses what a visitor types in the app's own locale, formats each balance, and converts each account to euros at a fixed rate for the home total. That includes the yen account, whose currency has no minor unit, so it never grows a decimal point. The [Amount](/api/ui/amount) component sets each balance in the serif face with tabular figures, with the minor units set apart.

Splitting a bill is where most hand-written money code goes wrong. Tuppence calls `allocate()`, which divides an amount in minor units into shares that always add up to the original. Leftover cents go one at a time to the shares with the largest remainders, the earliest first on a tie, so `allocate(1000, 3)` is always `[334, 333, 333]`:

```tsx
let canSplit = entry.amount < 0 && entry.method === "card";
let shares = entry.split === undefined ? [] : allocate(entry.amount, entry.split);
```

Only card payments can be split, and the shares the sheet shows are exactly what `allocate()` returns.

## A statement grouped by day

The statement is a [Ledger](/api/ui/ledger): each day has a title and a total, and each entry shows a merchant mark, a title, its category and its amount. A [FilterBar](/api/ui/filter-bar) above it holds search, category and account facets, and money in or out. Every one of them is a query parameter, so `transactions?category=eating-out` or `transactions?account=gbp` is a view you can bookmark, and an empty search such as `transactions?q=zzz` gets its own empty state.

`?tx=` opens a [DetailSheet](/api/ui/detail-sheet) beside the statement for one transaction. Its category, its split and its note each save with their own button, so changing one never submits the others. While the sheet is open, the page and the shell's content pane hold still behind it, and they scroll again once it closes.

![A transaction's side sheet, with its amount, a category picker, a split between people and a note, each with its own save button](/showcase/tuppence/sheet.webp "Each part of a transaction saves on its own, and the statement stays where it was behind the sheet.")

The home screen uses the same Ledger for recent activity, and a savings pot's page uses it for that pot's history.

## Spending and budgets you can read at a glance

The home screen draws this month's spending as a cumulative line against last month's, in the brand's clay, with the [Chart](/api/ui/chart) component. Spending, at `spending?month=2026-11`, breaks the month down as a donut by category and as bars comparing this month with the last.

![Spending by category as a donut chart with one colour per category and the month's total in the middle](/showcase/tuppence/spending.webp "Spending breaks the month into categories, and each month is its own address.")

Budgets give each category a progress bar. A budget past its limit draws the spending within the limit as a solid bar and the overspend as a hatched segment after it, and the bar is scaled to whichever is larger, so the overspend always has room. An "On pace for" line under each bar says where the month is heading. The invented budgets are set so that one category is over and others are close. An [Alert](/api/ui/alert) names them, with an icon beside a title and a description, and the home screen carries the same warning as "3 budgets need a look".

![Budget bars per category, one past its limit with the overspend drawn as a hatched segment after the solid part](/showcase/tuppence/budgets.webp "An overspend gets its own hatched segment, so being over reads differently from being full.")

Editing a budget is a dialog opened from its address, `budgets?edit=groceries`, with a [TextField](/api/ui/text-field) for the new limit. Progress bars, focus rings and selected states all read the theme's brand fill, and the primary buttons (Review, Send, Move money, Save budget) are in the brand colour.

## Cards that freeze, and Undo that replaces a confirmation

Each card is a drawn [PaymentCard](/api/ui/payment-card) with its network, chip, masked number, holder and expiry. A card's own page, `cards?card=<id>`, shows its monthly limit and a freeze control.

![A drawn payment card in terracotta with a masked number ending 4821, the holder's name and an expiry date](/showcase/tuppence/card.webp "The card is drawn, and its number is a masked placeholder.")

Freezing acts the moment it is pressed, with no dialog. The [Toasts](/api/ui/toasts) message that follows carries an Undo button, and Undo posts the opposite state to the same address. Freezing is easy to reverse and urgent when a card is lost, so it acts immediately and Undo covers mistakes.

## A transfer with a step in every address

A transfer runs through three addresses: choosing a payee at `transfer`, then an amount at `transfer/amount?payee=tomas`, then a review at `transfer/review?payee=tomas&amount=25.00&reference=Dinner`. A [StepIndicator](/api/ui/step-indicator) marks the current step, and the finished steps link back. Because the payee, amount and reference all live in the query, going back to change the amount loses nothing, and the review page can be reloaded safely.

![The transfer review step, a step indicator above the payee, the amount in a serif face, the reference and a Send button with a note that the demo moves no money](/showcase/tuppence/review.webp "The review step carries the whole transfer in its address, and says plainly that nothing moves.")

Sending posts the transfer and redirects to a sent screen. Amounts typed on the amount step are read with `parseAmount()` in the app's locale. A transfer the visitor sends is kept in their cookies, so it shows up in the statement afterwards.

## Bills ahead, and the visitor's own state

Bills and subscriptions repeat every month. The recurring screen shows what they cost per month, and a [DayStrip](/api/ui/day-strip) of the next two weeks with each day's total. Picking a day, as in `recurring?on=2026-11-20`, marks the payments due on it. The home screen shows the same strip under "Coming up", listing only bills and subscriptions, not transfers into pots.

![A strip of the next two weeks, each day with its total due, one day selected](/showcase/tuppence/bills.webp "Each day on the strip shows what is due, and picking one is a link.")

Everything a visitor changes is kept in their own cookies: categories, notes and splits on transactions, frozen cards, budgets, money moved into pots, and transfers sent. Every screen reads that state on the server, so changes survive a reload and work without script, and a request carrying it always renders fresh rather than from the edge cache. Resetting the demo clears it all.

Desktops get an [AppShell](/api/ui/app-shell) sidebar whose collapsed rail shows only the mark. Phones get a bottom [TabBar](/api/ui/tab-bar) for Home, Activity, Spending, Pots and Cards, and Send money stays in the top bar on every width.

![Tuppence's home on a phone, a Send money button in the top bar, the total balance, a budgets alert and the spending card above a bottom tab bar](/showcase/tuppence/phone.webp "On a phone, a bottom tab bar holds the main sections, and Send money stays in the top bar.")

## Takes after

- [Monzo](https://monzo.com) — savings pots, bills ahead, and a card you freeze from its own screen. Tuppence offers Undo after the freeze.
- [Wise](https://wise.com) — one balance per currency, each also shown in your home currency, and a payee, amount and review transfer flow.
- [YNAB](https://www.ynab.com) — a budget per category that tells you when you are over or close to the limit.

## Where to start reading

- [`tuppence/transactions.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/tuppence/transactions.tsx) — the statement, its filters in the query and the edit sheet.
- [`tuppence/transfer.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/tuppence/transfer.tsx) — three steps, each one an address.
- [`tuppence/budgets.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/tuppence/budgets.tsx) — budget bars with the hatched overspend.
- [`tuppence/state.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/tuppence/state.ts) — what one visitor did, kept in their cookies.
