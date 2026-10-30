---
title: Query JSON with JSONPath
description: Select values from JSON documents with RFC 9535 JSONPath, let clients narrow a response with a query parameter, and patch every node a query finds.
section:
    title: HTTP APIs
    order: 5
order: 9
lastUpdated: 2026-10-25
outcomes:
    - "How to select values from a fetched JSON document with `@sdxc/jsonpath`"
    - "How to accept a client's JSONPath query and answer an invalid one with its offset"
    - "How to turn the nodes a query selects into JSON Patch operations"
---

Code that reads a JSON document it did not shape ends up walking it by hand: loops, optional
chaining and type checks at every level. A JSONPath query says what to select in one
expression, `$.releases[?@.draft == false].tag_name`, and returns every match with its
location. This guide uses [`@sdxc/jsonpath`](/api/jsonpath), a full RFC 9535 implementation,
to read a fetched document, let API clients narrow a response with a query parameter, and
redact every node a query finds.

```bash
npm add @sdxc/http @sdxc/json-patch @sdxc/json-pointer @sdxc/jsonpath @sdxc/problem \
	@sdxc/result remix
```

## Select values from a fetched document

`query` parses and selects in one call. Each node carries its `value`, its `location` from the
root, and its normalized `path`. Here a service reads a repository's newest stable release tag
from the GitHub REST API:

```typescript {% title="app/services/releases/latest-stable.ts" %}
import type { JSONValue } from "@sdxc/jsonpath";

import { query } from "@sdxc/jsonpath";
import { isFailure } from "@sdxc/result";

export async function latestStableTag(repository: string): Promise<string | null> {
	let response = await fetch(
		`https://api.github.com/repos/${repository}/releases`,
		{
			headers: {
				Accept: "application/vnd.github+json",
				"User-Agent": "books-app",
			},
		},
	);
	if (!response.ok) return null;

	let releases = (await response.json()) as JSONValue;
	let tags = query(
		releases,
		"$[?@.draft == false && @.prerelease == false].tag_name",
	);
	if (isFailure(tags)) return null;

	let newest = tags.data[0]?.value;
	return typeof newest === "string" ? newest : null;
}
```

Nodes come back in document order, and a response missing fields selects less instead of
failing.

## Accept a query from the client

Add `reports: { show: get("/api/reports/:reportId") }` to `routes/api.ts`, and let a `select`
parameter carry a JSONPath query. The catalog gains an entry that tells the client where its
query broke:

```typescript {% title="config/problems.ts" %}
import { defineProblems, ISSUES_SCHEMA } from "@sdxc/problem";
import * as s from "remix/data-schema";

export default defineProblems("https://books.example.com/docs/errors/", {
	badRequest: {
		slug: "bad-request",
		status: 400,
		title: "The request is malformed",
	},
	notFound: {
		slug: "not-found",
		status: 404,
		title: "The resource does not exist",
	},
	validationFailed: {
		slug: "validation-failed",
		status: 422,
		title: "The request failed validation",
		extensions: s.object({ errors: ISSUES_SCHEMA }),
	},
	rateLimited: { slug: "rate-limited", status: 429, title: "Too many requests" },
	internal: {
		slug: "internal",
		status: 500,
		title: "The request failed on the server",
	},
	invalidQuery: {
		slug: "invalid-query",
		status: 400,
		title: "The JSONPath query is invalid",
		extensions: s.object({ offset: s.number() }),
	},
});
```

The action parses the query with `JSONPath.parse`. `Report` is the app's own model, and its
`document` is the stored JSON:

```typescript {% title="app/http/controllers/api/reports/show.ts" %}
import { ok } from "@sdxc/http/response/json";
import { JSONPath } from "@sdxc/jsonpath";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import Report from "~/app/models/report";
import { redactEmails } from "~/app/services/reports/redact-emails";
import problems from "~/config/problems";
import routes from "~/routes/api";

const MAX_QUERY_LENGTH = 256;

