# @sdxc/money

Money in integer minor units: parse typed amounts, split, convert and format with `Intl`.

## Installation

```sh
npm add @sdxc/money
```

## Usage

### Format an amount

Hold every amount as an integer of its currency's minor unit (cents for euros, whole yen for
yen) beside its ISO 4217 code, and turn it into text only when you show it.

```typescript
import { formatAmount } from "@sdxc/money";

formatAmount(4250, "EUR"); // "€42.50"
formatAmount(4250, "JPY"); // "¥4,250"
formatAmount(-2340, "EUR", { locale: "de-DE" }); // "−23,40 €", with a true minus
```

### Read an amount someone typed

```typescript
import { parseAmount } from "@sdxc/money";

parseAmount("42.50", "EUR"); // 4250
parseAmount("1.204,50 €", "EUR", { locale: "de-DE" }); // 120450
parseAmount("42.505", "EUR"); // null: euros have two decimals
parseAmount("-5", "EUR"); // null
```

### Split a total so the shares add back

```typescript
import { allocate } from "@sdxc/money";

allocate(1000, 3); // [334, 333, 333]
allocate(1000, [2, 1, 1]); // [500, 250, 250]
```

`Math.round(1000 / 3)` three times gives 999; the leftover cent here goes to the first share.

### Take a percentage and convert

```typescript
import { convert, percentOf } from "@sdxc/money";

percentOf(4280, 15); // 642, a 15% tip on €42.80
convert(4922, "EUR", "GBP", 0.8538); // 4202, €49.22 as £42.02
convert(84500, "JPY", "EUR", 0.006104); // 51579, ¥84,500 rounded to whole cents
```

### Total amounts per currency

```typescript
import { sumByCurrency } from "@sdxc/money";

sumByCurrency([
	{ amount: 1250, currency: "EUR" },
	{ amount: 900, currency: "GBP" },
	{ amount: -300, currency: "EUR" },
]); // Map { "EUR" => 950, "GBP" => 900 }
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

## Pattern: Read a price in a form handler

Parse the price once where the form arrives, answer with the field's error when the text is
not an amount, and pass minor units on from there, so nothing downstream sees a float.

```typescript
import { formatAmount, parseAmount } from "@sdxc/money";

async function updatePrice(request: Request, save: (cents: number) => Promise<void>) {
	let input = (await request.formData()).get("price");
	let price = typeof input === "string" ? parseAmount(input, "USD") : null;
	if (price === null) {
		return Response.json(
			{ field: "price", error: "Enter a price like 19 or 19.99." },
			{ status: 422 },
		);
	}
	await save(price);
	return Response.json({ price, label: formatAmount(price, "USD") });
}
```

## Pattern: Split a bill with the tip

Add the tip in minor units, then split the whole bill, so what everyone pays adds up to
exactly what the restaurant charges.

```typescript
import { allocate, formatAmount, percentOf } from "@sdxc/money";

function splitBill(subtotal: number, tipPercent: number, people: number) {
	let tip = percentOf(subtotal, tipPercent);
	return allocate(subtotal + tip, people).map((share) => formatAmount(share, "EUR"));
}

splitBill(8420, 10, 3); // ["€30.88", "€30.87", "€30.87"]
```

To share the tip by what each person ordered, pass their subtotals as weights:
`allocate(842, [3200, 2900, 2320])` gives `[320, 290, 232]`.

## Pattern: A net worth across currencies

Total each currency first and convert each total once, so a currency is rounded once rather
than once per account, and a missing rate stops the sum instead of counting it as zero.

```typescript
import type { Money } from "@sdxc/money";
import { convert, formatAmount, sumByCurrency } from "@sdxc/money";

function netWorth(accounts: Money[], rates: Map<string, number>, base: string) {
	let total = 0;
	for (let [currency, amount] of sumByCurrency(accounts)) {
		let rate = currency === base ? 1 : rates.get(currency);
		if (rate === undefined) return null;
		total += convert(amount, currency, base, rate);
	}
	return formatAmount(total, base);
}

netWorth(
	[
		{ amount: 348216, currency: "EUR" },
		{ amount: 124050, currency: "GBP" },
		{ amount: 84500, currency: "JPY" },
		{ amount: -12000, currency: "EUR" },
	],
	new Map([
		["GBP", 1.1712],
		["JPY", 0.006104],
	]),
	"EUR",
); // "€5,330.82"
```

## Pattern: Show the cents smaller

Split the formatted text into its whole part and its cents, so a balance can set the cents
in a smaller size in any locale and currency, including ones with no cents at all.

```typescript
import { amountParts } from "@sdxc/money";

function splitCents(amount: number, currency: string) {
	let parts = amountParts(amount, currency);
	let isCents = (part: Intl.NumberFormatPart) =>
		part.type === "decimal" || part.type === "fraction";
	return {
		whole: parts
			.filter((part) => !isCents(part))
			.map((part) => part.value)
			.join(""),
		cents: parts
			.filter(isCents)
			.map((part) => part.value)
			.join(""),
	};
}

splitCents(348216, "EUR"); // { whole: "€3,482", cents: ".16" }
splitCents(84500, "JPY"); // { whole: "¥84,500", cents: "" }
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
