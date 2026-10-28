---
title: Decide who can do what
description: Name every ability once, grant them through additive roles, refuse through guards, and check them in routes, handlers, jobs and MCP tools from facts loaded once.
section:
    title: Identity & security
    order: 6
order: 13
lastUpdated: 2026-10-25
outcomes:
    - "How to name every ability once and grant them through additive roles"
    - "How to check abilities in routes, handlers, background jobs and MCP tools"
    - "How to test the policy as a table of people and abilities"
---

Signing someone in answers who is asking. Every route after that asks a second question: may
this person, on this team, on this plan, do this to that record? This guide answers it from one
place: it names every ability once, grants them through roles, refuses through guards, and
checks them in a route, a page, a background job and an MCP tool.

[`@sdxc/authz`](/api/authz) holds the catalog and the policy and answers every check
synchronously from facts loaded once per request. Its adapters for
[`@sdxc/billing`](/api/billing), [`@sdxc/jobs`](/api/jobs) and [`@sdxc/mcp`](/api/mcp) each
live on their own subpath, so a bundle carries only the adapters it imports.

```bash
npm add @sdxc/authz @sdxc/billing @sdxc/http @sdxc/jobs \
	@sdxc/lazy-route @sdxc/mcp @sdxc/result remix
```

An app from `sdxc create` starts with an empty catalog, policy and request binding, and
[`sdxc make policy`](/docs/sdxc/make-policy) adds a resource's `create`, `read`, `update` and
`delete` abilities with their grants:

```bash
sdxc make policy project
```

## Name what people do

An ability is one thing a person does: to a record, as `project.update` does to a project, or
to nothing in particular, as `reports.export` does. Declare every one in a catalog, and every
check, guard and test names it through the catalog rather than a string:

```typescript {% title="app/policies/abilities.ts" %}
import { abilities, ability, context } from "@sdxc/authz";

import type { Project } from "~/app/models/projects";
import type { Team } from "~/app/models/teams";

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

`context<T>(...keys)` types what a check passes; an ability without one is a claim, checked
with nothing but the person. `fields` lists what an update may touch, so a grant can allow
some of them. `deniedAs: "notFound"` makes every refusal of `project.read` answer as a missing
record, so a project someone may not see looks like one that does not exist.

## Write the policy

The policy says who holds what. Roles only allow, and the only refusals are guards:

```typescript {% title="app/policies/policy.ts" %}
import type { BillingFacts } from "@sdxc/authz/facts/billing";

import { allow, definePolicy, deny, fact } from "@sdxc/authz";

import abilities from "~/app/policies/abilities";

