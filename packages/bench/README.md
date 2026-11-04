# @sdxc/bench

Bundle-weight and HTTP latency budgets for packages and running apps.

Hold a package entry to a **gzipped** size after `bun build --minify`, and sample
latency against a URL that is already running. Code microbenchmarks use Vitest’s
own `bench` APIs — this package does not add custom timing matchers.

## Installation

```sh
npm add @sdxc/bench
```

[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) and
[`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration) install alongside.

## Usage

### Weigh an entry point

```typescript
import { assertWeight, weigh } from "@sdxc/bench";
import { isFailure, unwrap } from "@sdxc/result";

let weight = unwrap(await weigh(new URL("./index.ts", import.meta.url).pathname));
// { minified: 74506, gzipped: 24537 }

let check = assertWeight(weight, { maxGzipped: 25 * 1024 });
if (isFailure(check)) throw check.error;
```

The build targets the browser with nothing externalized, so the number covers
every dependency the entry pulls in. Gzipped size is the budget that fails CI;
minified is reported for diagnosis and may be capped with `maxMinified`.

### Sample HTTP latency

```typescript
import { assertHttpBudgets, sampleHttp } from "@sdxc/bench";
import { unwrap } from "@sdxc/result";

let report = await sampleHttp({
	url: "http://127.0.0.1:8787/",
	requests: 50,
	concurrency: 5,
	timeoutMs: 5_000,
});

unwrap(assertHttpBudgets(report, { p95: 200, p99: 500 }));
```

Time budgets elsewhere accept [`DurationInput`](https://www.npmjs.com/package/@sdxc/duration):
a string such as `"200ms"` or a bare millisecond number.

### Code performance with Vitest

Use Vitest’s built-in `bench` — not custom matchers from this package.

On Vitest 4 (this monorepo’s pin), register suite benchmarks in a `*.bench.ts`
file and run them with `vitest bench` / `vp test bench`:

```typescript
import { Markdown } from "@sdxc/markdown";
import { bench, describe } from "vitest";

const SAMPLE = "# Title\n\nA short paragraph with **emphasis**.\n";

describe("Markdown.parse", () => {
	bench("parse a short article", () => {
		Markdown.parse(SAMPLE);
	});
});
```

On Vitest 5+, compare implementations inside a normal test with the `bench`
fixture and `toBeFasterThan`:

```typescript
import { expect, test } from "vitest";

test("Markdown.parse stays ahead of a naive walk", async ({ bench }) => {
	let result = await bench.compare(
		bench("Markdown.parse", () => {
			Markdown.parse(SAMPLE);
		}),
		bench("naive", () => {
			naive(SAMPLE);
		}),
	);
	expect(result.get("Markdown.parse")).toBeFasterThan(result.get("naive"), { delta: 0.1 });
});
```

Pathological “must stay linear” ceilings keep a plain `performance.now()` delta
and `expect(elapsed).toBeLessThan(ms)` — those guards need a wide gap to failure,
not a statistical comparison.

## Command line

`sdxc-bench` runs the same checks from a terminal or a script:

```sh
bunx @sdxc/bench --help
```

With [`@sdxc/kit`](https://www.npmjs.com/package/@sdxc/kit) installed,
`sdxc pkg bench …` runs the same command line.

```sh
bunx @sdxc/bench weigh ./src/index.ts --max-gzipped 25600
bunx @sdxc/bench http https://example.com/ --requests 20 --p95 200ms --json
```

`--timeout`, `--p50`, `--p95`, `--p99` and `--mean` accept a duration string
(`200ms`, `5s`) or a bare millisecond number (`200`). Exit `1` when a budget
fails or every request errors; exit `2` for usage or an invalid duration.

## API

### `weigh(entry: string, root?: string): Promise<Result<Weight, WeightError>>`

Bundles `entry` with `bun build --minify --target=browser --format=esm` from
`root` (default `process.cwd()`) and returns `{ minified, gzipped }` in bytes.

### `assertWeight(weight, budget, entry?): Result<Weight, WeightError>`

Fails when `weight.gzipped` exceeds `budget.maxGzipped`, or when optional
`budget.maxMinified` is set and missed.

### `sampleHttp(options): Promise<HttpReport>`

Issues `requests` with at most `concurrency` in flight, timing each with
`performance.now()`, and returns min / mean / p50 / p95 / p99 / max over the
successful samples.

### `assertHttpBudgets(report, budgets): Result<HttpReport, HttpBudgetError>`

Fails when a declared `p50` / `p95` / `p99` / `mean` ceiling (milliseconds) is
missed.

### `budgetMs(input)` / `parseBudgetFlag(text)`

Normalize a [`DurationInput`](https://www.npmjs.com/package/@sdxc/duration) or a
CLI flag (`"200"` / `"200ms"`) to milliseconds.

## Patterns

### Hold a package entry in CI

```typescript
import { join } from "node:path";
import { weigh } from "@sdxc/bench";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const BUDGET = 25 * 1024;

test(`format entry stays under ${BUDGET} bytes gzipped`, async () => {
	let weight = unwrap(await weigh(join(ROOT, "src/index.ts"), ROOT));
	expect(
		weight.gzipped,
		`minified ${weight.minified}, gzipped ${weight.gzipped}`,
	).toBeLessThanOrEqual(BUDGET);
});
```

### Gate a local app before release

```sh
bun run dev &
bunx @sdxc/bench http http://127.0.0.1:8787/health --requests 50 --p95 200ms --p99 500ms
```

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
		"@sdxc/bench": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
