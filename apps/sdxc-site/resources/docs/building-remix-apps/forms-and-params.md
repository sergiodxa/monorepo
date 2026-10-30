---
title: Validate forms and route params
description: Turn form posts, query strings, route params and JSON bodies into typed values, and answer each failure with the right response.
section:
    title: Building Remix apps
    order: 4
order: 2
lastUpdated: 2026-10-25
outcomes:
    - "How to turn form posts, query strings and route params into typed values with `@sdxc/validate`"
    - "How to render a schema's issues back next to the fields that failed"
    - "How to answer an API client's invalid JSON body with a `@sdxc/problem` response"
---

Everything a request carries is a string until something says otherwise: form fields, the
query string, the segments the router matched. This guide validates each of them with
`remix/data-schema` schemas, runs them through [`@sdxc/validate`](/api/validate) so a refusal
comes back as a `Result` value, and answers every failure with the response that fits the
caller: the same page with its errors for a browser form, a 404 for a URL that names nothing,
and a problem document for an API client.

```bash
npm add @sdxc/http @sdxc/problem @sdxc/result @sdxc/ui @sdxc/validate remix
```

The examples assume the router from
[Wire the router](/docs/building-remix-apps/wire-the-router): its `formData()` middleware
has already parsed the body into `ctx.formData`, and its database middleware publishes
`ctx.db`. `Team` stands for your own model.

## Describe the form as a schema

A schema describes the fields the action accepts, and the type the handler receives is
inferred from it. `remix/data-schema/form-data` builds schemas that read a `FormData` or
`URLSearchParams` directly, with `f.field()` for a single value and `f.fields()` for a name
submitted several times.

```typescript {% title="app/http/validators/team.ts" %}
import * as s from "remix/data-schema";
import { email, max, min, minLength } from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

export const NewTeamSchema = f.object({
	name: f.field(s.string().pipe(minLength(2))),
	billingEmail: f.field(
		s
			.string()
			.pipe(email())
			.transform((value) => value.toLowerCase()),
	),
	seats: f.field(coerce.number().pipe(min(1), max(50))),
	plan: f.field(s.enum_(["free", "team"])),
});

export type NewTeam = s.InferOutput<typeof NewTeamSchema>;
```

`coerce.number()` turns the submitted `"12"` into `12` before `min` and `max` check it,
`.transform()` lowercases the email once at the boundary, and `s.enum_()` refuses any plan
outside the list.

## Validate in the action

`validate(input, schema)` resolves to a `Result`: the schema's output on success, a
`ValidationError` carrying the schema's `issues` on failure, so the handler is a straight line
with an early return.

```tsx {% title="app/http/controllers/teams-new.tsx" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import Team from "~/app/models/team";
import { NewTeamSchema } from "~/app/http/validators/team";
import { NewTeamPage } from "~/resources/views/new-team";
import routes from "~/routes/web";

export default createController(routes.teams.new, {
	actions: {
		index: (ctx) => ctx.render(<NewTeamPage />),

		action: async (ctx) => {
			let result = await validate(ctx.formData, NewTeamSchema);

			if (isFailure(result)) {
				ctx.log.note("team.form_invalid");
				let page = (
					<NewTeamPage
						issues={result.error.issues}
						submitted={ctx.formData}
					/>
				);
				return ctx.render(page, { status: 400 });
			}

			let team = await Team.create(ctx.db, result.data);
			return redirect(routes.teams.show.href({ id: team.id }), {
				status: redirect.Status.SeeOther,
			});
		},
	},
});
```

The route is declared as `form("/teams/new")` from `remix/routes`, an `index` for the `GET`
and an `action` for the `POST`. A refused post re-renders with a 400, since the issues and what
the visitor typed exist only in this request. An accepted one redirects with a 303, so a reload
shows the new team instead of submitting the form again.

## Render the issues

`ValidationError.issues` already has the shape [`@sdxc/ui`](/api/ui)'s `Form` takes: each
field finds its messages by `name` and marks itself `aria-invalid`, with no client JavaScript.

