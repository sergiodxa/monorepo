# @sdxc/facets

Faceted filtering over in-memory records: URL filters, disjunctive facet counts and range buckets.

One definition parses a URL's filters, writes them back, narrows a list of records and counts
every option with the other facets applied, so a filter link and the number beside it always
agree. Built for catalogues and lists small enough to filter in the request.

## Installation

```sh
npm add @sdxc/facets
```

Parsing returns a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) and
fails with the `ValidationError` from [`@sdxc/validate`](https://www.npmjs.com/package/@sdxc/validate).

## Usage

### Define the facets once

```typescript
import { createFacets } from "@sdxc/facets";

interface Poster {
	style: string;
	colors: string[];
	price: number;
	stock: number;
}

export const posterFacets = createFacets<Poster>()
	.terms("style", (poster) => poster.style, { values: ["geometric", "botanical", "travel"] })
	.terms("color", (poster) => poster.colors)
	.range("price", (poster) => poster.price, { buckets: [0, 2500, 5000, 10000] })
	.toggle("inStock", (poster) => poster.stock > 0, { param: "in_stock" });
```

### Filter and count from the request URL

```typescript
import { isFailure } from "@sdxc/result";

let filters = posterFacets.parse(url.searchParams);
// ?style=travel&color=ochre&color=blue&price_min=2500&price_max=5000&in_stock=1
if (isFailure(filters)) return new Response("Bad Request", { status: 400 });

let { items, total, counts } = posterFacets.apply(posters, filters.data);

counts.color; // [{ value: "ochre", count: 12, selected: true }, { value: "blue", count: 7, selected: true }, …]
counts.price.buckets; // [{ min: 0, max: 2500, count: 3, selected: false }, …]
counts.inStock; // { count: 18, selected: true }
```

Each facet's counts are taken over the records every _other_ facet leaves. Choosing "ochre"
narrows the styles and prices, while the other colours keep the counts a visitor would get by
adding them.

### Build the links

```typescript
let href = (next: typeof filters.data) => `?${posterFacets.serialize(next, url.searchParams)}`;

href(posterFacets.toggleTerm(filters.data, "color", "green")); // tick or untick one option
href(posterFacets.set(filters.data, "price", { min: 0, max: 2500 })); // pick a bucket
href(posterFacets.clear(filters.data)); // "Clear all"
```

`serialize()` keeps the parameters no facet owns (`q`, `sort`) and writes terms in a stable
order, so one selection always yields one URL.

## API

### `createFacets<T>(): FacetSet<T>`

Starts an empty facet set for records of type `T`. Every facet name is inferred from the
chain, and a name may be used only once.

### `.terms(name, read, options?)`

A facet over values a record carries: `read` returns one string, several, or nothing. Chosen
values match a record carrying any one of them. Options:

- `param`: the query parameter; it defaults to the name and repeats once per value, the shape a
  group of checkboxes submits.
- `values`: the accepted values in display order. Listed even at a count of 0, and any other
  value in a URL fails to parse.
- `limit`: the most values one URL may choose; defaults to 50.

### `.range(name, read, options?)`

A numeric facet filtered by `{ min, max }`, where `min` is inclusive and `max` exclusive.
`buckets: [0, 25, 50]` counts `[0, 25)`, `[25, 50)` and `[50, ∞)`. Read from `minParam` and
`maxParam`, which default to `<name>_min` and `<name>_max`. A record without a value stays
while the range is open.

### `.toggle(name, read, options?)`

A yes/no facet. Reads `1`, `true` or `on` as on and `0`, `false` or `off` as off, and writes `1`.

### `.parse(searchParams): Result<Filters, ValidationError>`

Reads every facet's selection. Blank parameters are absent. Every problem is reported in one
failure, each issue's `path` naming its parameter: an undeclared value, a non-number, a
reversed range, or too many values.

### `.serialize(filters, base?): URLSearchParams`

Writes a full or partial selection into a copy of `base`, replacing only the facets' own
parameters.

### `.apply(records, filters?): FacetResult`

Returns `{ items, total, counts }`: the matching records in input order, and every facet's
counts in one pass over the records. A chosen term is always listed, at a count of 0 when
nothing matches it, so its checkbox can be unticked. Range counts carry the `min` and `max`
values of the counted records for a slider's bounds.

### `.empty()`, `.toggleTerm()`, `.set()`, `.clear()`

Return new selections: everything cleared, one term flipped, one facet replaced, and one facet
(or all of them) cleared.

### `.applied(filters): AppliedFilter[]`

One entry per chosen term, range and toggle, each with `filters` already minus that entry, for
a row of removable chips.

### Types

`Filters`, `Counts`, `FacetResult`, `TermCount`, `RangeCounts`, `BucketCount`, `ToggleCount`,
`NumberRange`, `AppliedFilter`, `FacetShape`, `FacetKind` and `FacetsOfKind`, plus the option
types `TermsOptions`, `RangeOptions` and `ToggleOptions`.

## Patterns

### Pattern: A filter form that works without script

```typescript
import { createFacets } from "@sdxc/facets";
import { isFailure } from "@sdxc/result";

interface Book {
	genre: string;
	pages: number;
}

const BOOK_FACETS = createFacets<Book>()
	.terms("genre", (book) => book.genre)
	.range("pages", (book) => book.pages, { buckets: [0, 200, 400] });

export function listBooks(url: URL, books: Book[]) {
	let filters = BOOK_FACETS.parse(url.searchParams);
	if (isFailure(filters)) return { status: 400, issues: filters.error.issues };

	let { items, counts } = BOOK_FACETS.apply(books, filters.data);
	let chips = BOOK_FACETS.applied(filters.data).map((chip) => ({
		label: typeof chip.value === "string" ? chip.value : chip.facet,
		href: `?${BOOK_FACETS.serialize(chip.filters, url.searchParams)}`,
	}));
	return { status: 200, items, counts, chips };
}
```

Render `counts.genre` as checkboxes named `genre` and the range as two number inputs named
`pages_min` and `pages_max`, inside one `<form method="get">`. Submitting the form produces
exactly the URL `parse()` reads, so the page works before any script loads. Serialize chip
links onto a copy of the search parameters with `page` deleted, so a changed filter starts
again from page one.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/facets": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
