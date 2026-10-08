---
title: Decide who can do what
description: Name every ability once, grant them through additive roles, refuse through guards, and check them in routes, handlers, jobs and MCP tools from facts loaded once.
section:
    title: Identity & security
    order: 5
order: 13
lastUpdated: 2026-10-08
---

Signing someone in answers who is asking. Every route after that asks a second question: may
this person, on this team, on this plan, do this to that record? This guide answers it from one
place. It names every ability once, grants them through roles, refuses through guards, and
checks them in a route, a page, a background job and an MCP tool, with the plan and the
feature flags read as facts beside the user.

[`@sdxc/authz`](/api/authz) holds the catalog and the policy and answers every check
synchronously from facts loaded once per request. Its conditions are
[`@sdxc/expression`](/api/expression) JSON, and its failures are
[`@sdxc/result`](/api/result) values. The adapters reach
[`@sdxc/billing`](/api/billing), [`@sdxc/flags`](/api/flags), [`@sdxc/jobs`](/api/jobs) and
[`@sdxc/mcp`](/api/mcp); install each one when you use its adapter.

```bash
npm add @sdxc/authz @sdxc/result @sdxc/http remix
```

## Name what people do

An ability is one thing a person does: to a record, as `project.update` does to a project, or
to nothing in particular, as `reports.export` does. Declare every one in a catalog, and every
check, guard and test names it through the catalog rather than a string:

```typescript {% title="app/authz/abilities.ts" %}
import { abilities, ability, context } from "@sdxc/authz";

import type { Project } from "~/app/data/projects";
import type { Team } from "~/app/data/teams";

export default abilities({
	project: {
		create: ability({ context: context<{ team: Team }>("team") }),
		read: ability({
			context: context<{ project: Project }>("project"),
			deniedAs: "notFound",
		}),
		update: ability({
			context: context<{ project: Project }>("project"),
			fields: ["name", "description", "visibility"],
		}),
		delete: ability({ context: context<{ project: Project }>("project") }),
	},
	reports: {
		export: ability({ description: "Export usage reports as CSV" }),
	},
	agent: {
		read: ability({ description: "Answer an agent's reading tools" }),
		write: ability({ description: "Answer an agent's writing tools" }),
	},
});
```

`context<T>(...keys)` types what a check passes and names each key of `T` once. An ability
without one is a claim, checked with nothing but the person. `fields` lists what an update may
touch, so a grant can allow some of them and a handler can keep only those from the input.
`deniedAs: "notFound"` makes every refusal of `project.read` answer as a missing record, so a
project someone may not see looks like one that does not exist.

The catalog names each ability by its keys, `project.update`, and importing it does no work,
so route handlers, jobs and components share one module. Its root also answers `list()`, every
ability in declaration order with its description, for an admin page that explains a role.

## Write the policy

The policy says who holds what. Roles only allow, and the only refusals are guards:

```typescript {% title="app/authz/policy.ts" %}
import { allow, definePolicy, deny, fact } from "@sdxc/authz";

import abilities from "~/app/authz/abilities";

export default definePolicy(abilities, {
	facts: {
		actor: fact<{ id: string; teamId: string }>(),
	},
	conditions: {
		author: { op: "eq", field: "project.ownerId", path: "actor.id" },
	},
	roles: {
		viewer: [allow(["project.read", "agent.read"])],
		member: {
			inherits: ["viewer"],
			grants: [
				allow(["project.create", "reports.export", "agent.write"]),
				allow("project.update", {
					when: { op: "condition", name: "author" },
					fields: ["name", "description"],
				}),
			],
		},
		admin: { inherits: ["member"], grants: [allow("*")] },
	},
	guards: [
		deny(["project.read", "project.update", "project.delete"], {
			id: "other-team",
			when: { op: "ne", field: "project.teamId", path: "actor.teamId" },
			as: "notFound",
		}),
	],
});
```

A fact is anything a condition reads beyond the check's own context, here the signed-in
`actor`. `field` reads a path, and `path` compares it with another path rather than a
literal. A condition used in more than one grant goes under `conditions` and is referenced
by name.

