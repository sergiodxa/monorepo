---
title: Rules your users write
description: Let customers write conditions as text or JSON, store them as data, refuse a broken one with its path, and evaluate it in a request or a job.
section:
    title: Data & background work
    order: 6
order: 10
lastUpdated: 2026-10-05
---

Sooner or later a customer asks for a rule your code does not have: notify me only when a
production check fails in `eu-west`, only when the response is slower than two seconds, never
for the staging monitors. Each one is a branch you could ship, but the next customer wants a
different one. The way out is to let them write the condition themselves, store it as data,
and have your app answer whether it holds for a given event.

That condition is untrusted input that lives in your database and runs on every event, so it
needs a schema to accept it, a compile step to catch what a schema cannot, evaluation that
never coerces a string into a number, and a way for a person to type it without writing JSON.
This guide builds alert rules for a monitoring product with
[`@sdxc/expression`](/api/expression), which supplies all four, and accepts the rules through
[`@sdxc/validate`](/api/validate), with failures as [`@sdxc/result`](/api/result) values.

```bash
npm add @sdxc/expression @sdxc/result @sdxc/validate @sdxc/http remix
```

## Define the dialect once

A language is the set of operators a condition may use and how a shared condition is
referenced. Define it in one module, and every step reads the same grammar: the schema that
accepts a rule, the compiler, the evaluator, and the text form.

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

Every built-in is there except `matches`. A regular expression written by a customer can take
time exponential in its input, and leaving it out keeps evaluation linear in the size of the
context, whatever anyone writes. A rule naming `matches` is refused with
`"matches" is not an operator of this language`.

`reference: "filter"` lets a rule name a condition the team saved once, as
`{ op: "filter", name: "production" }`. `createLanguage` builds a few maps and a schema that
resolves on first use, so the module is safe to load in a Worker's global scope.
`AlertCondition` is the JSON form as a type, a union an editor completes.

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

import { AlertRules } from "~/app/repositories/alert-rules";
import { Filters } from "~/app/repositories/filters";
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
your own repositories over `ctx.db`.

The schema accepts anything well-formed, and `compile` catches the rest before the row is
written: a filter the team never saved, two filters that reference each other in a cycle,
an operator whose own compile step refuses its arguments. Its failure is an `ExpressionError`
whose `path` names the node at fault inside the condition, such as `of.1` for the second
member of an `all`, empty for the condition itself, so a client can point at it.

Store the JSON you validated, not what `compile` returned. The compiled tree carries resolved
filters, so storing it would freeze a copy of each filter into the rule.

## Let people type the rule as text

Nobody wants to write JSON in a settings page. The text form reads the way the rule is said
out loud, and `parse` turns it into the same JSON the API accepts:

```text
ctx.check.environment == "production" and ctx.status != "up"
	and (ctx.region in ["eu-west", "eu-central"] or ctx.responseMs > 2000)
```

Every path into the context starts with `ctx.`, and everything else is a JSON literal, so a
rule can compare two fields as easily as a field and a value: `ctx.check.ownerId == ctx.user.id`.

`stringify` goes the other way, so the edit page shows the stored rule as text, and the
action parses what came back:

```tsx {% title="app/http/controllers/alert-rules-edit.tsx" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createController } from "remix/router";

import { AlertRules } from "~/app/repositories/alert-rules";
import { Filters } from "~/app/repositories/filters";
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
`message` beside it. A parse failure also carries a 1-based `line` and `column`, so the view
can point at the character that broke. A value of the wrong type fails there too:
`responseMs > "2000"` is refused at the column of `"2000"`, since every comparison stays
within one type.

The text is a view of the rule, never the stored copy. `stringify` prints a canonical
spelling that `parse` reads back to the same JSON, so a rule saved through the API and one
typed into the form read the same the next time anyone opens them.

## Share named filters

Twenty rules that all mean "production checks" should say so once. A filter is a condition
the team saves under a name, and a rule references it as `filter("production")` in text or
`{ op: "filter", name: "production" }` in JSON. The references object is just those
conditions by name:

```typescript {% title="app/services/filters.ts" %}
import type { AlertCondition } from "~/app/services/alert-conditions";

import { alertConditions } from "~/app/services/alert-conditions";