const policy = definePolicy(abilities, {
	facts: {
		actor: fact<{ id: string; teamId: string }>(),
		billing: fact<BillingFacts>(),
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
		"agent:read": [allow(["agent.read", "project.read"])],
		"agent:write": [allow(["agent", "project"])],
	},
	guards: [
		deny(["project.read", "project.update", "project.delete"], {
			id: "other-team",
			when: { op: "ne", field: "project.teamId", path: "actor.teamId" },
			as: "notFound",
		}),
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

declare module "@sdxc/authz" {
	interface AuthzTypes {
		policy: typeof policy;
	}
}

export default policy;
```

A fact is anything a condition reads beyond the check's own context: the signed-in `actor`,
and the customer's `billing` entitlements as `{ products, features }`. `field` reads a path,
and `path` compares it with another path rather than a literal.

Holding two roles is their union, so giving someone another role never takes anything away.
A member updates the name and description of projects they own, and an admin updates any
field of any project. The guards are the one thing no role outranks: `other-team` keeps a
team's projects inside the team, and `plan-reports` refuses an export on a plan without the
`reports` feature, an admin's included. The `agent:*` roles are the ceilings an agent token is
bound to, further down.

The `AuthzTypes` block registers the policy, so `ctx.access` and every check are typed from it
in every controller, job and tool. The first check compiles the policy, and
`policy.compile()` answers a `Result` naming the first mistake (an unknown ability, field,
role or fact, or an inheritance cycle), so call it in a test and a typo fails CI rather than a
request.

## Bind the person on each request

`access()` from `@sdxc/authz/middleware/router` binds the policy to the request's roles and
facts and publishes it as `ctx.access`. A role or fact given as a function is read the first
time a check needs it, and only once, so a route that never checks `reports.export` never
reads the entitlements:

```typescript {% title="app/http/middleware/access.ts" %}
import { fromEntitlements } from "@sdxc/authz/facts/billing";
import { access } from "@sdxc/authz/middleware/router";

import policy from "~/app/policies/policy";
import { renderDenied } from "~/app/http/middleware/denied";

export const teamAccess = access(policy, {
	roles: (ctx) => [ctx.membership.role],
	facts: {
		actor: (ctx) => ({ id: ctx.user.id, teamId: ctx.team.id }),
		billing: fromEntitlements(),
	},
	onDenied: renderDenied,
});
```

<note>
Install `access()` after your authentication middleware and the billing middleware: its role
and fact readers read `ctx.user`, `ctx.team` and `ctx.membership`, which stand for what your
authentication publishes, and `fromEntitlements()` reads through the billing middleware's own
`entitlements` reader.
</note>

## Guard a route

`requireAbility` loads the record an ability needs and decides before the handler runs, so a
refused request is never validated or acted on:

```tsx {% title="app/http/controllers/projects/update.tsx" %}
import { requireAbility } from "@sdxc/authz/middleware/router";
import { redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { createAction } from "remix/router";

import abilities from "~/app/policies/abilities";
import { Projects } from "~/app/models/projects";
import { teamAccess } from "~/app/http/middleware/access";
import { readProjectForm } from "~/app/http/validators/project";
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

`ctx.get(ability)` reads back what the loader answered, typed. A loader answering `null` is
answered exactly like a `notFound` refusal, so a missing project and a hidden one reach the
same page. `permittedFields` answers the fields this person may change, `["name",
"description"]` for a member editing their own project, and `readProjectForm`, your own form
parse, keeps only those, so a member who adds `visibility` to the form changes nothing. A
claim takes no loader: `requireAbility(abilities.reports.export)` is the whole guard.

## Check inside a handler

A handler checks synchronously once the abilities it reads are loaded. `decide` answers every
ability of a group at once, which is what a page needs to show or hide its buttons:

```tsx {% title="app/http/controllers/projects/show.tsx" %}
import { requireAbility } from "@sdxc/authz/middleware/router";
import { notFound } from "@sdxc/http/response/html";
import { createAction } from "remix/router";

import abilities from "~/app/policies/abilities";
import { Projects } from "~/app/models/projects";
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

`can` is typed from the group, `{ create, read, update, delete }`, each a boolean. For a single
check, `ctx.access.can` answers a boolean and `authorize` a `Result<void, Forbidden>`.

<note>
A check never waits. One that reads a fact that has not been loaded, or whose source failed,
refuses with cause `error`, so an outage refuses the abilities that depend on it and nothing
else. Await `ctx.access.load(...)` before checking synchronously, as the handler above does.
</note>

## Answer refusals

A refusal is plain data: its `cause` is `ungranted`, `outOfScope`, `denied` (a guard, with its
`reason`) or `error`, and its `as` is `notFound` or `forbidden`. The `onDenied` responder turns
it into your app's own page, and sends a refusal from the `plan-reports` guard to the pricing
page:

```tsx {% title="app/http/middleware/denied.tsx" %}
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

<warning>
Render the same not-found page an unknown URL gets: a 404 that looks different from the real
one tells a stranger the record exists.
</warning>

Without a responder, a refusal answers a bare `403` or `404`.

## Check in a background job

A job has no signed-in user, so its handler binds the subject from its own payload. Add
`authz(policy)` from `@sdxc/authz/middleware/dispatcher` to the dispatcher's middleware in
`app/initializers/dispatcher.ts`; it publishes `ctx.authz`, typed from the registered policy
through the `JobTypes` augmentation from
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron). The handler reads
the member the job acts for and binds them:

```typescript {% title="app/jobs/export-report.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import abilities from "~/app/policies/abilities";
import jobs from "~/app/jobs";
import { Entitlements } from "~/app/models/entitlements";
import { Members } from "~/app/models/members";

export default createJobHandler(jobs.reports.export, async (ctx) => {
	let { teamId, userId } = ctx.input;
	let member = await Members.find(ctx.db, teamId, userId);
	if (member === null) return ctx.exit("Member left the team");

	let bound = ctx.authz.for({
		roles: [member.role],
		facts: {
			actor: { id: userId, teamId },
			billing: () => Entitlements.facts(ctx.db, teamId),
		},
	});
	if (isFailure(bound)) return ctx.exit(bound.error.message);

	await bound.data.load(abilities.reports);
	let allowed = bound.data.authorize(abilities.reports.export);
	if (isFailure(allowed)) return ctx.exit(allowed.error.message);

	// build and send the report
});
```

<warning>
Check again inside the job, at run time: a check made when the job was queued says nothing
about a downgrade or a removal since, and the job's own check is what refuses that export.
</warning>

`Entitlements.facts` is your own read answering `{ products, features }`, since
`fromEntitlements()` reads a request.

## Scope an agent

An agent token acts for a person, and it should never do more than its scope allows nor more
than its holder may. The MCP route binds its own `access()`, with the token's scope as the
`within` ceiling, an `agent:*` role every allowed check must also pass:

```typescript {% title="app/initializers/router.ts" %}
import type { RequestContext } from "remix/router";

import { access } from "@sdxc/authz/middleware/router";
import { lazy } from "@sdxc/lazy-route";

import { requireToken } from "~/app/http/middleware/token";
import abilities from "~/app/policies/abilities";
import policy from "~/app/policies/policy";
import routes from "~/routes/web";

router.map(
	routes.mcp,
	lazy(
		() =>
			import("~/app/initializers/mcp").then(
				(it) => (ctx: RequestContext) => it.default.fetch(ctx),
			),
		[
			requireToken,
			access(policy, {
				roles: (ctx) => [ctx.membership.role],
				within: (ctx) => [`agent:${ctx.token.scope}`],
				facts: { actor: (ctx) => ({ id: ctx.user.id, teamId: ctx.team.id }) },
				load: [abilities.agent],
			}),
		],
	),
);
```

`router` is the one `createWebRouter` builds, and `requireToken` is your token middleware,
publishing the token and its holder. A check outside the ceiling refuses with cause
`outOfScope`, and a viewer's write-scoped token still cannot write, because the holder's
roles must allow it too.

`@sdxc/authz/mcp` connects the abilities to the tools. `guard(claim)` hides the tool from
`tools/list` and refuses a call to it, and `requireToolAbility` checks an ability against the
call's validated arguments:

```typescript {% title="app/mcp/tools/rename-project.ts" %}
import type { InputOf } from "@sdxc/mcp/server";

import { guard, requireToolAbility } from "@sdxc/authz/mcp";
import { createTool } from "@sdxc/mcp/server";

import abilities from "~/app/policies/abilities";
import { Projects } from "~/app/models/projects";
import toolset from "~/app/mcp/tools";

type Input = InputOf<typeof toolset.renameProject>;

export default createTool(toolset.renameProject, {
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

`guard` is synchronous, which is why the route lists `abilities.agent` under `load`. A
`notFound` refusal reaches the model as the tool's own error with the `notFound` message, so a
project on another team reads like one that does not exist.

## Test the policy as a table

`testAccess` from `@sdxc/authz/testing` binds from plain values, synchronously, so a table of
cases is the whole test:

```typescript {% title="app/policies/policy.test.ts" %}
import { testAccess } from "@sdxc/authz/testing";
import { expect, test } from "vitest";

import abilities from "~/app/policies/abilities";
import policy from "~/app/policies/policy";

const ACTOR = { id: "u1", teamId: "t1" };
const OWN = { id: "p1", teamId: "t1", ownerId: "u1" };
const OTHER_TEAM = { id: "p2", teamId: "t2", ownerId: "u2" };

function accessAs(role: string) {
	return testAccess(policy, {
		roles: [role],
		facts: { actor: ACTOR, billing: { products: [], features: [] } },
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
refuses visibly instead of passing, and `testAccess` throws for a policy that does not
compile.

## Where to go next

- [Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc) — the
  authentication that tells `access()` who is asking.
- [Expose your app over MCP](/docs/operations-and-testing/mcp-server) — the tools an agent's
  scope hides and refuses.
- [`@sdxc/authz`](/api/authz) — every option, the decision shapes, and the flag and custom fact loaders.
