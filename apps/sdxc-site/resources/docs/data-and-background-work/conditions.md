---
title: Rules your users write
description: Let customers write conditions as text or JSON, store them as data, refuse a broken one with its path, and evaluate it in a request or a job.
section:
    title: Data & background work
    order: 7
order: 10
lastUpdated: 2026-10-25
outcomes:
    - "How to define a condition dialect once with `@sdxc/expression`"
    - "How to accept a rule as text or JSON and refuse a broken one with its path"
    - "How to evaluate a stored rule in a job and add your own operator"
---

Sooner or later a customer asks for a rule your code does not have: notify me only when a
production check fails in `eu-west`, or when the response is slower than two seconds. Instead of
shipping each branch, let them write the condition themselves, store it as data, and have your
app answer whether it holds for a given event.

This guide builds alert rules for a monitoring product with
[`@sdxc/expression`](/api/expression), which supplies the schema, compile step, evaluator and
text form such a rule needs, and accepts the rules through [`@sdxc/validate`](/api/validate).

```bash
npm add @sdxc/expression @sdxc/http @sdxc/jobs @sdxc/result @sdxc/validate remix
```

## Define the dialect once

A language is the set of operators a condition may use and how a shared condition is
referenced. Define it in one module, and the schema, compiler, evaluator and text form all read
the same grammar:

```typescript {% title="app/services/alert-conditions.ts" %}
import { createLanguage } from "@sdxc/expression";

const ALERT_BUILTINS = [
	"all",
	"any",
	"not",
	"always",
	"eq",
	"ne",
	"in",
	"notIn",
	"lt",
	"lte",
	"gt",
	"gte",
	"startsWith",
	"endsWith",
	"contains",
	"exists",
] as const;

export const alertConditions = createLanguage({
	reference: "filter",
	builtins: ALERT_BUILTINS,
});

export type AlertCondition = typeof alertConditions.Expression;
```

Every built-in is there except `matches`.

> [!WARNING]
> A regular expression written by a customer can take time exponential in its input. Leaving
> `matches` out keeps evaluation linear in the size of the context, whatever anyone writes.

`reference: "filter"` lets a rule name a condition the team saved once, as
`{ op: "filter", name: "production" }` or `filter("production")` in text.

## Accept a rule from an API

An API client sends the rule as JSON, which is also the form you store. The language's
`schema` is a Standard Schema, so it sits inside the body schema and `validate` checks the
condition's shape with everything else:

```typescript {% title="app/http/controllers/api/alert-rules.ts" %}
import { created, unprocessableEntity } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { minLength } from "remix/data-schema/checks";
import { createAction } from "remix/router";

import { AlertRules } from "~/app/models/alert-rules";
import { Filters } from "~/app/models/filters";
import { alertConditions } from "~/app/services/alert-conditions";
import routes from "~/routes/web";

const NEW_RULE = s.object({
	name: s.string().pipe(minLength(1)),
	when: alertConditions.schema,
});

export default createAction(routes.api.alertRules.create, async (ctx) => {
	let body = await validate(ctx.request, NEW_RULE);
	if (isFailure(body)) return unprocessableEntity({ issues: body.error.issues });

	let filters = await Filters.forTeam(ctx.db, ctx.team.id);
	let compiled = alertConditions.compile(body.data.when, { references: filters });
	if (isFailure(compiled)) {
		let { message, path } = compiled.error;
		return unprocessableEntity({ error: message, path });
	}

	let rule = await AlertRules.save(ctx.db, { teamId: ctx.team.id, ...body.data });
	return created({ rule });
});
```

`ctx.team` is the team your API-key middleware published, and `AlertRules` and `Filters` are
your own models over `ctx.db`. The schema accepts anything well-formed, and `compile` catches the
rest before the row is written, such as a filter the team never saved or two filters in a cycle.
Its `ExpressionError` carries a `path` naming the node at fault, such as `of.1` for the second
member of an `all`.

> [!WARNING]
> Store the JSON you validated, never what `compile` returned. The compiled tree carries resolved
> filters, so storing it would freeze a copy of each filter into the rule.

## Let people type the rule as text

Nobody wants to write JSON in a settings page. The text form reads the way the rule is said
out loud, and `parse` turns it into the same JSON the API accepts:

```text
ctx.check.environment == "production" and ctx.status != "up"
	and (ctx.region in ["eu-west", "eu-central"] or ctx.responseMs > 2000)
```

Every path into the context starts with `ctx.`, and everything else is a JSON literal.
`stringify` goes the other way, so the edit page shows the stored rule as text and the action
parses what came back:

```tsx {% title="app/http/controllers/alert-rules-edit.tsx" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createController } from "remix/router";

import { AlertRules } from "~/app/models/alert-rules";
import { Filters } from "~/app/models/filters";
import { alertConditions } from "~/app/services/alert-conditions";
import { RuleEditor } from "~/resources/views/rule-editor";
import routes from "~/routes/web";

const PARAMS = s.object({ id: s.string() });
const RULE_FORM = f.object({ when: f.field(s.string()) });

export default createController(routes.alertRules.edit, {
	actions: {
		index: async (ctx) => {
			let { id } = s.parse(PARAMS, ctx.params);
			let rule = await AlertRules.find(ctx.db, ctx.team.id, id);
			let text = rule ? alertConditions.stringify(rule.when) : "";
			return ctx.render(<RuleEditor text={text} />);
		},

		action: async (ctx) => {
			let { id } = s.parse(PARAMS, ctx.params);
			let form = await validate(ctx.formData, RULE_FORM);
			let text = isFailure(form) ? "" : form.data.when;

			let parsed = alertConditions.parse(text);
			if (isFailure(parsed)) {
				let page = <RuleEditor text={text} error={parsed.error} />;
				return ctx.render(page, { status: 400 });
			}

			let filters = await Filters.forTeam(ctx.db, ctx.team.id);
			let compiled = alertConditions.compile(parsed.data, {
				references: filters,
			});
			if (isFailure(compiled)) {
				let page = <RuleEditor text={text} error={compiled.error} />;
				return ctx.render(page, { status: 400 });
			}

			await AlertRules.update(ctx.db, ctx.team.id, id, { when: parsed.data });
			return redirect(routes.alertRules.index.href(), {
				status: redirect.Status.SeeOther,
			});
		},
	},
});
```

