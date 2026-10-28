# @sdxc/authz

Authorization from a typed catalog of abilities, additive roles and guards, answered synchronously from loaded facts.

## Installation

```sh
npm add @sdxc/authz
```

Conditions are [`@sdxc/expression`](https://www.npmjs.com/package/@sdxc/expression) JSON and failures are [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values; both install alongside. Each adapter needs its own optional peer: [`remix`](https://www.npmjs.com/package/remix) for `./middleware/router`, [`@sdxc/jobs`](https://www.npmjs.com/package/@sdxc/jobs) for `./middleware/dispatcher`, [`@sdxc/mcp`](https://www.npmjs.com/package/@sdxc/mcp) for `./mcp`, [`@sdxc/flags`](https://www.npmjs.com/package/@sdxc/flags) for `./facts/flags` and [`@sdxc/billing`](https://www.npmjs.com/package/@sdxc/billing) for `./facts/billing`.

## Usage

### Declare abilities

An ability is something a user does. One with a `context` is checked against records; one without is a claim, checked with nothing.

```typescript
import { abilities, ability, context } from "@sdxc/authz";

interface Article {
	authorId: string;
	orgId: string;
	published: boolean;
}

export default abilities({
	article: {
		create: ability(),
		read: ability({ context: context<{ article: Article }>("article"), deniedAs: "notFound" }),
		update: ability({
			context: context<{ article: Article }>("article"),
			fields: ["title", "body", "published"],
		}),
	},
	reports: { export: ability({ description: "Export usage reports as CSV" }) },
});
```

Each ability is named by its keys, `article.update`. `context<T>(...keys)` lists every key of `T` once. Importing the catalog does no work, so handlers, jobs and browser code share it.

### Write a policy

Roles only allow, so holding more roles never removes anything. Guards are the only refusals, and they apply to every role, admins included.

```typescript
import { allow, definePolicy, deny, fact } from "@sdxc/authz";

import abilities from "./abilities";

export default definePolicy(abilities, {
	facts: {
		actor: fact<{ id: string; orgId: string }>({ optional: true }),
		billing: fact<{ features: string[] }>(),
	},
	conditions: {
		owner: {
			op: "all",
			of: [
				{ op: "exists", field: "actor" },
				{ op: "eq", field: "article.authorId", path: "actor.id" },
			],
		},
	},
	everyone: [
		allow("article.read", { when: { op: "eq", field: "article.published", value: true } }),
	],
	roles: {
		member: [
			allow(["article.create", "article.read", "reports.export"]),
			allow("article.update", {
				when: { op: "condition", name: "owner" },
				fields: ["title", "body"],
			}),
		],
		admin: { inherits: ["member"], grants: [allow("*")] },
	},
	guards: [
		deny("reports.export", {
			id: "plan-reports",
			when: { op: "not", of: { op: "includes", field: "billing.features", value: "reports" } },
			reason: "entitlement:reports",
		}),
	],
});
```

A condition reading an optional fact tests `exists` on it first, in its outermost `all`, so a guest bound without `actor` gets an answer. A missing or mistyped required fact leaves the rule undecided, and the check refuses with cause `error`.

### Bind and check

```typescript
import { isFailure } from "@sdxc/result";

let bound = policy.for({
	roles: ["member"],
	facts: { actor: { id: user.id, orgId: org.id }, billing: () => loadBilling(org.id) },
});
if (isFailure(bound)) return bound;

let access = bound.data;
await access.load(abilities.reports, abilities.article);

access.can(abilities.reports.export); // boolean
access.check(abilities.article.update, { article }); // Decision
access.can(abilities.article.update, { article }, "published"); // one field
access.permittedFields(abilities.article.update, { article }); // ["title", "body"]
access.decide(abilities.article, { article }); // { create, read, update } as booleans
```

Every check is synchronous. A fact given as a function or promise resolves in `load`, at most once; a check reading one that has not loaded, or whose source failed, refuses with cause `error`. A billing outage therefore refuses the plan-gated abilities and nothing else.

### Guard a route

```typescript
import { access, requireAbility } from "@sdxc/authz/middleware/router";

import abilities from "./abilities";
import policy from "./policy";

router.map(routes.articles.update, {
	middleware: [
		access(policy, {
			roles: (ctx) => [ctx.membership.role],
			facts: { actor: (ctx) => ({ id: ctx.user.id, orgId: ctx.org.id }) },
		}),
		requireAbility(abilities.article.update, {
			async context(ctx) {
				let article = await findArticle(ctx.params.id);
				return article ? { article } : null;
			},
		}),
	],
	handler(ctx) {
		let loaded = ctx.get(abilities.article.update);
		if (loaded === undefined) return new Response(null, { status: 404 });
		let fields = ctx.access.permittedFields(abilities.article.update, loaded);
		return updateArticle(loaded.article, fields);
	},
});
```

`requireAbility` decides before the handler runs and publishes the loaded context under the ability. A loader answering `null` answers like a `notFound` refusal, so a missing record and a hidden one look the same. Register the policy once to type `ctx.access`:

```typescript
declare module "@sdxc/authz" {
	interface AuthzTypes {
		policy: typeof policy;
	}
}
```

## API

### Catalog

#### `abilities(tree): Catalog<T>`

Names every ability by its dot-joined keys and returns the frozen tree. The root also answers `list()` (every ability, in declaration order) and `filter({ metadata })` (abilities whose metadata holds every given entry). Throws a `TypeError` for a key containing `.` or equal to `*`, or a root group named `list` or `filter`.

#### `ability(options?): Ability`

Declares an ability. Options: `context` (from `context()`), `fields`, `deniedAs` (`"forbidden"` by default, or `"notFound"`), and `description` and `metadata` for introspection.

#### `context<T>(...keys): ContextDefinition<T>`

Types the check context and names its roots, every key of `T` exactly once; a repeated key throws a `TypeError`.

#### `isAbility(value): boolean`

Whether a value is a declared ability rather than a group.

### Policy

#### `definePolicy(catalog, options): Policy`

`options` holds `facts`, `conditions` (referenced as `{ op: "condition", name }`), `everyone` (allows for any principal), `roles` (a list of allows, or `{ inherits, grants }`) and `guards`. The policy compiles on first use and keeps the result.

#### `allow(ability, options?)` and `deny(ability, options?)`

Return plain JSON grants, so a policy can be stored and diffed. `ability` is a leaf, a group, `"*"` or a list of them. Options: `id`, `when`, `except` and `fields`; `deny` adds `reason` and `as`. A grant without `id` is named by position, like `roles.member.1`.

#### `fact<T>(options?): FactDefinition`

Declares a fact root; `{ optional: true }` lets it be bound as absent.

#### `parseCondition(text): Result<Condition, ExpressionError>`

Reads the text form, `exists(ctx.actor) and ctx.article.authorId == ctx.actor.id`, into the JSON form a policy stores.

#### `policy.compile(): Result<void, AuthzError>`

Fails on an unknown ability, field, condition, role or fact, a condition reading a root no covered ability supplies, an optional fact read without `exists`, an inheritance cycle, or two grants sharing an `id`.

#### `policy.for(binding): Result<Access, AuthzError>`

Binds a principal. `roles` and `within` are lists or functions returning one; `within` names roles whose grants cap every check. `facts` takes, by root, a value, a promise, a function or a `factLoader`. `onDecision` sees every decision, and `context` is the request or job handed to fact loaders.

#### `policy.coverage(decisions): Result<GrantId[], AuthzError>`

The ids of grants no decision matched, to find grants a test suite never reached.

#### `policy.catalog` and `policy.definition`

The catalog and the options as written.

#### `factLoader(load): FactLoader` and `isFactLoader(value)`

Builds a fact source whose `load({ root, paths, context })` learns the paths the policy reads under the root and the invocation it loads for, and answers a `Result`.

### Access

#### `access.load(...targets): Promise<void>`

Resolves the roles and every fact root the grants covering these abilities, groups or catalog read. It never rejects; a failed source binds its root as unavailable.

#### `access.can(ability, context?, field?)`, `access.check(...)`, `access.authorize(...)`

Answer a boolean, a `Decision`, or `Result<void, Forbidden>`. A claim takes no context, so its only argument is the field.

#### `access.permittedFields(ability, context?): string[]`

The fields allowed, in declaration order, narrowed by the ceiling and minus matching guards' fields; empty when refused.

#### `access.decide(group, context)` and `access.claims(group)`

A boolean per ability of a group, typed `Decisions<typeof group>`, or per claim, typed `Claims<typeof group>`. Each ability receives only the context keys it declares.

#### `access.as({ roles, within?, facts? }): Access`

A synchronous access for another scope that shares every fact already loaded. Omitting `within` keeps the parent's ceiling.

### Decisions and errors

#### `Decision`

`{ ability, allowed: true, grants }`, or a `Refusal` with `as` (`forbidden` or `notFound`) and a `cause`: `ungranted`, `outOfScope` (refused by `within`), `denied` (with the guard's `reason` and `grants`) or `error` (with `errors`, each a `ConditionFailure` naming the `grant`, `message`, `path`, and the `missing` path or `mismatch`ed types). It is plain data, so it crosses an RPC boundary intact.

#### `Forbidden`

The error `authorize` fails with, carrying the refusal as `decision`.

#### `AuthzError`

A policy that does not compile, naming the `grant` and `path` at fault.

### `@sdxc/authz/middleware/router`

#### `access(policy, options?): Middleware`

Binds the request's principal as `ctx.access`, also readable with `ctx.get(CurrentAccess)`. Options: `roles`, `within` and `facts` (values, functions of the request, or loaders), `load` (abilities to load before the handler), and `onDenied(ctx, refusal)` for every `requireAbility` behind it. A later `access` replaces an earlier one.

#### `requireAbility(ability, options?): Middleware`

Loads `context(ctx)`, checks the ability (or one `field`), and answers a refusal through its own `onDenied`, the one `access` installed, or a bare `403`/`404`. On success, `ctx.get(ability)` reads the loaded context. Decisions are counted on the invocation's log, and an undecidable one fails it.

### `@sdxc/authz/middleware/dispatcher`

#### `authz(policy, { facts? }): JobMiddleware`

Publishes `ctx.authz` (and `CurrentAuthz`), whose `for(binding)` binds a job's subject over the shared fact sources; facts given to `for` replace shared ones by root.

### `@sdxc/authz/mcp`

#### `guard(claim): { available }`

Spread into a tool's action so one claim hides the tool from `tools/list` and refuses a call to it. List the claim under the route's `access` `load`.

#### `requireToolAbility(ability, { context?, field?, notFound? }): ToolMiddleware`

Checks after the arguments validate. A `notFound` refusal or a `null` context answers as a tool error reading `notFound` (`"Not found"` by default); a `forbidden` one throws `ForbiddenError` with the guard's reason.

### `@sdxc/authz/facts/flags`

#### `fromFlags(catalog, { client?, context?, onError? }): FactLoader`

Binds a flag catalog as a fact root keyed by property name, evaluating only the flags some condition reads. The client defaults to the invocation's from `@sdxc/flags/middleware`; `onError: "missing"` omits a flag that errored, so a rule reading it refuses.

### `@sdxc/authz/facts/billing`

#### `fromEntitlements(load?): FactLoader<BillingFacts>`

Binds `{ products, features }`, where `features` lists the features granted as `true` and a `null` snapshot is two empty lists. Without a loader it reads the request's entitlements through `@sdxc/billing/middleware`.

### `@sdxc/authz/testing`

#### `testAccess(policy, { roles, within?, facts?, onDecision? }): Access`

Binds synchronously from plain values and throws the `AuthzError` of a policy that does not compile.

#### `diffPolicies(before, after, cases): Result<PolicyChange[], AuthzError>`

Decides every `{ name?, roles, facts?, ability, args? }` case under both policies and answers those that differ in outcome, cause, answer, reason or matched grants.

### Types

- `Ability`, `AnyAbility`, `AbilityGroup`, `AbilityOptions`, `AbilityName`, `Catalog`, `CatalogMethods`, `LoadTarget`, `DeniedAs`: the catalog.
- `ContextOf<A>`, `FieldOf<A>`, `GroupContext<G>`, `Decisions<G>`, `Claims<G>`, `CheckArgs<A>`, `ContextArgs<A>`: what checks take and answer.
- `Policy`, `AnyPolicy`, `PolicyOptions`, `RoleOf`, `AuthzTypes`, `RegisteredPolicy`, `RegisteredAccess`, `AccessOf<P>`, `FactsOf<P>`: policies and registration.
- `Grant`, `AllowGrant`, `DenyGrant`, `AllowOptions`, `DenyOptions`, `Condition`, `FactDefinition`, `FactDefinitions`, `FactValue`, `FactValues`: what a policy is written in.
- `Access`, `AccessBinding`, `DerivedBinding`, `RoleSource`, `FactSource`, `FactLoader`, `FactRequest`, `InvocationContext`: binding.
- `Decision`, `Allowed`, `Refusal`, `Ungranted`, `Denied`, `Undecidable`, `ConditionFailure`, `GrantId`, `AuthzErrorOptions`: answers.

## Pattern: Answering refusals

One `onDenied` maps every refusal on a surface to a response. Render the app's own not-found page for `notFound`, so the refusal looks exactly like a missing record.

```tsx
import type { Refusal } from "@sdxc/authz";
import type { RequestContext } from "remix/router";

import { access } from "@sdxc/authz/middleware/router";

import policy from "./policy";

function renderDenied(ctx: RequestContext, decision: Refusal) {
	if (decision.as === "notFound") return ctx.render(<NotFoundPage />, { status: 404 });
	if (decision.cause === "denied" && decision.reason?.startsWith("entitlement:")) {
		return Response.redirect(new URL("/billing", ctx.url), 303);
	}
	return ctx.render(<ForbiddenPage />, { status: 403 });
}

let middleware = [
	access(policy, { roles: (ctx) => [ctx.membership.role], onDenied: renderDenied }),
];
```

## Pattern: Plan and flag gates

A guard over a billing or flag fact refuses whatever role is held, and its `reason` tells `onDenied` what to offer. Both fact sources load lazily, only when a check reads them.

```typescript
import { allow, definePolicy, deny, fact } from "@sdxc/authz";
import { fromEntitlements } from "@sdxc/authz/facts/billing";
import { fromFlags } from "@sdxc/authz/facts/flags";
import { access } from "@sdxc/authz/middleware/router";
import { defineFlags, flag } from "@sdxc/flags/catalog";

import abilities from "./abilities";

let features = defineFlags({ reportsExport: flag.boolean("reports-export", false) });

let policy = definePolicy(abilities, {
	facts: {
		billing: fact<{ products: string[]; features: string[] }>(),
		flags: fact<{ reportsExport: boolean }>(),
	},
	roles: { member: [allow("reports")] },
	guards: [
		deny("reports.export", {
			id: "plan-reports",
			when: { op: "not", of: { op: "includes", field: "billing.features", value: "reports" } },
			reason: "entitlement:reports",
		}),
		deny("reports.export", {
			id: "reports-switch",
			when: { op: "eq", field: "flags.reportsExport", value: false },
			reason: "switched-off",
		}),
	],
});

let middleware = [
	access(policy, {
		roles: (ctx) => [ctx.membership.role],
		facts: { billing: fromEntitlements(), flags: fromFlags(features) },
	}),
];
```

Install the billing and flags middleware before `access`, or pass `fromEntitlements` a loader and `fromFlags` a `client`.

## Pattern: Permissions for a page

A page loads once, then decides synchronously, and hands the booleans to the browser. `access.as` answers per team on the same page without loading the shared facts again.

```tsx
import type { Decisions } from "@sdxc/authz";

import abilities from "./abilities";

router.get(routes.articles.show, async (ctx) => {
	let article = await findArticle(ctx.params.id);
	await ctx.access.load(abilities.article);

	let can: Decisions<typeof abilities.article> = ctx.access.decide(abilities.article, { article });

	let teams = ctx.memberships.map((membership) => ({
		team: membership.team,
		canCreate: ctx.access.as({ roles: [membership.role] }).can(abilities.article.create),
	}));

	return ctx.render(<ArticlePage article={article} can={can} teams={teams} />);
});
```

## Pattern: Scoped API tokens

`within` caps every check at the grants of the given roles, so a token never does more than its scope nor more than the user holding it.

```typescript
import { allow, definePolicy } from "@sdxc/authz";
import { access } from "@sdxc/authz/middleware/router";

import abilities from "./abilities";

let policy = definePolicy(abilities, {
	roles: {
		member: [allow(["article", "reports"])],
		"token:read": [allow("article.read")],
		"token:write": [allow("article")],
	},
});

let apiMiddleware = [
	access(policy, {
		roles: (ctx) => [ctx.token.owner.role],
		within: (ctx) => ctx.token.scopes.map((scope) => `token:${scope}`),
	}),
];
```

A check the holder may perform but the scope excludes refuses with cause `outOfScope`.

## Pattern: MCP tools

One claim both hides a tool and refuses a call to it; a record check runs after the arguments validate. Here the catalog also holds claims for agent tokens, `agent: { read: ability(), write: ability() }`.

```typescript
import { guard, requireToolAbility } from "@sdxc/authz/mcp";
import { access } from "@sdxc/authz/middleware/router";
import { createHandler } from "@sdxc/mcp/server";

import abilities from "./abilities";
import policy from "./policy";

let mcp = createHandler({ name: "articles", version: "1.0.0" });

mcp.tools.map(toolset, {
	actions: {
		list: { ...guard(abilities.agent.read), handler: listArticles },
		publish: {
			...guard(abilities.agent.write),
			middleware: [
				requireToolAbility(abilities.article.update, {
					async context(ctx) {
						let article = await findArticle(ctx.input.articleId);
						return article ? { article } : null;
					},
					field: "published",
					notFound: "No such article",
				}),
			],
			handler: publishArticle,
		},
	},
});

let mcpMiddleware = [
	access(policy, {
		roles: (ctx) => ctx.token.scopes,
		load: [abilities.agent],
	}),
];
```

## Pattern: Authorizing a job

A job binds its subject from its own payload; the dispatcher middleware shares the fact sources every job uses.

```typescript
import { fromFlags } from "@sdxc/authz/facts/flags";
import { authz } from "@sdxc/authz/middleware/dispatcher";
import { createJobDispatcher, createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import abilities from "./abilities";
import policy from "./policy";

let dispatcher = createJobDispatcher({
	logger,
	queue,
	middleware: [authz(policy, { facts: { flags: fromFlags(features) } })],
});

export default createJobHandler(jobs.exportReport, async (ctx) => {
	let bound = ctx.authz.for({ roles: [ctx.input.role] });
	if (isFailure(bound)) return ctx.log.fail(bound.error);
	await bound.data.load(abilities.reports);
	if (!bound.data.can(abilities.reports.export)) return;
	await exportReport(ctx.input.orgId);
});
```

## Pattern: Testing a policy

`testAccess` binds synchronously, so a table of cases is the whole test. `coverage` names the grants the suite never reached, and `diffPolicies` lists what a change to the policy decides differently.

```typescript
import type { Decision } from "@sdxc/authz";

import { diffPolicies, testAccess } from "@sdxc/authz/testing";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import abilities from "./abilities";
import policy from "./policy";
import previous from "./policy.previous";

let decisions: Decision[] = [];
let billing = { features: ["reports"] };
let draft = { authorId: "u1", orgId: "o1", published: false };

test("members edit their own drafts", () => {
	let member = testAccess(policy, {
		roles: ["member"],
		facts: { actor: { id: "u1", orgId: "o1" }, billing },
		onDecision: (decision) => decisions.push(decision),
	});

	expect(member.can(abilities.article.update, { article: draft })).toBe(true);
	expect(member.can(abilities.article.update, { article: { ...draft, authorId: "u2" } })).toBe(
		false,
	);
});

test("guests never see drafts", () => {
	let guest = testAccess(policy, { roles: [], facts: { billing } });
	expect(guest.check(abilities.article.read, { article: draft })).toMatchObject({
		cause: "ungranted",
		as: "notFound",
	});
});

test("every grant is exercised", () => {
	expect(unwrap(policy.coverage(decisions))).toEqual([]);
});

test("the change only opens exports to members", () => {
	let changes = unwrap(
		diffPolicies(previous, policy, [
			{
				name: "member export",
				roles: ["member"],
				facts: { billing },
				ability: abilities.reports.export,
			},
		]),
	);
	expect(changes.map((change) => change.case.name)).toEqual(["member export"]);
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/authz": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
