---
title: Make a service
description: Write a business rule that spans several models with sdxc make service, returning a Result its callers branch on.
section:
    title: The sdxc command
    order: 2
order: 2.08
lastUpdated: 2026-10-19
outcomes:
    - "When a rule belongs in a service rather than on a model"
    - "What `make service` writes"
    - "How a service returns a `Result` its callers branch on"
---

A service carries out a rule that spans more than one model, or that belongs to none: charge a
customer and record the invoice, extend a trial and email its owner. `sdxc make service` writes
one in `app/services/`, a function that returns a `Result` so every caller branches on what went
wrong:

```bash
sdxc make service billing/charge
```

```text
Wrote app/services/billing/charge.ts
Wrote app/services/billing/charge.test.ts
```

Put a rule about one model on that model, as a method. Reach for a service for what sits between
models: it is how your controller, your job and your command share one rule.

## Flags

| Flag                  | Default      | What it does                         |
| --------------------- | ------------ | ------------------------------------ |
| `--test`, `--no-test` | `make.tests` | write the test beside it, or skip it |
| `--dry-run`           |              | print the files and change nothing   |
| `--force`             |              | replace the file and its test        |

## What it writes

A function named after the file's last segment in camelCase:

```typescript {% title="app/services/billing/charge.ts" %}
import type { Result } from "@sdxc/result";

import { success } from "@sdxc/result";

/** Carries out Charge; a failure says why nothing changed. */
export function charge(): Result<void, Error> {
	// TODO: carry out the rule across models
	return success(undefined);
}
```

Nothing is declared or mapped: a caller imports the function it needs. Use the same folder name
the feature uses in the other layers, `app/jobs/billing/` and `app/services/billing/`, so one
search finds the whole feature.

## The test

```typescript {% title="app/services/billing/charge.test.ts" %}
import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { charge } from "~/app/services/billing/charge";

describe("charge", () => {
	test("succeeds", () => {
		expect(isSuccess(charge())).toBe(true);
	});
});
```

```bash
bun run test app/services/billing/charge.test.ts
```

## Fill it in

Take what the rule reads as parameters, the models included, so a test passes its own:

```typescript {% title="app/services/billing/charge.ts" %}
export async function charge(
	models: AppModels,
	customerId: string,
	cents: number,
): Promise<Result<Invoice, Error>> {
	let customer = await models.customer.find(customerId);
	if (customer === null) return failure(new Error("No such customer"));
	let invoice = await models.invoice.create({
		customer_id: customerId,
		amount_cents: cents,
	});
	return success(invoice);
}
```

`AppModels` and `Invoice` stand for your app's own types. A caller passes `ctx.models` from a
controller, a job or a command, and answers a failure its own way: a page, a retry, an exit code.
[Result everywhere](/docs/conventions/result-everywhere) covers `success`, `failure` and the
helpers that combine them, and [`@sdxc/result`](/api/result) the whole API.

## Where to go next

- [Make a model](/docs/sdxc/make-model) — the models a service works across.
- [Make a job](/docs/sdxc/make-job) — run the rule off the request.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
