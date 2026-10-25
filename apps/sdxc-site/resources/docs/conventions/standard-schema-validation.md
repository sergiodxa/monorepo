---
title: Standard Schema validation
description: Where a package needs a schema it accepts any Standard Schema, so the validation library is yours to choose.
section:
    title: Conventions
    order: 3
order: 2
lastUpdated: 2026-10-25
outcomes:
    - "Why packages accept any Standard Schema instead of shipping a validation library"
    - "How to pass your own schema and get the result type inferred"
    - "How to validate on your own with `@sdxc/validate`"
---

Where a package in this collection validates something — a document's frontmatter, a job's
input, an email's props, a request body — it accepts any schema implementing
[Standard Schema](https://standardschema.dev) and infers the result type from the schema you
hand it. This page shows the packages that take a schema, how to validate on your own with
[`@sdxc/validate`](/api/validate), and the failure shape you get back, so one schema library
covers your whole app.

```bash
npm add @sdxc/jobs @sdxc/mail @sdxc/markdown @sdxc/result @sdxc/validate remix
```

## Pass a schema to a package

[`@sdxc/markdown`](/api/markdown) checks a document's frontmatter against the schema you pass,
and the parsed frontmatter is typed from it:

```typescript {% title="app/services/articles/parse.ts" %}
import { Markdown } from "@sdxc/markdown";
import * as s from "remix/data-schema";

const FRONTMATTER = s.object({ title: s.string(), draft: s.optional(s.boolean()) });

export function parseArticle(source: string) {
	return Markdown.parse(source, { frontmatter: FRONTMATTER });
}
```

On success, `parsed.data.frontmatter` is `{ title: string; draft?: boolean }`. The same option
appears wherever a package receives data from outside your code. [`@sdxc/jobs`](/api/jobs)
parses a job's input before its handler runs:

```typescript {% title="app/jobs/index.ts" %}
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

export default jobs({
	indexPosting: job({ input: s.object({ postingId: s.string() }) }),
});
```

[`@sdxc/mail`](/api/mail) parses an email's props before its template renders:

```typescript {% title="app/emails/index.ts" %}
import { email, emails } from "@sdxc/mail";
import * as s from "remix/data-schema";

export default emails({
	teams: {
		invite: email({ props: s.object({ team: s.string(), url: s.string() }) }),
	},
});
```

<note>
A job's `input` is parsed when the message is consumed, and a message that no longer matches the
schema is refused with `invalid-input` before the handler runs. Change a job's schema in a way
the messages already on the queue still satisfy, or drain the queue first.
</note>

`remix/data-schema` is the schema library this collection's own code uses, and any library
implementing the interface, such as Valibot or ArkType, works in exactly the same call.

## Validate a request yourself

[`@sdxc/validate`](/api/validate) is the general case: it takes a schema and a plain object, a
`FormData`, a `URLSearchParams` or a whole `Request`, and answers with a `Result`. Keep the
schema in a validator so the controller and its test share it:

```typescript {% title="app/http/validators/team.ts" %}
import * as s from "remix/data-schema";

export const NEW_TEAM_SCHEMA = s.object({
	name: s.string().refine((value) => value.trim() !== "", "Required"),
});
```

```typescript {% title="app/http/controllers/api/teams/create.ts" %}
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import { NEW_TEAM_SCHEMA } from "~/app/http/validators/team";
import routes from "~/routes/api";

export default createAction(routes.teams.create, async (ctx) => {
	let input = await validate(ctx.request, NEW_TEAM_SCHEMA);
	if (isFailure(input)) {
		return Response.json({ errors: input.error.issues }, { status: 400 });
	}

	let team = await ctx.models.team.create(input.data);
	if (isFailure(team)) {
		return Response.json({ errors: team.error.issues }, { status: 422 });
	}
	return Response.json({ id: team.data.id }, { status: 201 });
});
```

A `Request` is read according to its `Content-Type`, so one call covers JSON, a urlencoded form
and a multipart submission. A body that claims JSON and fails to parse answers with a failure
whose issue says so.

<note>
A `FormData` flattens before it is checked: a name submitted once becomes a value, and a name
submitted more than once becomes an array. Write a field that may repeat, such as a group of
checkboxes, as an array in the schema.
</note>

[Forms and params](/docs/building-remix-apps/forms-and-params) covers form schemas, route
params and the query string in full.

## Read the issues on a failure

A validation failure is a `ValidationError` whose `issues` is the Standard Schema issue list:
each issue has a `message` and, when it belongs to a field, a `path`. That shape is the
interface's, so it is the same whichever library produced it, and the same list renders beside
a form's fields or goes into an API's error body unchanged.

## Why it is an interface rather than a dependency

A validation library is a choice an application makes once and lives with. A package that picked
one for you would either force its choice into your bundle or make you convert between two
schema languages at the boundary. Accepting the interface keeps the package out of that choice:
it asks for something that can validate, and whatever you already use answers.

## Where to go next

- [Forms and params](/docs/building-remix-apps/forms-and-params) — validate submissions and
  render the issues next to the fields.
- [`Result` everywhere](/docs/conventions/result-everywhere) — the value every validation
  answers with.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — declare jobs whose
  input is parsed before they run.
