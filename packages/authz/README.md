# @sdxc/authz

Authorization from a typed catalog of abilities, additive roles and guards, answered synchronously from loaded facts.

## Installation

```sh
npm add @sdxc/authz
```

Conditions are [`@sdxc/expression`](https://www.npmjs.com/package/@sdxc/expression) JSON and failures are [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values; both install alongside. The adapters reach [`remix`](https://www.npmjs.com/package/remix), [`@sdxc/jobs`](https://www.npmjs.com/package/@sdxc/jobs), [`@sdxc/mcp`](https://www.npmjs.com/package/@sdxc/mcp), [`@sdxc/flags`](https://www.npmjs.com/package/@sdxc/flags) and [`@sdxc/billing`](https://www.npmjs.com/package/@sdxc/billing), each an optional peer you install when you use its adapter.

## Usage

### Declaring abilities

An ability is something a user does: to one record, several, or none.

```typescript
import { abilities, ability, context } from "@sdxc/authz";

export default abilities({
	article: {
		create: ability({ context: context<{ org: Org }>("org") }),
		read: ability({ context: context<{ article: Article }>("article"), deniedAs: "notFound" }),
		update: ability({
			context: context<{ article: Article }>("article"),
			fields: ["title", "body", "published"],
		}),
	},
	reports: { export: ability({ description: "Export usage reports as CSV" }) },
});
```

`context<T>(...keys)` names every key of `T` once; an ability without one is a claim, checked with no context. Importing the catalog costs nothing, so handlers, jobs and hydrated components share it.

### Writing a policy

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

Roles only allow, so holding another role never removes anything. Guards are the only refusals, and they refuse an admin too. A condition that reads an optional fact tests `exists(ctx.<root>)` first, in its outermost `all`, so a guest bound without `actor` answers instead of failing.

### Checking

```typescript
import { isFailure } from "@sdxc/result";

let bound = policy.for({
	roles: ["member"],
	facts: { actor: { id: user.id, orgId: org.id }, billing: () => loadBilling(org) },
});
if (isFailure(bound)) return bound;

let access = bound.data;
await access.load(abilities.reports);

access.can(abilities.reports.export); // boolean
access.check(abilities.article.update, { article }); // Decision
access.permittedFields(abilities.article.update, { article }); // ["title", "body"]
access.decide(abilities.article, { article, org }); // { create, read, update }: booleans
```

Every check is synchronous. Facts given as functions or promises load through `load`, at most once each; a check reading one that has not loaded, or whose source failed, refuses with cause `error`, so a billing outage refuses plan-gated abilities and nothing else.

### Guarding a route

```typescript
import { access, requireAbility } from "@sdxc/authz/middleware/router";

router.map(routes.articles.update, {
	middleware: [
		requireUser,
		access(policy, {
			roles: (ctx) => [ctx.membership.role],
			facts: { actor: (ctx) => ({ id: ctx.user.id, orgId: ctx.org.id }) },
			onDenied: renderDenied,
		}),
		requireAbility(abilities.article.update, {
			context: async (ctx) => {
				let article = await findArticle(ctx.params.id);
				return article ? { article } : null;
			},
		}),
	],
	handler(ctx) {
		let { article } = ctx.get(abilities.article.update);
		let fields = ctx.access.permittedFields(abilities.article.update, { article });
		// …
	},
});
```

A loader answering `null` answers exactly like a `notFound` refusal, so a missing record and one hidden from this user look the same.

## API

### Catalog

#### `abilities(tree)`

Names every ability by its keys dot-joined (`article.update`) and returns the tree, whose root also answers `list()` and `filter({ metadata })`. A key containing `.` or equal to `*`, or a root group named `list` or `filter`, throws a `TypeError`.

#### `ability(options?)`

Declares an ability: `context` (from `context()`), `fields`, `deniedAs` (`"forbidden"` by default, or `"notFound"`), and `description` and `metadata` for introspection.

#### `context<T>(...keys)`

Types the check context and names its roots, every key of `T` exactly once.

#### `isAbility(value)`

Whether a value is a declared ability rather than a group.

### Policy

#### `definePolicy(catalog, options)`

Returns a `Policy`. `options` holds `facts`, `conditions` (referenced as `{ op: "condition", name }`), `everyone`, `roles` (a list of allows, or `{ inherits, grants }`) and `guards`. Nothing compiles until the first binding, and compiling once is memoized.

#### `allow(ability, options?)` and `deny(ability, options?)`

Return plain JSON grants. `ability` is a leaf, a group, `"*"` or a list; options are `id`, `when`, `except`, `fields`, and for `deny` also `reason` and `as`. A grant without `id` is named by position, like `roles.member.1`.

#### `fact<T>(options?)`

Declares a fact root; `{ optional: true }` lets it be bound as absent.

#### `parseCondition(text)`

Reads the text form, `ctx.article.authorId == ctx.actor.id`, into the JSON form a policy stores.

#### `policy.compile()`

Answers `Result<void, AuthzError>`, failing on an unknown ability, field, condition, role or fact, a condition reading a root no covered ability supplies, an optional fact read without testing it, an inheritance cycle, or two grants sharing an `id`.

#### `policy.for(binding)`

Binds an `Access`, answering `Result<Access, AuthzError>`. `binding.roles` and `binding.within` are lists or functions returning one; `within` names roles whose grants cap every check, so a token never does more than its scope nor more than its holder. `binding.facts` takes values, promises, functions or loaders by root. `binding.onDecision` sees every decision.

#### `policy.coverage(decisions)`

The ids of the grants no decision matched, to name grants a suite never reached.

### Access

#### `access.load(...targets)`

Resolves the roles and the fact roots the grants covering these abilities, groups or catalog read. It never rejects.

#### `access.can(ability, context?, field?)`, `access.check(...)` and `access.authorize(...)`

Answer a boolean, a `Decision`, or `Result<void, Forbidden>`. A claim takes no context, so its optional argument is the field.

#### `access.permittedFields(ability, context?)`

The fields allowed, narrowed by the ceiling, minus the fields of matching guards; empty when the ability is refused.

#### `access.decide(group, context)` and `access.claims(group)`

A boolean per ability of a group, typed `Decisions<typeof group>`, or per claim. Each ability receives only the context keys it declares.

#### `access.as({ roles, within?, facts? })`

A synchronous access for another scope, sharing every fact already loaded, such as a role per team on one page.

### Decisions and errors

A `Decision` is `{ ability, allowed: true, grants }`, or a refusal whose `cause` is `ungranted`, `outOfScope`, `denied` (with the guard's `reason` and `grants`) or `error` (with the `errors` that left a condition undecided). Every refusal carries `as`: `notFound` when any matching guard or the ability says so. It is plain data, so it crosses an RPC boundary intact.

`Forbidden` carries a refusal as `decision`. `AuthzError` names the `grant` and `path` of a policy that does not compile.

`factLoader(load)` builds a fact source that learns the `root`, the `paths` the policy reads under it, and the request or job it loads for.

### `@sdxc/authz/middleware/router`

`access(policy, options)` publishes `ctx.access` through the `CurrentAccess` key, binding `roles`, `within` and `facts` from the request, loading the abilities in `load` before the handler, and keeping `onDenied` for `requireAbility`. `requireAbility(ability, { context?, field?, onDenied? })` loads the context, decides before the handler, and publishes what it loaded under the ability, read with `ctx.get(ability)`. Without a responder a refusal answers a bare `403` or `404`. Decisions count on the invocation's log, and an undecidable one fails it.

Register the policy once to type `ctx.access`:

```typescript
declare module "@sdxc/authz" {
	interface AuthzTypes {
		policy: typeof policy;
	}
}
```

### `@sdxc/authz/middleware/dispatcher`

`authz(policy, { facts })` publishes `ctx.authz`, whose `for(binding)` binds a job's subject over the shared fact sources.

### `@sdxc/authz/mcp`

`guard(claim)` returns `{ available }`, so one claim hides a tool from `tools/list` and refuses a call to it. `requireToolAbility(ability, { context, field?, notFound? })` checks after the arguments validate: a `notFound` refusal, or a `null` context, answers as a tool error reading `notFound`, and a `forbidden` one throws `ForbiddenError` with the reason.

### `@sdxc/authz/facts/flags`

`fromFlags(catalog, { client?, context?, onError? })` binds a flag catalog as a fact root keyed by property name, evaluating only the flags some condition reads. The client defaults to the invocation's from `@sdxc/flags/middleware`; `onError: "missing"` omits a flag that errored, so a rule reading it refuses.

### `@sdxc/authz/facts/billing`

`fromEntitlements(load?)` binds `{ products, features }`, where `features` lists the snapshot's `true` features and a `null` snapshot is two empty lists. Without a loader it reads through `readEntitlements(ctx)` from `@sdxc/billing/middleware`, sharing the request's one read.

### `@sdxc/authz/testing`

`testAccess(policy, { roles, within?, facts })` binds synchronously from values and throws an `AuthzError` for a policy that does not compile. `diffPolicies(before, after, cases)` answers every case two policies decide differently.

## Pattern: A table of cases

```typescript
import { testAccess } from "@sdxc/authz/testing";
import { expect, test } from "vitest";

import abilities from "./abilities";
import policy from "./policy";

const BILLING = { features: ["reports"] };

test("members edit their own drafts and guests read published articles", () => {
	let member = testAccess(policy, {
		roles: ["member"],
		facts: { actor: { id: "u1", orgId: "o1" }, billing: BILLING },
	});
	let guest = testAccess(policy, { roles: [], facts: { billing: BILLING } });
	let draft = { authorId: "u1", orgId: "o1", published: false };

	expect(member.can(abilities.article.update, { article: draft })).toBe(true);
	expect(member.can(abilities.article.update, { article: { ...draft, authorId: "u2" } })).toBe(
		false,
	);
	expect(guest.check(abilities.article.read, { article: draft })).toMatchObject({
		cause: "ungranted",
		as: "notFound",
	});
});
```

## Pattern: Answering refusals

```tsx
import type { Refusal } from "@sdxc/authz";

export function renderDenied(ctx: RequestContext, decision: Refusal) {
	if (decision.as === "notFound") return ctx.render(<NotFoundPage />, { status: 404 });
	if (decision.cause === "denied" && decision.reason?.startsWith("entitlement:"))
		return Response.redirect(new URL("/billing", ctx.url), 303);
	return ctx.render(<ForbiddenPage />, { status: 403 });
}
```

Render the app's own not-found page for `notFound`: a bare 404 that differs from the real one would reveal what the refusal hides.

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
