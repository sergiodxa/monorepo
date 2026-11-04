# @sdxc/bench

Bundle-weight and HTTP latency budgets for packages and running apps.

Hold a package entry to a **gzipped** size after a minified browser bundle, and
sample latency against a URL that is already running.

## Installation

```sh
npm add @sdxc/bench
```

[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) and
[`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration) install alongside.

## Usage

### Weigh an entry point

```typescript
import { weigh } from "@sdxc/bench";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

test("the format entry stays small", async () => {
	let weight = unwrap(await weigh(new URL("./index.ts", import.meta.url).pathname));
	expect(weight.gzipped).toBeLessThan(25 * 1024);
});
```

The build targets the browser with every dependency inlined, so the number covers
what a consumer pulls in. Gzipped size is the budget; minified is reported beside
it for diagnosis.

### Sample HTTP latency

```typescript
import { sampleHttp } from "@sdxc/bench";
import { expect, test } from "vitest";

test("the health endpoint answers within budget", async () => {
	let report = await sampleHttp({
		url: "http://127.0.0.1:8787/health",
		requests: 20,
		concurrency: 5,
		timeoutMs: 5_000,
	});

	expect(report.failures).toBe(0);
	expect(report.p95).toBeLessThan(200);
	expect(report.p99).toBeLessThan(500);
});
```

`failures` counts requests that errored or timed out; `ok` is the rest of
`requests`. Time budgets on the command line accept
[`DurationInput`](https://www.npmjs.com/package/@sdxc/duration): a string such as
`"200ms"` or a bare millisecond number.

## Command line

With [`@sdxc/kit`](https://www.npmjs.com/package/@sdxc/kit) installed,
`sdxc pkg bench` runs the same checks from a terminal:

```sh
sdxc pkg bench --help
sdxc pkg bench weigh ./src/index.ts --max-gzipped 25600
sdxc pkg bench http https://example.com/ --requests 20 --p95 200ms --json
```

`--timeout`, `--p50`, `--p95`, `--p99` and `--mean` accept a duration string
(`200ms`, `5s`) or a bare millisecond number (`200`). Exit `1` when a budget
fails or every request errors; exit `2` for usage or an invalid duration.

## API

### `weigh(entry: string, root?: string): Promise<Result<Weight, WeightError>>`

Bundles `entry` for the browser (minified, dependencies inlined) from `root`
(default `process.cwd()`) and returns `{ minified, gzipped }` in bytes.

### `assertWeight(weight, budget, entry?): Result<Weight, WeightError>`

Answers a `Result` when `weight.gzipped` exceeds `budget.maxGzipped`, or when
optional `budget.maxMinified` is set and missed. Used by the CLI's
`--max-gzipped` flag; in tests, compare `weight.gzipped` with an expectation.

### `sampleHttp(options): Promise<HttpReport>`

Issues `requests` with at most `concurrency` in flight, timing each with
`performance.now()`. The report's `ok` / `failures` split those attempts, and
min / mean / p50 / p95 / p99 / max cover the successful samples only.

### `assertHttpBudgets(report, budgets): Result<HttpReport, HttpBudgetError>`

Answers a failure when a declared `p50` / `p95` / `p99` / `mean` ceiling
(milliseconds) is exceeded. Used by the CLI; in tests, compare the report's
percentiles with expectations.

### `budgetMs(input)` / `parseBudgetFlag(text)`

Normalize a [`DurationInput`](https://www.npmjs.com/package/@sdxc/duration) or a
CLI flag (`"200"` / `"200ms"`) to milliseconds.

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