Holding two roles is their union, so giving someone another role never takes anything away.
A member updates the name and description of projects they own, and an admin updates any field
of any project, because `allow("*")` covers every ability with every field. The guard is what
keeps a team's projects inside the team, and it refuses an admin too: a guard is the one thing
no role outranks. `as: "notFound"` makes its refusal answer as a missing project.

Nothing compiles when the module loads. The first check compiles the policy once, and
`policy.compile()` answers a `Result` that names the first mistake by grant: an ability, field,
role or fact the catalog does not have, a condition reading a context the ability never
passes, an inheritance cycle, or two grants with one `id`. Call it in a test and a typo fails
CI rather than a request.

A fact declared `fact<T>({ optional: true })` may be left unbound, as `actor` is for a guest. A
condition reading one starts with `{ op: "exists", field: "actor" }` inside an outer `all`, and
the compiler requires it, so a guest is refused cleanly rather than failing the check. When
people write rules in a form, `parseCondition("ctx.project.ownerId == ctx.actor.id")` reads
the text form into this JSON.

Register the policy once, and `ctx.access` is typed from it in every controller:

```typescript {% title="app/authz/types.ts" %}
import type policy from "~/app/authz/policy";

declare module "@sdxc/authz" {
	interface AuthzTypes {
		policy: typeof policy;
	}
}
```

## Bind the person on each request

`access()` from `@sdxc/authz/middleware/router` binds the policy to the request's roles and
facts and publishes it as `ctx.access`. Nothing loads when it runs: a role or fact given as a
function is read the first time a check needs it, and only once.

```typescript {% title="app/http/middleware/access.ts" %}
import { access } from "@sdxc/authz/middleware/router";

import policy from "~/app/authz/policy";
import { renderDenied } from "~/app/http/denied";

export const teamAccess = access(policy, {
	roles: (ctx) => [ctx.membership.role],
	facts: {
		actor: (ctx) => ({ id: ctx.user.id, teamId: ctx.team.id }),
	},
	onDenied: renderDenied,
});
```

Install it after your authentication middleware: `ctx.user`, `ctx.team` and
`ctx.membership` stand for what yours publishes. A later `access()` replaces an earlier one,
so the pages, an API and an MCP endpoint can each bind their own principal. `load` lists
abilities or whole groups to load before the handler runs, for a page that checks many of
them, and `ctx.access.as({ roles })` answers synchronously for another role over the facts
already loaded, such as a role per team on one page.

## Guard a route

`requireAbility` loads the record an ability needs and decides before the handler runs, so a
refused request is never validated or acted on:

```tsx {% title="app/http/controllers/projects/update.tsx" %}
import { requireAbility } from "@sdxc/authz/middleware/router";
import { redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { createAction } from "remix/router";

import abilities from "~/app/authz/abilities";
import { Projects } from "~/app/data/projects";
import { teamAccess } from "~/app/http/middleware/access";
import { readProjectForm } from "~/app/http/forms/project";
import routes from "~/routes/web";

export default createAction(routes.projects.update, {
	middleware: [
		teamAccess,
		requireAbility(abilities.project.update, {
			context: async (ctx) => {
				let project = await Projects.find(ctx.db, ctx.params.id);
				return project ? { project } : null;
			},
		}),
	],
	handler: async (ctx) => {
		let loaded = ctx.get(abilities.project.update);
		if (loaded === undefined) return notFound("Not Found");

		let { project } = loaded;
		let fields = ctx.access.permittedFields(abilities.project.update, {
			project,
		});
		let input = await readProjectForm(ctx, fields);
		await Projects.update(ctx.db, project.id, input);
		return redirect(routes.projects.show.href({ id: project.id }), {
			status: redirect.Status.SeeOther,
		});
	},
});
```