```tsx {% title="resources/views/new-team.tsx" %}
import type { Handle } from "remix/component";

import { Button, Form, Select, TextField } from "@sdxc/ui";

interface Props {
	issues?: ReadonlyArray<Form.Issue>;
	submitted?: FormData;
}

export function NewTeamPage(handle: Handle<Props>) {
	return () => {
		let value = (name: string) => String(handle.props.submitted?.get(name) ?? "");

		return (
			<Form method="post" issues={handle.props.issues}>
				<TextField
					label="Team name"
					name="name"
					defaultValue={value("name")}
					required
				/>
				<TextField
					label="Billing email"
					name="billingEmail"
					type="email"
					defaultValue={value("billingEmail")}
					required
				/>
				<TextField
					label="Seats"
					name="seats"
					type="number"
					min={1}
					max={50}
					defaultValue={value("seats") || "1"}
					required
				/>
				<Select name="plan" aria-label="Plan">
					<Select.Option value="free" selected={value("plan") !== "team"}>
						Free
					</Select.Option>
					<Select.Option value="team" selected={value("plan") === "team"}>
						Team
					</Select.Option>
				</Select>
				<Button type="submit">Create team</Button>
			</Form>
		);
	};
}
```

> [!WARNING]
> Anything can post to your action, with or without the form's attributes, so the schema in
> the action is the rule that counts. Treat `required`, `type` and `min` as hints for the
> visitor and keep every rule in the schema too.

## Validate route params and the query string

A matched route's params are a plain object of strings, and `validate` takes plain objects
too. When a param can name something your app does not know, validate it and answer a failure
with the router's 404:

```tsx {% title="app/http/controllers/plans-show.tsx" %}
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import PlanPage from "~/resources/views/plan";
import routes from "~/routes/web";

const PARAMS = s.object({ plan: s.enum_(["free", "team", "enterprise"]) });

export default createAction(routes.plans.show, async (ctx) => {
	let params = await validate(ctx.params, PARAMS);
	if (isFailure(params)) return defaultHandler(ctx);

	return ctx.render(<PlanPage plan={params.data.plan} />);
});
```

`ctx.url.searchParams` is a `URLSearchParams`, so it goes through the same form-data schemas,
with `s.defaulted` filling a value the link left out;
[Read nested query strings and forms](/docs/building-remix-apps/nested-fields) covers filters.

## Answer an API client

A JSON endpoint validates the `Request` itself, and `validate` reads the body by its
`Content-Type`. [`@sdxc/problem`](/api/problem) writes the failure as an RFC 9457 problem
document with one entry per invalid field.

```typescript {% title="app/http/controllers/api/teams.ts" %}
import { created } from "@sdxc/http/response/json";
import { issuesFrom, validationProblem } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { email, minLength } from "remix/data-schema/checks";
import { createAction } from "remix/router";

import Team from "~/app/models/team";
import routes from "~/routes/web";

const BODY = s.object({
	name: s.string().pipe(minLength(2)),
	billingEmail: s.string().pipe(email()),
});

export default createAction(routes.api.teams.create, async (ctx) => {
	let body = await validate(ctx.request, BODY);
	if (isFailure(body)) return validationProblem(issuesFrom(body.error));

	let team = await Team.create(ctx.db, body.data);
	return created({ team });
});
```

`validationProblem` answers `422` with `Content-Type: application/problem+json`, and
`issuesFrom` turns each issue's path into a JSON Pointer such as `/billingEmail`.

## Test both refusals

Each refusal is one request through the app's router, so a test proves the status a browser
and an API client receive. `migrate()` prepares the in-memory database, as
[Test Workers apps](/docs/operations-and-testing/testing#drive-the-real-router) sets up:

```typescript {% title="app/http/controllers/teams-new.test.tsx" %}
import { beforeAll, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { migrate } from "~/app/test/database";
import routes from "~/routes/web";

beforeAll(migrate);

test("re-renders a refused form with a 400", async () => {
	let response = await createWebRouter().fetch(
		new Request(new URL(routes.teams.new.action.href(), "https://example.com"), {
			method: "POST",
			body: new URLSearchParams({
				name: "A",
				billingEmail: "ada@example.com",
				seats: "3",
				plan: "team",
			}),
		}),
	);

	expect(response.status).toBe(400);
});

test("answers an API client with a problem document", async () => {
	let response = await createWebRouter().fetch(
		new Request(new URL(routes.api.teams.create.href(), "https://example.com"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Acme", billingEmail: "not-an-email" }),
		}),
	);

	expect(response.status).toBe(422);
	expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	expect(await response.json()).toMatchObject({
		errors: [expect.objectContaining({ pointer: "/billingEmail" })],
	});
});
```

## Where to go next

- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui) —
  the components the form above is built from.
- [Build a JSON API with problem details](/docs/http-apis/json-apis) — a catalog of problem
  types instead of one-off documents.
- [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms) — what to
  add in front of an action that anyone can reach.
