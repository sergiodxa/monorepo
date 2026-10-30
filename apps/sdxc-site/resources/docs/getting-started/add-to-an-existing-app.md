---
title: Add packages to an existing app
description: Check that a project you already have resolves the packages, install two of them pinned at one release, and keep those pins together as new releases go out.
section:
    title: Packages à la carte
    order: 1.5
order: 4
lastUpdated: 2026-10-25
outcomes:
    - "What TypeScript settings a project needs before it imports an `@sdxc` package"
    - "How to install packages pinned exactly, with one copy of each shared dependency"
    - "How `sdxc upgrade` keeps those pins on one release as new ones go out"
---

You have a project already, with its own layout, server and build, and one problem an `@sdxc`
package solves. This guide adds [`@sdxc/csv`](/api/csv) to write an orders export as a
download, with [`@sdxc/result`](/api/result) to branch on its outcome. You end with both
packages pinned exactly in `package.json`, one copy of each installed, and a test for the
export.

```bash
npm add --save-exact @sdxc/csv @sdxc/result
```

## Check that the project resolves package exports

Every package ships as ES modules compiled to ES2022, and each one is reached through the
`exports` map in its manifest. TypeScript reads that map under `"moduleResolution"` set to
`bundler`, `node16` or `nodenext`; a project a bundler builds, such as one on Vite or Wrangler,
uses this:

```json {% title="tsconfig.json" %}
{
	"compilerOptions": {
		"target": "es2022",
		"module": "preserve",
		"moduleResolution": "bundler",
		"lib": ["es2022", "dom", "dom.iterable"]
	}
}
```

The declarations name web platform globals such as `Request` and `CryptoKey`, so `lib` includes
`dom`, or `types` lists your runtime's own, such as `@cloudflare/workers-types` or `@types/bun`.

> [!NOTE]
> Under `"moduleResolution": "node"` (also called `node10`), TypeScript ignores `exports`, and every
> import of a package fails with "Cannot find module". Switching to one of the three values above
> is the fix.

## Install the packages pinned exactly

Versions are dates, as [Install and pin](/docs/getting-started/install-and-pin) explains, and
an exact pin is what holds a project at one release, so install with `--save-exact`; without it
npm writes a caret range that accepts every later release in the same year. Add `save-exact=true` to the project's `.npmrc` to make that the default.

`@sdxc/csv` depends on `@sdxc/result` and pins it at the same release, so the project installs
one copy, which `npm ls` shows as `deduped` under `@sdxc/csv`:

```bash
npm ls @sdxc/result
```

## Write the orders export

`stringify` writes rows as RFC 4180 text, in the column order and under the headers you name, and
returns a `Result`: the text, or an error naming the row and column it could not write.
`ordersDownload` turns that into a `Response`, so any server that speaks the Fetch API returns it
as is:

```typescript {% title="src/orders-export.ts" %}
import { stringify } from "@sdxc/csv";
import { isFailure } from "@sdxc/result";

export interface Order {
	id: string;
	customer: string;
	total: number;
	placedAt: Date;
}

export function ordersDownload(orders: Order[]): Response {
	let csv = stringify(orders, {
		columns: [
			{ key: "id", header: "Order" },
			{ key: "customer", header: "Customer" },
			{ key: "total", header: "Total" },
			{ key: "placedAt", header: "Placed (UTC)" },
		],
	});

	if (isFailure(csv)) return new Response(csv.error.message, { status: 500 });

	return new Response(csv.data, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": 'attachment; filename="orders.csv"',
		},
	});
}
```

A `Date` cell is written as ISO 8601 in UTC, and a customer name starting with `=` gets a `'`
prefix, so a spreadsheet shows it as text. A total such as `NaN` fails the write with a message
like `Cannot write NaN at row 0, column total`.

## Keep the pins on one release

A package you add later installs at its newest version, which can be a later release than the
rest of your pins. `sdxc upgrade`, from `@sdxc/kit`, works in any project that pins an `@sdxc`
package exactly: it moves every `@sdxc` pin to its version at the latest release, installs, and
prints a prompt listing what changed for the packages your code imports.

```bash
npm add -g @sdxc/kit
sdxc upgrade
```

[Upgrade](/docs/sdxc/upgrade) covers naming a release and the prompt it prints.

## Test the export

The export is a function from rows to a `Response`, so a Vitest test reads its status and body
directly:

```typescript {% title="src/orders-export.test.ts" %}
import { expect, test } from "vitest";

import { ordersDownload } from "./orders-export";

const ORDER = {
	id: "o_1",
	customer: "Ana",
	total: 19.5,
	placedAt: new Date("2026-10-12T09:30:00Z"),
};

test("writes one record per order under the header", async () => {
	let response = ordersDownload([ORDER]);

	expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
	expect(await response.text()).toBe(
		"Order,Customer,Total,Placed (UTC)\r\no_1,Ana,19.5,2026-10-12T09:30:00.000Z\r\n",
	);
});

test("fails on a total that is not a finite number, naming the cell", async () => {
	let response = ordersDownload([{ ...ORDER, total: Number.NaN }]);

	expect(response.status).toBe(500);
	expect(await response.text()).toContain("row 0, column total");
});
```

```bash
npm add -D vitest
npx vitest run
```

## Where to go next

- [Import and export CSV](/docs/data-and-background-work/csv) — validated imports with errors
  that name the line, and exports that stream.
- [Versioning](/docs/releases/versioning) — what a dated pin promises, and why a range is the
  wrong tool for it.
- [Pick packages by problem](/docs/getting-started/pick-packages-by-problem) — the package for the
  next problem your project has.