The loader's answer is published under the ability itself, and `ctx.get(ability)` reads it
back typed. A loader answering `null` is answered exactly like a `notFound` refusal, so a
missing project and a hidden one reach the same page. `permittedFields` answers the fields
this person may change, in the order the ability declares them: `["name", "description"]`
for a member editing their own project, every field for an admin. `readProjectForm` is your
own parse of the submitted form, keeping only those fields, so a member who adds
`visibility` to the form changes nothing.

A claim takes no loader: `requireAbility(abilities.reports.export)` is the whole guard. Every
decision is counted on the request's log record, a refusal leaves a note naming the ability
and its cause, and the decision a guard acted on is set as the record's `authz` fields.

## Check inside a handler

A handler checks synchronously once the abilities it reads are loaded. `decide` answers every
ability of a group at once, which is what a page needs to show or hide its buttons:

```tsx {% title="app/http/controllers/projects/show.tsx" %}
import { requireAbility } from "@sdxc/authz/middleware/router";
import { notFound } from "@sdxc/http/response/html";
import { createAction } from "remix/router";

import abilities from "~/app/authz/abilities";
import { Projects } from "~/app/data/projects";
import { teamAccess } from "~/app/http/middleware/access";
import { ProjectPage } from "~/resources/views/project";
import routes from "~/routes/web";

export default createAction(routes.projects.show, {
	middleware: [
		teamAccess,
		requireAbility(abilities.project.read, {
			context: async (ctx) => {
				let project = await Projects.find(ctx.db, ctx.params.id);
				return project ? { project } : null;
			},
		}),
	],
	handler: async (ctx) => {
		let loaded = ctx.get(abilities.project.read);
		if (loaded === undefined) return notFound("Not Found");

		await ctx.access.load(abilities.project);
		let can = ctx.access.decide(abilities.project, {
			project: loaded.project,
			team: ctx.team,
		});
		return ctx.render(<ProjectPage project={loaded.project} can={can} />);
	},
});
```

`can` is typed from the group, `{ create, read, update, delete }`, each a boolean, and each
ability receives only the context keys it declares. `claims(group)` does the same for a group
of claims. For a single check, `can` answers a boolean, `check` the full `Decision`, and
`authorize` a `Result<void, Forbidden>` whose failure carries the refusal, for code that
already returns Results.

A check never waits. One that reads a fact that has not been loaded, or whose source failed,
refuses with cause `error`, so an outage refuses the abilities that depend on it and nothing
else. That is why the handler awaits `load` first.

## Answer refusals

A refusal is plain data: its `cause` is `ungranted`, `outOfScope`, `denied` (a guard, with its
`reason`) or `error`, and its `as` is `notFound` or `forbidden`. The `onDenied` responder turns
it into your app's own page:

```tsx {% title="app/http/denied.tsx" %}
import type { Refusal } from "@sdxc/authz";
import type { RequestContext } from "remix/router";

import routes from "~/routes/web";
import { ForbiddenPage, NotFoundPage } from "~/resources/views/errors";

export function renderDenied(ctx: RequestContext, decision: Refusal) {
	if (decision.as === "notFound") {
		return ctx.render(<NotFoundPage />, { status: 404 });
	}
	if (decision.cause === "denied" && decision.reason?.startsWith("entitlement:")) {
		return Response.redirect(new URL(routes.pricing.href(), ctx.url), 303);
	}
	return ctx.render(<ForbiddenPage />, { status: 403 });
}
```

Render the same not-found page an unknown URL gets: a 404 that looks different from the real
one tells a stranger the record exists. Without a responder, a refusal answers a bare `403`
or `404`, and `requireAbility(ability, { onDenied })` overrides the responder for one route.

## Gate on the plan

A paid feature is a guard over the customer's entitlements. `@sdxc/authz/facts/billing` binds
them as a fact, read through the billing middleware's own `entitlements` reader, so the
request shares one read with `requireEntitlement` and anything else that asks:

```typescript {% title="app/authz/policy.ts" %}
import type { BillingFacts } from "@sdxc/authz/facts/billing";

import { allow, definePolicy, deny, fact } from "@sdxc/authz";

import abilities from "~/app/authz/abilities";

export default definePolicy(abilities, {
	facts: {
		actor: fact<{ id: string; teamId: string }>(),
		billing: fact<BillingFacts>(),
	},
	// conditions and roles as before
	guards: [
		// the other-team guard as before
		deny("reports.export", {
			id: "plan-reports",
			when: {
				op: "not",
				of: { op: "includes", field: "billing.features", value: "reports" },
			},
			reason: "entitlement:reports",
		}),
	],
});
```

Bind it with `fromEntitlements()` in the `access()` facts, after the billing middleware in
the chain:

```typescript {% title="app/http/middleware/access.ts" %}
import { fromEntitlements } from "@sdxc/authz/facts/billing";
import { access } from "@sdxc/authz/middleware/router";

import policy from "~/app/authz/policy";
import { renderDenied } from "~/app/http/denied";

export const teamAccess = access(policy, {
	roles: (ctx) => [ctx.membership.role],
	facts: {
		actor: (ctx) => ({ id: ctx.user.id, teamId: ctx.team.id }),
		billing: fromEntitlements(),
	},
	onDenied: renderDenied,
});
```

`BillingFacts` is `{ products, features }`, with `features` listing every feature the snapshot
grants as `true`, and an account with no snapshot binds two empty lists. The guard refuses an
admin on the free plan too, and its `reason` is what `renderDenied` above reads to send them
to the pricing page instead of a 403. Pass a loader, `fromEntitlements((ctx) => …)`, to read a
snapshot from somewhere other than the billing middleware. The read only happens on a request
that checks an ability whose grants read `billing`, so every other route costs nothing.

## Switch an ability off with a flag

An operational switch is a guard over a flag. `@sdxc/authz/facts/flags` binds a
[`@sdxc/flags`](/api/flags) catalog as a fact keyed by its property names, and evaluates only
the flags some condition reads:

```typescript {% title="app/authz/policy.ts" %}
import { definePolicy, deny, fact } from "@sdxc/authz";

import abilities from "~/app/authz/abilities";

export default definePolicy(abilities, {
	facts: {
		// actor and billing as before
		flags: fact<{ reportsExport: boolean }>(),
	},
	guards: [
		// the other-team and plan-reports guards as before
		deny("reports.export", {
			id: "reports-switch",
			when: { op: "eq", field: "flags.reportsExport", value: false },
			reason: "switched-off",
		}),
	],
});
```

The fact declares the flags the policy reads, by their property names in your `features`
catalog. Then add `flags: fromFlags(features)` from `@sdxc/authz/facts/flags` to the
`access()` facts.
It evaluates through the client `featureFlags()` from `@sdxc/flags/middleware/router`
published, so list that middleware before `access()`; pass `client` to use another. A split
on a flag no rule reads records no exposure, because nothing evaluated it.

Testing `== false` keeps the feature on while the flag answers its default, and the default
is what a flag system that is down answers. To refuse instead, pass `onError: "missing"`: a
flag that errored is left out, and a guard reading it refuses with cause `error`. When the
flag's subject is the team rather than the viewer, pass
`context: (ctx) => ({ targetingKey: ctx.team.id })`.

A fact these two subpaths do not cover is a `factLoader` from the main entry. It receives the
fact's `root`, the `paths` under it that the policy reads, and the request or job it loads
for, and answers a `Result`, so a settings fact can read only the settings some rule names.

## Check in a background job

A job has no signed-in user, so its handler binds the subject from its own payload.
`authz()` from `@sdxc/authz/middleware/dispatcher` publishes `ctx.authz` with the fact
sources every job shares, added to the dispatcher's chain after flags. With the `JobTypes` augmentation from
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron), every handler sees
it typed from the registered policy:

```typescript {% title="app/jobs/dispatcher.ts" %}
import { authz } from "@sdxc/authz/middleware/dispatcher";
import { fromFlags } from "@sdxc/authz/facts/flags";
import featureFlags from "@sdxc/flags/middleware/dispatcher";
import { createJobDispatcher } from "@sdxc/jobs";

import policy from "~/app/authz/policy";
import { database } from "~/app/jobs/middleware/database";
import { queue } from "~/app/jobs/queue";
import { openDatabase } from "~/app/lib/database";
import { features, flags } from "~/app/lib/flags";
import { logger } from "~/app/logger";

export const dispatcher = createJobDispatcher({
	logger,
	queue,
	middleware: [
		database(openDatabase),
		featureFlags(flags),
		authz(policy, { facts: { flags: fromFlags(features) } }),
	] as const,
});
```

The handler reads the member the job acts for and binds them. Facts it passes replace the
shared ones by root:

```typescript {% title="app/jobs/export-report.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import abilities from "~/app/authz/abilities";
import jobs from "~/app/jobs";
import { Entitlements } from "~/app/data/entitlements";
import { Members } from "~/app/data/members";

export default createJobHandler(jobs.reports.export, async (ctx) => {
	let { teamId, userId } = ctx.input;
	let member = await Members.find(ctx.database, teamId, userId);
	if (member === null) return ctx.exit("Member left the team");

	let bound = ctx.authz.for({
		roles: [member.role],
		facts: {
			actor: { id: userId, teamId },
			billing: () => Entitlements.facts(ctx.database, teamId),
		},
	});
	if (isFailure(bound)) return ctx.exit(bound.error.message);

	await bound.data.load(abilities.reports);
	let allowed = bound.data.authorize(abilities.reports.export);
	if (isFailure(allowed)) return ctx.exit(allowed.error.message);

	// build and send the report
});
```

The job checks again at run time, so an export queued before a downgrade or a removal is
refused when it runs. `Entitlements.facts` is your own read answering `{ products, features }`;
`fromEntitlements()` reads a request, so a job hands the fact in directly. Decisions are
counted on the run's log record, as they are on a request's.

## Scope an agent

An agent token acts for a person, and it should never do more than its scope allows nor more
than its holder may. Declare a role per scope and bind it as `within`, a ceiling every allowed
check must also pass:

```typescript {% title="app/authz/policy.ts" %}
import { allow, definePolicy } from "@sdxc/authz";

import abilities from "~/app/authz/abilities";

export default definePolicy(abilities, {
	// facts, conditions and guards as before
	roles: {
		// viewer, member and admin as before
		"agent:read": [allow(["agent.read", "project.read"])],
		"agent:write": [allow(["agent", "project"])],
	},
});
```

The MCP route binds its own `access()`, with the token's scope as the ceiling and the agent
claims loaded up front:

```typescript {% title="bootstrap/app.ts" %}
import { access } from "@sdxc/authz/middleware/router";

import abilities from "~/app/authz/abilities";
import policy from "~/app/authz/policy";
import { requireToken } from "~/app/http/middleware/token";
import routes from "~/routes/web";

import mcp from "./mcp";

router.map(routes.mcp, {
	middleware: [
		requireToken,
		access(policy, {
			roles: (ctx) => [ctx.membership.role],
			within: (ctx) => [`agent:${ctx.token.scope}`],
			facts: { actor: (ctx) => ({ id: ctx.user.id, teamId: ctx.team.id }) },
			load: [abilities.agent],
		}),
	],
	handler: (ctx) => mcp.fetch(ctx),
});
```

`router` is the one your application builds, and `requireToken` is your token middleware,
publishing the token and its holder. A check outside
the ceiling refuses with cause `outOfScope`, and a viewer's write-scoped token still cannot
write, because the holder's roles must allow it too.

`@sdxc/authz/mcp` connects the abilities to the tools. `guard(claim)` returns the tool's
`available` predicate, so one claim hides the tool from `tools/list` and refuses a call to it.
`requireToolAbility` is tool middleware that checks an ability against the call's validated
arguments. Here `toolset.renameProject` is a tool declared with a `projectId` and a `name`:

```typescript {% title="app/mcp/controllers/rename-project.ts" %}
import type { InputOf } from "@sdxc/mcp";

import { guard, requireToolAbility } from "@sdxc/authz/mcp";
import { createTool } from "@sdxc/mcp";

import abilities from "~/app/authz/abilities";
import { Projects } from "~/app/data/projects";
import toolset from "~/app/mcp/tools";

type Input = InputOf<typeof toolset.renameProject>;

export const renameProject = createTool(toolset.renameProject, {
	...guard(abilities.agent.write),
	middleware: [
		requireToolAbility<typeof abilities.project.update, Input>(
			abilities.project.update,
			{
				context: async (ctx) => {
					let project = await Projects.find(ctx.db, ctx.input.projectId);
					return project ? { project } : null;
				},
				field: "name",
				notFound: "No project has that id.",
			},
		),
	],
	handler: async (ctx) => {
		await Projects.rename(ctx.db, ctx.input.projectId, ctx.input.name);
		return "Renamed.";
	},
});
```

`guard` is synchronous, which is why the route lists `abilities.agent` under `load`.
`field: "name"` checks that one field, so a member renaming their own project passes. A
`notFound` refusal, or a loader answering `null`, reaches the model as the tool's own error
with the `notFound` message, so a project on another team reads like one that does not exist,
and any other refusal answers as `ForbiddenError` with the guard's reason.

## Test the policy as a table

`testAccess` from `@sdxc/authz/testing` binds from plain values, synchronously, so a table of
cases is the whole test:

```typescript {% title="app/authz/policy.test.ts" %}
import type { Decision } from "@sdxc/authz";

import { testAccess } from "@sdxc/authz/testing";
import { expect, test } from "vitest";

import abilities from "~/app/authz/abilities";
import policy from "~/app/authz/policy";

const ACTOR = { id: "u1", teamId: "t1" };
const OWN = { id: "p1", teamId: "t1", ownerId: "u1" };
const OTHER_TEAM = { id: "p2", teamId: "t2", ownerId: "u2" };

const DECISIONS: Decision[] = [];

function accessAs(role: string) {
	return testAccess(policy, {
		roles: [role],
		facts: {
			actor: ACTOR,
			billing: { products: [], features: [] },
			flags: { reportsExport: true },
		},
		onDecision: (decision) => DECISIONS.push(decision),
	});
}

test("a member renames their own project but not its visibility", () => {
	let member = accessAs("member");
	let context = { project: OWN };

	expect(member.can(abilities.project.update, context, "name")).toBe(true);
	expect(member.can(abilities.project.update, context, "visibility")).toBe(false);
});

test("another team's project answers as missing, even to an admin", () => {
	expect(
		accessAs("admin").check(abilities.project.read, { project: OTHER_TEAM }),
	).toMatchObject({
		allowed: false,
		cause: "denied",
		as: "notFound",
	});
});

test("the free plan refuses report exports", () => {
	expect(accessAs("admin").check(abilities.reports.export)).toMatchObject({
		cause: "denied",
		reason: "entitlement:reports",
	});
});
```

A required fact a case leaves out fails the conditions reading it, so a case that forgot one
refuses visibly instead of passing. `onDecision` records every decision the table reaches, and
a last test asserting `policy.coverage(DECISIONS)` answers `success([])` names every grant no
case matched, until the table reaches them all; a grant without an `id` is named by its
position, like `roles.member.1`. `testAccess` throws the `AuthzError` of a policy that does
not compile, which fails the test that bound it.

To review a change to the policy, `diffPolicies(before, after, cases)` decides each case under
both and answers the ones whose decisions differ. `policy.definition` is the policy as plain
JSON, so the previous version can be derived from it, or kept beside it.

## Where to go next

- [Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc) — the
  authentication that tells `access()` who is asking.
- [Charge for your app](/docs/data-and-background-work/billing) — the entitlement snapshot
  the billing fact reads.
- [Feature flags](/docs/data-and-background-work/feature-flags) — the catalog and client the
  flag fact evaluates through.
- [Expose your app over MCP](/docs/operations-and-testing/mcp-server) — the tools an agent's
  scope hides and refuses.
- [`@sdxc/authz`](/api/authz) — every option, the decision shapes, and `factLoader`.
