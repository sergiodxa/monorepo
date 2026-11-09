---
title: Sample HTTP latency against a running app
description: Time requests against a URL that is already up, assert p95 and p99 in Vitest, and gate the same budgets from the command line with @sdxc/bench.
section:
    title: Testing & monitoring
    order: 9
order: 8
lastUpdated: 2026-11-04
outcomes:
    - "How to sample latency with `@sdxc/bench` against a running base URL"
    - "How to assert p95 and p99 in Vitest with built-in expectations"
    - "How to gate the same budgets from the terminal before a release"
---

A local or staging app that feels fine under one click can still miss a latency budget under
a handful of concurrent requests. This guide samples a URL that is already running, reports
percentiles, and asserts them in Vitest with [`@sdxc/bench`](/api/bench). The same sample
runs from the command line when you want a gate before merge without opening the test file.

```bash
npm add -D @sdxc/bench
```

The app under test must be listening. Start it in another terminal (`bun run dev`, a preview
deploy, or whatever your project uses) and point the sampler at that origin.

## Sample in a test

`sampleHttp` issues `requests` with at most `concurrency` in flight, times each with
`performance.now()`, and returns min, mean, p50, p95, p99 and max over the successful
samples. The report also splits the run: `ok` is how many completed, `failures` is how
many errored or timed out (`requests - ok`).

```typescript {% title="app/http/health.latency.test.ts" %}
import { sampleHttp } from "@sdxc/bench";
import { expect, test } from "vitest";

const BASE = process.env.BENCH_BASE_URL ?? "http://127.0.0.1:8787";

test("GET /health stays within the latency budget", async () => {
	let report = await sampleHttp({
		url: `${BASE}/health`,
		requests: 20,
		concurrency: 5,
		timeoutMs: 5_000,
	});

	expect(report.failures).toBe(0);
	expect(report.p95).toBeLessThan(200);
	expect(report.p99).toBeLessThan(500);
});
```

`expect(report.failures).toBe(0)` requires every sample to succeed before the percentile
ceilings matter. Prefer ceilings with room for runner noise; these are gates against a
hanging or suddenly slow endpoint, not microbenchmarks. Skip or gate the file when
`BENCH_BASE_URL` is unset if the suite must stay green without a server.

## Gate from the terminal

With the app up, the same sample is one command:

```bash
sdxc pkg bench http http://127.0.0.1:8787/health \
	--requests 50 \
	--concurrency 5 \
	--timeout 5s \
	--p95 200ms \
	--p99 500ms
```

Duration flags (`--timeout`, `--p50`, `--p95`, `--p99`, `--mean`) accept a
[duration string](/api/duration) (`200ms`, `5s`) or a bare millisecond number (`200`). The
process exits `1` when a budget is missed or every request errors, and `2` when a flag is
not a duration. `--json` prints the full report for scripts. [Use a package from the
terminal](/docs/operations-and-testing/package-command-lines) covers what every package
command line shares.

## What this is for

Use it against an app **you** control — local preview, staging, a smoke URL after deploy.
Continuous production monitoring stays with your uptime product; this package samples on
demand for CI and release gates.

## Where to go next

- [Hold a package to a size budget](/docs/operations-and-testing/bundle-size-budgets) — the
  same package's entry-point weight checks.
- [Dependency health checks](/docs/operations-and-testing/health-checks) — answer
  `GET /health` for monitors.
- [Use a package from the terminal](/docs/operations-and-testing/package-command-lines) —
  how `sdxc pkg` runs every package command line.
- [`@sdxc/bench`](/api/bench) — every export and flag.
