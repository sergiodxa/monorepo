# @sdxc/money

Money in integer minor units: parse typed amounts, split, convert and format with `Intl`.

## Installation

```sh
npm add @sdxc/money
```

## Usage

Hold every amount as an integer of the currency's minor unit (cents, pence, whole yen) with
its ISO 4217 code, and let the package do the arithmetic and the text.

```typescript
import { allocate, formatAmount, parseAmount } from "@sdxc/money";

let total = parseAmount("84.20", "EUR"); // 8420
let shares = allocate(8420, 3); // [2807, 2807, 2806]
formatAmount(shares[0]!, "EUR", { locale: "en-IE" }); // "€28.07"
```

A tip and a converted total:

```typescript
import { convert, formatAmount, percentOf } from "@sdxc/money";

let subtotal = 4280;
let tip = percentOf(subtotal, 15); // 642
let inPounds = convert(subtotal + tip, "EUR", "GBP", 0.8538); // 4202
formatAmount(inPounds, "GBP"); // "£42.02"
```

A statement row, with money in marked and money out plain:

```typescript
import { formatAmount } from "@sdxc/money";

formatAmount(210000, "EUR", { sign: "ledger" }); // "+€2,100.00"
formatAmount(-2340, "EUR", { sign: "ledger" }); // "€23.40"
formatAmount(-2340, "EUR"); // "−€23.40", with U+2212
```

## API

### `currencyExponent(currency: string): number`

The digits after the decimal point a currency uses, from `Intl`'s ISO 4217 data: 2 for
`EUR`, 0 for `JPY`, 3 for `BHD`. Stands in for
`new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits`.

### `toMinor(major: number, currency: string): number`

A major-unit number as minor units, rounded half away from zero: `toMinor(1.005, "EUR")` is
`101`, where `Math.round(1.005 * 100)` gives `100`.

### `toMajor(minor: number, currency: string): number`

Minor units as a major-unit number, for a chart axis or a `<data value>`.

### `parseAmount(input: string, currency: string, options?: ParseOptions): number | null`

Reads typed text as minor units. Currency symbols, ISO codes, spaces and the locale's
grouping marks are ignored, and the locale's decimal mark splits the minor digits. A sign,
stray characters, or more decimals than the currency has return `null`, so the form asks again.

- `options.locale`: whose marks the text uses (`"de-DE"` reads `1.204,50`). Default `"en-US"`.
- `options.allowZero`: accept `0`. Default `false`.

### `allocate(total: number, parts: number | number[]): number[]`

Splits a total into shares that add back to it exactly: a count splits evenly, a list of
weights in proportion. Leftover minor units go to the largest remainders, earliest first.

### `percentOf(amount: number, percent: number): number`

A percentage of an amount in minor units, rounded half away from zero: a tip, a fee, a tax line.

### `convert(amount: number, from: string, to: string, rate: number): number`

Minor units of `from` as minor units of `to`, at a rate quoted per major unit, rounded to
the target's own precision.

### `sumByCurrency(amounts: Iterable<Money>): Map<string, number>`

Totals amounts per currency, in first-seen order, so euros never add to pounds.

### `formatAmount(amount: number, currency: string, options?: FormatOptions): string`

Minor units as text in a locale, with a true minus (U+2212).

- `options.locale`: default `"en-US"`.
- `options.sign`: `"auto"` marks negatives, `"always"` marks both directions, `"never"`
  shows the magnitude, `"ledger"` marks money in with `+` and shows money out plain.
- `options.compact`: `€12.5K` for an axis or a tile.
- `options.display`: `"narrowSymbol"` (default), `"symbol"` or `"code"`.

### `amountParts(amount: number, currency: string, options?: FormatOptions): Intl.NumberFormatPart[]`

The same text split into `Intl`'s parts (`currency`, `integer`, `decimal`, `fraction`…), so a
component can set one part apart, such as smaller decimals under a balance.

### `roundHalfAway(value: number): number`

Rounds half away from zero, so `2.5` and `-2.5` round to the same magnitude.

### Types

#### `Money`

`{ amount: number; currency: string }`: integer minor units and an ISO 4217 code.

#### `SignDisplay`, `FormatOptions`, `ParseOptions`

The options described above.

## Pattern: Split a bill from a form

Read what was typed, refuse it with a message when it is not an amount, and split it so the
shares add back to the bill.

```typescript
import { allocate, formatAmount, parseAmount } from "@sdxc/money";

function splitBill(form: FormData, people: number) {
	let total = parseAmount(String(form.get("amount") ?? ""), "EUR", { locale: "en-IE" });
	if (total === null) return { error: "Enter an amount like 42 or 42.50." };
	let shares = allocate(total, people);
	return {
		shares,
		summary: shares.map((share) => formatAmount(share, "EUR", { locale: "en-IE" })).join(" + "),
	};
}
```

## Pattern: A balance across currencies

Convert each account to one currency at your rates, then format the total.

```typescript
import { convert, formatAmount } from "@sdxc/money";

let rates: Record<string, number> = { EUR: 1, GBP: 1.1712, JPY: 0.006104 };
let accounts = [
	{ amount: 348216, currency: "EUR" },
	{ amount: 124050, currency: "GBP" },
	{ amount: 84500, currency: "JPY" },
];
let total = accounts.reduce(
	(sum, account) =>
		sum + convert(account.amount, account.currency, "EUR", rates[account.currency]!),
	0,
);
formatAmount(total, "EUR", { locale: "en-IE" }); // "€5,450.82"
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/money": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