export function checkFilter(
	filters: Readonly<Record<string, AlertCondition>>,
	name: string,
	when: unknown,
) {
	let next = { ...filters, [name]: when };
	return alertConditions.compile({ op: "filter", name }, { references: next });
}
```

Saving a filter compiles a reference to it against the set as it would be after the edit,
so `production` naming `eu-only` naming `production` is refused with
`Filter "production" takes part in a reference cycle` before it reaches the database. Deleting
a filter is the same check in reverse: compile the team's rules against the set without it.

Each reference resolves once per references object. The language keys its compiled filters on
that object, so passing the same one to every rule's `compile` compiles a filter shared by
twenty rules exactly once, and the cache goes with the object. Treat it as fixed once you have
compiled against it, and build a new one for an edit, as `checkFilter` does.

## Evaluate in a job

A check result arrives, and every rule of its team decides whether it notifies. Evaluation is
synchronous and pure, so the work belongs wherever the result is handled. Here it is a job,
since sending the notification is I/O nobody waits on:

```typescript {% title="app/jobs/alerts/route.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { AlertRules } from "~/app/repositories/alert-rules";
import { CheckResults } from "~/app/repositories/check-results";
import { Filters } from "~/app/repositories/filters";
import { alertConditions } from "~/app/services/alert-conditions";
import { alertContext } from "~/app/services/alert-context";
import { notify } from "~/app/services/notify";

export default createJobHandler(jobs.alerts.route, async (ctx) => {
	let result = await CheckResults.find(ctx.database, ctx.input.resultId);
	if (result === null) return ctx.exit("The result was deleted");

	let rules = await AlertRules.forTeam(ctx.database, result.teamId);
	let filters = await Filters.forTeam(ctx.database, result.teamId);
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

A rule can stop compiling after it was stored, when a filter it names changes, so the job
skips it with a breadcrumb on its log and the other rules still run. When the same rules
serve many events, compile them once when they load and keep the trees: `evaluate` is the
only part that has to run per event.

The context is the vocabulary your customers write against, so build it on purpose:

```typescript {% title="app/services/alert-context.ts" %}
import type { Context } from "@sdxc/expression";

import type { CheckResult } from "~/app/repositories/check-results";

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

Listing the fields keeps a rule from reading a column you never meant to expose, and a
`Date` stays a value rather than an object to walk into. A path that resolves to nothing
makes every operator false except `exists`, so a misspelled field never matches everyone.
When code beside a rule reads a field the author named, such as a `groupBy` path deciding
which alerts collapse into one, `read(context, rule.groupBy)` from `@sdxc/expression`
resolves it exactly the way a condition would.

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

`ALERT_BUILTINS` is the list from the first section, unchanged.

The text form calls it as `expiresWithin(certificate.expiresAt, 14)`, filling the node's
fields in the order of `args`. `compile` runs once per node: its failure refuses the rule at
the operator's path when it is saved, and what it returns arrives as `test`'s third argument
on every evaluation. The language reads the field before `test` runs and answers `false` when
it is missing, so `test` only ever sees a value that is there, and still checks that it is a
`Date`, because a `null` is a value.

## Speak the same language in flags and logs

Two other packages read conditions in this language, so a rule learned once works in each.
`@sdxc/flags-engine` exports `flagConditions`, its targeting dialect: every built-in, a
`semver` operator, and references spelled `segment`. Its `parse` and `stringify` give a flag
admin page the same text editing as above, and
[Feature flags](/docs/data-and-background-work/feature-flags) covers the rules themselves.

`@sdxc/logger` takes a condition in the JSON form as its sampling `keep`, so the exemption can
come from configuration rather than code:

```typescript {% title="bootstrap/logger.ts" %}
import { createLogger } from "@sdxc/logger";

export const logger = createLogger({
	service: "alerts",
	sample: { rate: 0.05, keep: { op: "gt", field: "alert.notified", value: 0 } },
});
```

Every run that sent a notification is kept and the rest are sampled. The logger's language
keeps every built-in and adds nothing, and reads `alert.notified` from what `ctx.log.set`
wrote by its dotted path. A condition that does not compile keeps every log, so a broken
exemption costs volume, never the logs it was written to keep. Sampling itself is covered in
[Logs, traces and timings](/docs/operations-and-testing/observability).

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
`check` matches no rule about one. Keep the cases your customers rely on beside these, such
as a cycle or a rule naming `matches`, so a change to the dialect fails here first.

## Where to go next

- [Feature flags](/docs/data-and-background-work/feature-flags) — targeting rules written in
  the same conditions.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — sampling, and the
  `keep` exemption.
- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — the form
  and body validation the rule endpoints build on.
- [Standard Schema validation](/docs/conventions/standard-schema-validation) — why the
  language's `schema` fits inside any body schema.
- [Result everywhere](/docs/conventions/result-everywhere) — the `Result` every step of the
  language answers with.