`RuleEditor` is your own view: a `<textarea name="when">` holding `text`, and the error's
`message` beside it. A parse failure also carries a 1-based `line` and `column`. The text is a
view of the rule; the stored copy is always the JSON.

## Evaluate in a job

A check result arrives, and every rule of its team decides whether it notifies. Evaluation is
synchronous and pure, so the work belongs wherever the result is handled. Here it is a job,
since sending the notification is I/O nobody waits on:

```typescript {% title="app/jobs/alerts/route.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { AlertRules } from "~/app/models/alert-rules";
import { CheckResults } from "~/app/models/check-results";
import { Filters } from "~/app/models/filters";
import { alertConditions } from "~/app/services/alert-conditions";
import { alertContext } from "~/app/services/alert-context";
import { notify } from "~/app/services/notify";

export default createJobHandler(jobs.alerts.route, async (ctx) => {
	let result = await CheckResults.find(ctx.db, ctx.input.resultId);
	if (result === null) return ctx.exit("The result was deleted");

	let rules = await AlertRules.forTeam(ctx.db, result.teamId);
	let filters = await Filters.forTeam(ctx.db, result.teamId);
	let context = alertContext(result);
	let notified = 0;

	for (let rule of rules) {
		let when = alertConditions.compile(rule.when, { references: filters });
		if (isFailure(when)) {
			ctx.log.note("alert.rule_broken", {
				rule: rule.id,
				path: when.error.path,
			});
			continue;
		}
		if (!alertConditions.evaluate(when.data, context)) continue;
		await notify(ctx, rule, result);
		notified += 1;
	}

	ctx.log.set({ alert: { notified } });
});
```

A rule can stop compiling after it was stored, when a filter it names changes, so the job skips
it with a breadcrumb and the other rules still run. The context is the vocabulary your customers
write against, so build it on purpose:

```typescript {% title="app/services/alert-context.ts" %}
import type { Context } from "@sdxc/expression";

import type { CheckResult } from "~/app/models/check-results";

export function alertContext(result: CheckResult): Context {
	return {
		status: result.status,
		region: result.region,
		responseMs: result.responseMs,
		check: { name: result.check.name, environment: result.check.environment },
		certificate: { expiresAt: result.certificateExpiresAt },
	};
}
```

Listing the fields keeps a rule from reading a column you never meant to expose. A path that
resolves to nothing makes every operator false except `exists`, so a misspelled field never
matches everyone.

## Add an operator of your own

The built-ins compare values. A rule like "the certificate expires within 14 days" needs an
operator that knows about dates, and `defineOperator` adds it:

```typescript {% title="app/services/alert-conditions.ts" %}
import { createLanguage, defineOperator } from "@sdxc/expression";
import { failure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

const DAY_MS = 86_400_000;

const EXPIRES_WITHIN = defineOperator({
	op: "expiresWithin",
	args: ["field", "days"],
	schema: s.object({ days: s.number() }),
	compile: (node) =>
		node.days > 0 && node.days <= 365
			? success(node.days * DAY_MS)
			: failure(new Error("Expected between 1 and 365 days")),
	test: (value, _node, windowMs) =>
		value instanceof Date && value.getTime() - Date.now() <= windowMs,
});

export const alertConditions = createLanguage({
	reference: "filter",
	builtins: ALERT_BUILTINS,
	operators: [EXPIRES_WITHIN],
});
```

`ALERT_BUILTINS` is the list from the first section. The text form calls it as
`expiresWithin(certificate.expiresAt, 14)`, filling the node's fields in the order of `args`.
`compile` runs once per node, refusing the rule when it is saved, and what it returns arrives as
`test`'s third argument on every evaluation.

## Test the dialect

The language is plain functions with no I/O, so a test compiles and evaluates directly:

```typescript {% title="app/services/alert-conditions.test.ts" %}
import { isFailure, unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { alertConditions } from "~/app/services/alert-conditions";

test("a rule over a saved filter holds for a matching result", () => {
	let filters = {
		production: { op: "eq", field: "check.environment", value: "production" },
	};
	let parsed = unwrap(
		alertConditions.parse(`filter("production") and ctx.status != "up"`),
	);
	let when = unwrap(alertConditions.compile(parsed, { references: filters }));

	let context = { status: "down", check: { environment: "production" } };
	expect(alertConditions.evaluate(when, context)).toBe(true);
	expect(alertConditions.evaluate(when, { status: "down" })).toBe(false);
});

test("a filter nobody saved is refused at its node", () => {
	let compiled = alertConditions.compile({
		op: "all",
		of: [{ op: "always" }, { op: "filter", name: "staging" }],
	});

	expect(isFailure(compiled) && compiled.error.path).toBe("of.1");
});
```

The last assertion of the first test is the missing-field rule at work: a result with no
`check` matches no rule about one.

## Where to go next

- [Feature flags](/docs/data-and-background-work/feature-flags) — targeting rules written in
  the same conditions.
- [`@sdxc/expression`](/api/expression) — strict languages, `paths`, and every built-in
  operator.
