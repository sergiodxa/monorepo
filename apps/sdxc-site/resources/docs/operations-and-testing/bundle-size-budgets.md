---
title: Hold a package to a size budget
description: Weigh a package entry as a minified browser bundle, assert its gzipped size in Vitest, and check the same budget from the command line with @sdxc/bench.
section:
    title: Operations & testing
    order: 9
order: 3.5
lastUpdated: 2026-11-04
outcomes:
    - "How to weigh a package entry with `@sdxc/bench` and read minified and gzipped bytes"
    - "How to assert a gzipped budget in Vitest so CI catches growth"
    - "How to check the same budget from the terminal with `bunx @sdxc/bench weigh`"
---

A package that replaced a heavier dependency on the strength of its size needs that number
held in CI, not remembered in a commit message. This guide weighs one entry the way a
browser app would pull it in — minified, every dependency inlined — and asserts the
**gzipped** size with [`@sdxc/bench`](/api/bench). The same check runs from the command
line when you are picking a budget before writing the test.

```bash
npm add -D @sdxc/bench @sdxc/result
```

## Weigh an entry

`weigh` takes a path to an entry module and an optional project root (default
`process.cwd()`). It returns a `Result` whose success value is `{ minified, gzipped }` in
bytes:

```typescript {% title="packages/markdown/src/index.weight.test.ts" %}
import { join } from "node:path";

import { weigh } from "@sdxc/bench";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const BUDGET = 25 * 1024;

test(`the format entry stays under ${BUDGET} bytes gzipped`, async () => {
	let weight = unwrap(await weigh(join(ROOT, "src/index.ts"), ROOT));

	expect(
		weight.gzipped,
		`minified ${weight.minified} bytes, ${weight.gzipped} gzipped`,
	).toBeLessThan(BUDGET);
});
```

Gzipped is the budget that fails the test. Minified rides along in the failure message so a
regression is easy to spot. Pick a ceiling just above what the entry weighs today — a ratchet,
not room to grow into.

The build targets the browser and inlines every dependency, so the number covers what a
consumer actually downloads when they import that entry. Split entries (a plain-text walk, a
static HTML renderer) get their own tests and their own ceilings.

## Check a budget from the terminal

Before you commit a number, print what an entry weighs:

```bash
bunx @sdxc/bench weigh ./src/index.ts
```

Pass `--max-gzipped` to exit `1` when the ceiling is missed, and `--json` for a scriptable
report:

```bash
bunx @sdxc/bench weigh ./src/index.ts --max-gzipped 25600 --json
```

With [`@sdxc/kit`](/api/kit) installed, `sdxc pkg bench weigh …` runs the same command line
against the version your project pins.

## Where this fits

Size budgets belong on **packages** and their entry points. They are separate from
`sdxc doctor`'s `module-size` check, which counts source lines in an app. Doctor leaves
bundle weight alone on purpose.

## Where to go next

- [Sample HTTP latency against a running app](/docs/operations-and-testing/http-latency-budgets)
  — the same package's latency samples and CLI.
- [Use a package from the terminal](/docs/operations-and-testing/package-command-lines) —
  how `sdxc pkg` runs every package command line.
- [`@sdxc/bench`](/api/bench) — every export and flag.