export default createAction(routes.api.reports.show, async (ctx) => {
	let report = await Report.find(ctx.db, ctx.params.reportId);
	if (report === null)
		return problems.notFound({ detail: "No report has that id." });

	let document = redactEmails(report.document);
	if (isFailure(document)) return problems.internal();

	let source = ctx.url.searchParams.get("select");
	if (source === null) return ok({ report: document.data });
	if (source.length > MAX_QUERY_LENGTH) {
		return problems.badRequest({
			detail: `Keep select under ${MAX_QUERY_LENGTH} characters.`,
		});
	}

	let selection = JSONPath.parse(source);
	if (isFailure(selection)) {
		let { message, offset } = selection.error;
		return problems.invalidQuery({ detail: message, extensions: { offset } });
	}

	let nodes = selection.data.select(document.data);
	return ok({ nodes: nodes.map(({ path, value }) => ({ path, value })) });
});
```

`GET /api/reports/42?select=$.rows[?@.total > 100].customer` answers each match with its
path, such as `$['rows'][3]['customer']`. An invalid query answers `400` with the `offset`
where parsing stopped.

> [!WARNING]
> The query runs over the document the response would send, so redact before you select: a
> `select` applied to the raw document lets `$..email` read every member the full response hides.
> Cap the query's length too, since a descendant segment visits every node of the document for
> each step that follows it.

## Patch every node a query selects

`stringify` from `@sdxc/json-pointer` turns a node's `location` into the pointer a JSON Patch
operation aims at, so one query finds every email and one patch replaces them all:

```typescript {% title="app/services/reports/redact-emails.ts" %}
import type { JsonPatchError, JSONValue, Operation } from "@sdxc/json-patch";
import type { Result } from "@sdxc/result";

import { apply } from "@sdxc/json-patch";
import { stringify } from "@sdxc/json-pointer";
import { query } from "@sdxc/jsonpath";
import { isFailure, success } from "@sdxc/result";

export function redactEmails(document: JSONValue): Result<JSONValue, JsonPatchError> {
	let emails = query(document, "$..email");
	if (isFailure(emails)) return success(document);

	let patch: Operation[] = emails.data.map((node) => ({
		op: "replace",
		path: stringify(node.location),
		value: "[redacted]",
	}));
	return apply(document, patch);
}
```

`apply` works on a copy, so the stored report is left as it was.

## Test the queries

The release lookup calls `fetch`, so its test answers GitHub with MSW:

```typescript {% title="app/services/releases/latest-stable.test.ts" %}
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { latestStableTag } from "~/app/services/releases/latest-stable";

let server = setupServer(
	http.get("https://api.github.com/repos/acme/books/releases", () =>
		HttpResponse.json([
			{ tag_name: "v3.0.0-rc.1", draft: false, prerelease: true },
			{ tag_name: "v2.1.0", draft: false, prerelease: false },
			{ tag_name: "v2.0.0", draft: false, prerelease: false },
		]),
	),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("answers the newest release that is neither a draft nor a prerelease", async () => {
	expect(await latestStableTag("acme/books")).toBe("v2.1.0");
});
```

The redaction is pure, so its test passes a nested document and checks every depth:

```typescript {% title="app/services/reports/redact-emails.test.ts" %}
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { redactEmails } from "~/app/services/reports/redact-emails";

test("replaces every email at any depth and leaves the input untouched", () => {
	let document = {
		owner: { email: "ada@example.com" },
		rows: [{ customer: { email: "alan@example.com" }, total: 120 }],
	};

	expect(unwrap(redactEmails(document))).toEqual({
		owner: { email: "[redacted]" },
		rows: [{ customer: { email: "[redacted]" }, total: 120 }],
	});
	expect(document.owner.email).toBe("ada@example.com");
});
```

## Where to go next

- [Accept JSON Patch updates](/docs/http-apis/json-patch) — apply the operations a query
  produces, and answer each patch failure with its status.
- [Address JSON with JSON Pointer](/docs/http-apis/json-pointer) — the pointer a node's
  `location` becomes, and reading or writing one value.
- [`@sdxc/jsonpath`](/api/jsonpath) — every selector, function and the I-Regexp rules `match`
  and `search` follow.
