---
title: Errors as responses
description: A failed Result becomes an RFC 9457 problem document at the HTTP boundary, with the status, type and members a client acts on.
section:
    title: Conventions
    order: 3
order: 8
lastUpdated: 2026-10-25
outcomes:
    - "Where a failed `Result` turns into an HTTP response, and why only there"
    - "How to map each failure to a typed problem with the right status"
    - "What belongs in `detail` and extensions, and what stays in your logs"
---

Code below the HTTP boundary answers with a [`Result`](/api/result), so a failure arrives as a
value carrying its reason. The controller is the one place that value becomes a response: an
RFC 9457 problem document from [`@sdxc/problem`](/api/problem), with a `type` a client
branches on, the status that names the failure, and the members a caller can act on.

```bash
npm add @sdxc/http @sdxc/problem @sdxc/result @sdxc/uuid @sdxc/validate remix
```

The endpoint below renews a library loan. It extends the books API from
[Build a JSON API with problem details](/docs/http-apis/json-apis), and reuses its problem
catalog and router.

## Return a reason from the service

A service says why it failed in its own terms, leaving HTTP to the controller. Give its error a
`reason` the controller can switch on, and keep a storage failure's original error as `cause`:

```typescript {% title="app/services/loans/renew.ts" %}
import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import Loan from "~/app/models/loan";

export const MAX_RENEWALS = 2;
const LOAN_MS = 14 * 24 * 60 * 60 * 1000;

export class RenewError extends Error {
	constructor(
		readonly reason: "not-found" | "limit-reached" | "storage",
		readonly renewals = 0,
		options?: ErrorOptions,
	) {
		super(`The loan could not be renewed: ${reason}`, options);
		this.name = "RenewError";
	}
}

export async function renewLoan(
	db: Database,
	loanId: string,
): Promise<Result<{ dueAt: Date }, RenewError>> {
	let loan = await wrap(() => Loan.find(db, loanId));
	if (isFailure(loan)) {
		return failure(new RenewError("storage", 0, { cause: loan.error }));
	}
	if (loan.data === null) return failure(new RenewError("not-found"));

	let { renewals } = loan.data;
	if (renewals >= MAX_RENEWALS) {
		return failure(new RenewError("limit-reached", renewals));
	}

	let dueAt = new Date(loan.data.dueAt.getTime() + LOAN_MS);
	let saved = await wrap(() => Loan.renew(db, loanId, dueAt));
	if (isFailure(saved)) {
		return failure(new RenewError("storage", renewals, { cause: saved.error }));
	}
	return success({ dueAt });
}
```

`Loan` is the app's own model. `wrap` turns a query that throws into the `storage` reason, so
the function answers every outcome as a value.

## Add a problem type for each failure a client handles

A client branches on a problem's `type`, so each failure it can act on gets an entry in the
[problem catalog](/docs/http-apis/json-apis#declare-the-problem-catalog). Add the renewal limit
beside the `notFound` and `internal` entries the books API already declares:

```typescript
renewalLimit: {
	slug: "renewal-limit",
	status: 409,
	title: "The loan cannot be renewed again",
	extensions: s.object({ renewals: s.number(), limit: s.number() }),
},
```

The status is the HTTP meaning of the failure: `409` for a request the loan's current state
refuses. The `extensions` schema types the builder, so `problems.renewalLimit` compiles only
with `renewals` and `limit`, and the catalog validates them when a client parses the response with `problems.parse`.

## Map the reason to a problem at the controller

The controller translates. One function maps every reason to its problem, and the action
calls it on the failure branch:

```typescript {% title="app/http/controllers/api/loans/renew.ts" %}
import type { RenewError } from "~/app/services/loans/renew";

import { ok } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import { LOAN_PARAMS } from "~/app/http/validators/loans";
import { MAX_RENEWALS, renewLoan } from "~/app/services/loans/renew";
import problems from "~/config/problems";
import routes from "~/routes/api";

export function renewProblem(error: RenewError, instance: string): Response {
	switch (error.reason) {
		case "not-found":
			return problems.notFound({ detail: "No loan has that id.", instance });
		case "limit-reached":
			return problems.renewalLimit({
				detail: `This loan was renewed ${error.renewals} times, the most allowed.`,
				instance,
				extensions: { renewals: error.renewals, limit: MAX_RENEWALS },
			});
		case "storage":
			return problems.internal({ instance });
	}
}

export default createAction(routes.api.loans.renew, async (ctx) => {
	let params = await validate(ctx.params, LOAN_PARAMS);
	if (isFailure(params)) {
		return problems.notFound({ detail: "No loan has that id." });
	}

	let renewed = await renewLoan(ctx.db, params.data.loanId);
	if (isFailure(renewed)) {
		let instance = `urn:uuid:${generateUUID()}`;
		if (renewed.error.reason === "storage") {
			ctx.log.fail(renewed.error, { instance });
		}
		return renewProblem(renewed.error, instance);
	}

	return ok({ dueAt: renewed.data.dueAt.toISOString() });
});
```

The `switch` covers every reason, so a reason added to `RenewError` later fails to compile
here until it has a problem. `LOAN_PARAMS` is the route's param schema, written the way the
books API writes `BOOK_PARAMS`.

`detail` explains this occurrence to the caller in words they can act on, and extensions carry
the values a program acts on. `instance` lets a caller quote the occurrence in a support
request, and you find the log record `ctx.log.fail` wrote under it, with the message, cause and
stack the response leaves out.

> [!WARNING]
> Write `detail` from the reason alone, and send `error.message` and `cause` to the log. A
> database or provider error names tables, columns, hosts and sometimes values, and a problem
> document is read by whoever sent the request.

## Test the mapping

`renewProblem` is a function from an error to a `Response`, so a test calls it directly and
checks that the cause's text stays out of the body:

```typescript {% title="app/http/controllers/api/loans/renew.test.ts" %}
import { expect, test } from "vitest";

import { renewProblem } from "~/app/http/controllers/api/loans/renew";
import { RenewError } from "~/app/services/loans/renew";

test("a storage failure answers 500 without the cause's text", async () => {
	let cause = new Error("D1_ERROR: no such table: loans");
	let error = new RenewError("storage", 0, { cause });

	let response = renewProblem(error, "urn:uuid:test");

	expect(response.status).toBe(500);
	let body = await response.text();
	expect(body).not.toContain("D1_ERROR");
	expect(JSON.parse(body)).toMatchObject({ instance: "urn:uuid:test" });
});
```

## Where to go next

- [Build a JSON API with problem details](/docs/http-apis/json-apis) — the catalog, the
  validation failures and the router this endpoint joins.
- [Write a typed API client](/docs/http-apis/api-clients#branch-on-the-problem) — read the
  problem back on the client with the same catalog, extensions typed.
- [Result everywhere](/docs/conventions/result-everywhere) — the convention that hands the
  controller a failure as a value in the first place.
