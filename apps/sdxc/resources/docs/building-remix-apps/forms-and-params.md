---
title: Validate forms and route params
description: Turn form posts, query strings, route params and JSON bodies into typed values, and answer each failure with the right response.
section:
    title: Building Remix apps
    order: 3
order: 2
lastUpdated: 2026-09-29
---

Everything a request carries is a string until something says otherwise: form fields, the
query string, the segments the router matched. This guide validates each of them with
`remix/data-schema` schemas, runs them through [`@sdxc/validate`](/api/validate) so a refusal
comes back as a `Result` value, and answers every failure with the response that fits the
caller: the same page with its errors for a browser form, a 404 for a URL that names nothing,
and a problem document for an API client.

```bash
npm add remix @sdxc/validate @sdxc/result @sdxc/http @sdxc/problem @sdxc/ui
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

Three decisions are worth noticing. `coerce.number()` turns the submitted `"12"` into `12`
before `min` and `max` check it, so the handler never parses a number itself. `.transform()`
normalizes while it validates, so the email is lowercased once, at the boundary. And
`s.enum_()` refuses any plan outside the list, which is what keeps a hand-edited form from
reaching the database with a value your code has no branch for.

Keep schemas in their own module. The same object can validate the browser form, an API body
and a test fixture, and a rule stated once cannot drift between them.

## Validate in the action

`validate(input, schema)` accepts `FormData`, `URLSearchParams`, a `Request` or a plain value,
and resolves to a `Result`: the schema's output on success, a `ValidationError` carrying the
schema's `issues` on failure. It never throws for bad input, so the handler is a straight
line with an early return.

```tsx {% title="app/http/controllers/teams-new.tsx" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import Team from "~/app/data/team";
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

The route is declared as `form("/teams/new")` from `remix/routes`, which gives it an `index`
for the `GET` and an `action` for the `POST` on one pattern.

The two outcomes answer differently on purpose:

- **Refused, re-render with a 400.** The issues and what the visitor typed exist only in this
  request. A redirect back would drop both, unless you carried them through a session flash,
  so answering the `POST` with the same page and its errors is the simpler and more honest
  response. The 400 status keeps the refusal from reading as a success to anything watching
  status codes.
- **Accepted, redirect with a 303.** `redirect.Status.SeeOther` turns the next request into a
  `GET`, so a reload shows the new team instead of offering to submit the form again.

## Render the issues

`ValidationError.issues` already has the shape [`@sdxc/ui`](/api/ui)'s `Form` takes. Each
field finds its own messages by `name`, marks itself `aria-invalid`, and the first invalid
field takes focus, with no client JavaScript.

```tsx {% title="resources/views/new-team.tsx" %}
import type { Handle } from "remix/component";

import { Button, Form, TextField } from "@sdxc/ui";

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
				<Button type="submit">Create team</Button>
			</Form>
		);
	};
}
```

The native `required` and `type="email"` attributes stop most mistakes before the request is
sent. The schema is still the rule that counts, because anything can post to your action.

## Validate route params

A matched route's params are a plain object of strings, and `validate` takes plain objects
too. When a param is input, a value the URL can carry but your app does not know, validate it
and answer a failure with the 404 page:

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

The router's own default handler answers, so an unknown plan looks exactly like any other URL
that names nothing. A param that only has to be present, such as the `:id` of `/teams/:id`,
cannot be missing once the route matched, so reading it with
`s.parse(s.object({ id: s.string() }), ctx.params)` and letting a routing bug throw is enough.

## Validate the query string

`ctx.url.searchParams` is a `URLSearchParams`, so it goes through the same form-data schemas.
`s.defaulted` fills a value the link left out:

```tsx {% title="app/http/controllers/search.tsx" %}
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { min } from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import SearchPage from "~/resources/views/search";
import routes from "~/routes/web";

const SEARCH = f.object({
	q: f.field(s.defaulted(s.string(), "")),
	page: f.field(s.defaulted(coerce.number().pipe(min(1)), 1)),
});

export default createAction(routes.search, async (ctx) => {
	let query = await validate(ctx.url.searchParams, SEARCH);
	if (isFailure(query)) return defaultHandler(ctx);

	return ctx.render(<SearchPage q={query.data.q} page={query.data.page} />);
});
```

## Answer an API client

A JSON endpoint validates the `Request` itself. `validate` reads the body by its
`Content-Type`: JSON, `+json` types, multipart or URL-encoded. A client reading JSON wants the
failure as data, and [`@sdxc/problem`](/api/problem) writes it as an RFC 9457 problem
document with one entry per invalid field.

```typescript {% title="app/http/controllers/api/teams.ts" %}
import { created } from "@sdxc/http/response/json";
import { issuesFrom, validationProblem } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { email, minLength } from "remix/data-schema/checks";
import { createAction } from "remix/router";

import Team from "~/app/data/team";
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
`issuesFrom` turns each issue's path into a JSON Pointer such as `/billingEmail`. Where an
API prefers plain JSON, `badRequest({ errors: body.error.issues })` from
`@sdxc/http/response/json` is the one-line alternative.

## Where to go next

- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui) —
  the components the form above is built from.
- [Build a JSON API with problem details](/docs/http-apis/json-apis) — a catalog of problem
  types instead of one-off documents.
- [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms) — what to
  add in front of an action that anyone can reach.
- [Standard Schema validation](/docs/conventions/standard-schema-validation) — why any
  Standard Schema library works in `validate`.
