# ADR-119: Authorization Package

## Status

**Accepted** - 2026-10-07

## Background

Five apps make authorization decisions today, each by hand. reader gates eleven tier features
inside each user's Durable Object and narrows MCP tokens by scope; uptime checks a role per team
membership, 25 API-key scopes and the team owner's billing state; blog and r3-auth check an
`admin` role column; auth-saas intersects a token's consented scopes with a role's ceiling. None
of these decisions can be listed, tested as a set, or handed to a hydrated component that needs
to hide what the server would refuse.

This ADR adds `@sdxc/authz`, one authorization model for these apps, after comparing how
established libraries answer the same problem. Its requirements:

| Requirement       | Meaning                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Shared language   | Conditions are `@sdxc/expression` JSON, the operator vocabulary feature-flag targeting already uses          |
| Client decisions  | A server can hand a hydrated component what the user can do, in the safest form available                    |
| Beyond DB records | An ability is anything a user does: one record, several at once, or none (exporting, inviting, using a tool) |
| Simple by default | A role is a list of abilities; a condition is added only where a rule needs one                              |
| Testable          | A policy answers synchronously from plain data, so a table of cases is the whole test                        |
| Integrated        | `remix/router`, `@sdxc/jobs`, `@sdxc/mcp`, `@sdxc/flags` and `@sdxc/billing` each get a first-class adapter  |

## Context

### Decisions the apps make today

| App       | Principals                                                                          | Decisions                                                                                                                     |
| --------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| reader    | reader, MCP agent token, Durable Object alarms                                      | Tier gates inside `UserDO` reached by every path; tier derived with grace periods and manual grants; token scope              |
| uptime    | user, team member (`member`/`admin`, owner by `owner_id`), API key, anonymous, jobs | Membership 404, role 403, scopes with `insufficient_scope`, requested ⊆ held scopes, owner's billing state (402), flags (503) |
| blog      | `admin`/`guest` role, anonymous                                                     | CMS behind `requireAdmin`; drafts answer 403 to visitors, revealing the slug exists                                           |
| r3-auth   | subject (`user`/`admin`), OAuth client, anonymous                                   | Admin pages, account actions scoped to the subject, the provider's own client protected, claims released per scope            |
| auth-saas | platform member per tenant, agent client, OAuth client, API key                     | Consented scopes ∩ role ceiling, credentials minted within the minter's scopes, plan features inside each tenant's object     |

sdxc, books, demo and pkmn have no principal to authorize beyond anonymous visitors.

### What established libraries do

| System             | Rules are                        | Combining                                                               | Lists                             | Client                                  |
| ------------------ | -------------------------------- | ----------------------------------------------------------------------- | --------------------------------- | --------------------------------------- |
| CASL (JS)          | JSON, Mongo-style conditions     | The last matching rule wins                                             | Rules to query                    | Ships each user's rules                 |
| CanCanCan (Ruby)   | Hashes or blocks                 | The last matching rule wins                                             | Hash conditions to SQL            | None                                    |
| Pundit (Ruby)      | A class per model                | Code                                                                    | Hand-written scope                | Booleans in views                       |
| Laravel (PHP)      | Closures and policy classes      | `before`/`after` hooks, then deny; an undefined ability denies          | None                              | Booleans shared as props, no convention |
| Cedar              | Policy language with a schema    | Forbid overrides permit, order-independent                              | Partial evaluation (experimental) | None                                    |
| Oso                | Polar resource blocks            | Rules over roles and relations                                          | `list`, SQL filters               | Allowed `actions`                       |
| OpenFGA, SpiceDB   | Relationship tuples              | Computed relations                                                      | ListObjects, LookupResources      | None                                    |
| OPA                | Rego                             | Incremental rules OR; a `default` the author writes                     | Partial evaluation to SQL         | None                                    |
| Casbin (JS)        | Model file plus policy rows      | Preset effects                                                          | None                              | Action-to-object map, policy withheld   |
| AccessControl (JS) | JSON grants                      | Deny overrides, plus restrict-only gates                                | Field filtering only              | None                                    |
| Cerbos             | YAML and CEL                     | Deny wins within a role, any role's allow across roles; scopes override | Query-plan AST                    | SDK                                     |
| Better Auth        | `as const` statements per role   | One role must grant the whole request                                   | None                              | Role-only check                         |
| ZenStack           | `@@allow`/`@@deny` on the schema | Deny overrides, order-independent                                       | Filters injected into queries     | None                                    |
| LetMe (Elixir)     | Introspectable DSL               | Deny overrides                                                          | Hand-written scope                | `filter_allowed_actions`                |
| ASP.NET Core       | Requirements and handlers        | Requirements AND; a requirement's handlers OR; `Fail()` vetoes          | None                              | None                                    |

### Where they converge

- **Default deny, and deny overrides without regard to order**: Cedar, ZenStack, LetMe and
  AccessControl; Cerbos within one role. CASL and CanCanCan answer with the last matching rule
  by design, so a `cannot` written before a `can` does nothing.
- **Conditions are data**: CanCanCan's blocks cannot become SQL, Permix turns function rules
  into `false` when it serializes them, and Pundit and Laravel cannot send a rule anywhere.
- **The client receives decisions**: Oso returns allowed actions, Laravel shares booleans as
  props, LetMe filters allowed actions, and Casbin sends an action-to-object map without the
  policy. CASL ships each user's rules, and with them every condition value those rules carry.

### Where they diverge

- **A missing or erroring attribute.** In Rego an expression over an undefined value is
  undefined and `not` over it holds; Cedar skips a policy whose evaluation errors, so an erroring
  forbid does not apply; AccessControl documents `undefined != "dev"` holding. This ADR takes the
  fail-closed side through a strict expression dialect
  ([ADR-118](./ADR-118-expression-context-paths.md)).
- **Denies across roles.** With deny-overrides, a deny inside one role blocks everything every
  other held role grants, so the answer depends on the combination of roles. Cerbos scopes a deny
  to its own role. This ADR keeps roles additive and puts every deny in one reviewed list.

### Traps

| Trap                                                | Where                                                                     | Answer here                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| A type-level check passes on "some" record          | CASL, CanCanCan                                                           | An ability with a context requires one; claims need none  |
| An undefined ability silently denies                | Laravel, Casbin                                                           | Abilities come from a typed catalog                       |
| A superuser bypasses every refusal                  | Django `is_superuser`, Laravel `Gate::before`, Better Auth `adminUserIds` | An admin role is a grant guards still refuse              |
| A refusal reveals that a record exists              | CanCanCan loaders, blog drafts                                            | An ability or guard answers as not found                  |
| Hiding a tool and refusing it written separately    | `@sdxc/mcp`'s documented pattern                                          | One ability drives `available`, middleware and the client |
| A role's deny depends on which other roles are held | deny-overrides inside roles                                               | Roles only allow; denies are guards                       |
| Lookups during evaluation                           | py-abac attribute providers                                               | Facts load before evaluation; checks are synchronous      |

## Decision

Add `@sdxc/authz`, public, built from:

- a **catalog** of abilities, declared once and imported everywhere;
- a **policy** of additive roles, grants for everyone, guards that refuse, and named conditions,
  written in a strict `@sdxc/expression` dialect;
- **facts**, the data conditions read, declared by root and loaded lazily per invocation;
- **access**, a binding of roles and facts that answers checks synchronously with a `Decision`;
- **adapters** for the router, jobs, MCP, Durable Objects, flags and billing.

### Abilities

An ability is something a user does. The catalog declares each one with the context a check of
it passes, which can hold one record, several, or nothing:

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
		delete: ability({ context: context<{ article: Article }>("article") }),
	},
	team: {
		invite: ability({ context: context<{ team: Team; invitee: Invitee }>("team", "invitee") }),
	},
	apiKey: {
		create: ability({ context: context<{ requested: { scopes: string[] } }>("requested") }),
	},
	reports: { export: ability({ description: "Export usage reports as CSV" }) },
	agent: { connect: ability(), write: ability() },
});
```

- **Names** are keys dot-joined, as `@sdxc/jobs` names jobs: `article.update`. A group
  (`article`) names every ability under it, and `"*"` names them all.
- **`context<T>(...keys)`** types the check context and names its roots, every key of `T`
  exactly once, so compiling a policy knows which roots each ability supplies. `T` may be built
  from `interface`s with nested `Date`s. An ability without one is a claim, checked with no
  context: exporting reports, connecting an agent, seeing a menu.
- **`fields`** lists every field the ability covers, so a grant can narrow them and a handler can
  keep only the writable ones from a form.
- **`deniedAs`** is how a refusal answers when no guard says otherwise: `"forbidden"` by default,
  or `"notFound"` for abilities whose refusal must not reveal that the thing exists.
- **`description`** and **`metadata`** are optional and carried through introspection:
  `catalog.list()` and `catalog.filter({ metadata })` feed documentation and admin pages.

The catalog is declaration and nothing else, so importing it costs nothing, and handlers, jobs,
tools and hydrated components import the same module. It ships every ability name, and any
description, to the browser that imports it.

### Policy

```tsx
import { allow, definePolicy, deny, fact } from "@sdxc/authz";

import abilities from "./abilities";

export default definePolicy(abilities, {
	facts: {
		actor: fact<Actor>({ optional: true }),
		billing: fact<BillingFacts>(),
		flags: fact<{ reportsExport: boolean }>(),
	},
	conditions: {
		owner: {
			op: "all",
			of: [
				{ op: "exists", field: "actor" },
				{ op: "eq", field: "article.authorId", path: "actor.id" },
			],
		},
		otherOrg: {
			op: "all",
			of: [
				{ op: "exists", field: "actor" },
				{ op: "ne", field: "article.orgId", path: "actor.orgId" },
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
		editor: {
			inherits: ["member"],
			grants: [
				allow("article", { except: ["article.delete"] }),
				allow("article.delete", {
					when: { op: "not", of: { op: "eq", field: "article.locked", value: true } },
				}),
			],
		},
		admin: [allow("*")],
		"api:read": [allow(["article.read", "reports.export"])],
	},
	guards: [
		deny(["article.read", "article.update", "article.delete"], {
			id: "tenant",
			when: { op: "condition", name: "otherOrg" },
			reason: "other-tenant",
			as: "notFound",
		}),
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
```

- **Grants are JSON.** `allow` and `deny` are typed builders returning plain objects
  (`{ id?, effect, ability, except?, when?, fields?, reason?, as? }`), so a policy can be stored,
  diffed and validated. `ability` is a leaf, a group, `"*"` or a list of them; `except` removes
  abilities from a group grant.
- **Roles only allow.** A role is a list of grants, or `{ inherits, grants }`. Holding several
  roles is their union, so adding a role never removes anything.
- **`everyone`** allows whatever roles are held, including none, which is how guests are served.
- **`guards`** are the only denies, and they apply to every invocation: tenant isolation, plan
  gates, a suspended account, protecting an owner. A guard carries the `reason` a refusal reports
  and may override `as`. An admin role is a grant like any other, so guards refuse it too.
- **`conditions`** are the expression language's references, spelled `condition`, so "is the
  owner" is written once.
- **`facts`** declares every root conditions may read beyond the check context, with its type
  and whether it may be absent. An absent optional root is how a guest is bound.
- **`id`** gives a grant a stable name for decisions, logs, coverage and diffs. Without one a grant
  is named by position (`roles.editor.1`), which shifts when the list is edited.
- **Text form** is available for authoring through `@sdxc/expression`'s parser:
  `ctx.article.authorId == ctx.actor.id`. The stored form is JSON.

`definePolicy` compiles nothing at module scope. Compiling happens on first use, is memoized,
and fails with an `AuthzError` naming the role or guard, the grant and the expression path when:

- an `ability` or `except` names nothing in the catalog;
- `fields` names a field some covered ability does not declare;
- a condition names an unknown condition, cycles, or does not compile under the strict dialect;
- a condition reads a root that is neither a declared fact nor a context key every covered
  ability supplies, found through `language.paths()`;
- a condition reads an optional fact without testing it: after references resolve, it must be an
  `all` with `exists(ctx.<root>)` among its members;
- a role inherits a role that does not exist, or inheritance cycles;
- two grants share an `id`.

Adding an ability to a group can therefore stop a group grant from compiling, when the new
ability does not supply a root the grant's condition reads. That is the intended outcome: the
grant's author decides whether it covers the newcomer.

### Binding access

```typescript
let bound = policy.for({
	roles: ["member"],
	facts: {
		actor: { id: user.id, orgId: org.id },
		billing: () => loadBillingFacts(org),
		flags: () => loadFlagFacts(user),
	},
});
if (isFailure(bound)) return bound;

let access = bound.data;
await access.load(abilities.reports);
access.can(abilities.reports.export);
```

- `policy.for` returns `Result<Access, AuthzError>`, failing when the policy does not compile.
  A surface binds the fact roots its checks read and may leave others unbound: an unbound
  required root fails the conditions reading it, and an unbound optional root reads as absent.
- **Facts given as values** are available at once. Facts given as functions or promises load
  lazily: `access.load(...abilities)` resolves the roles, and the fact roots the grants covering
  those abilities read, at most once each. A check never waits; checking an ability whose roots
  have not loaded fails the conditions reading them, which refuses with cause `error`.
- **A failing fact source** binds its root as unavailable. Only conditions reading that root fail,
  so a billing outage refuses plan-gated abilities and nothing else, and `load` itself never
  rejects.
- **`roles`** may be a list or a function returning one, so an app can resolve them lazily.
- **`within`** names roles whose grants form a ceiling: an ability must be allowed by the held
  roles and by the `within` roles. A scoped token binds `within: ["api:read"]`, an auth-saas
  member binds the token's consented scopes, and the token can never do more than the person
  holding it.
- **`access.as({ roles, within?, facts? })`** derives a synchronous access for another scope,
  sharing what is loaded, so a page listing several teams decides per team with each team's role.

### Decisions

For one ability, one context and optionally one field, evaluated over the grants covering the
ability (its leaf, any group containing it, `"*"`, minus `except`):

1. **Guards.** If a guard's condition holds (for a field check: a guard without `fields`, or one
   listing the field), the answer is refused with cause `denied`, that guard's `reason`, and its
   `as`. If a guard's condition fails, the answer is refused with cause `error`.
2. **Grants.** If an allow from `everyone` or a held role holds (for a field check: one without
   `fields`, or one listing the field), the ability is granted. An allow whose condition fails
   does not match and is recorded. If none holds, the answer is refused with cause `error` when
   some allow failed, or `ungranted` otherwise.
3. **Ceiling.** With `within`, the same evaluation over the `within` roles' allows must also
   grant, or the answer is refused with cause `outOfScope` (`error` when a ceiling allow failed
   and none held).
4. Otherwise the answer is allowed, naming the grants that allowed it.

Every covering grant is evaluated, conditions combine in three-valued logic, and a failure never
grants, so the answer is the same whatever order grants were written or merged in. A refusal
answers as the matching guard's `as`, or else as the ability's `deniedAs`; when several guards
match, `notFound` wins so a refusal never reveals more than the strictest guard allows.

```typescript
type Decision =
	| { ability: string; allowed: true; grants: GrantId[] }
	| { ability: string; allowed: false; cause: "ungranted" | "outOfScope"; as: DeniedAs }
	| {
			ability: string;
			allowed: false;
			cause: "denied";
			as: DeniedAs;
			reason?: string;
			grants: GrantId[];
	  }
	| {
			ability: string;
			allowed: false;
			cause: "error";
			as: DeniedAs;
			errors: { grant: GrantId; error: ExpressionError }[];
	  };
```

`reason` is a stable code (`entitlement:reports`, `other-tenant`), so an app maps it to a
translated message, an upgrade page or a `WWW-Authenticate` challenge.

### Fields

- A check for a field holds when no guard refuses that field and an allow, and the ceiling, cover
  it.
- `permittedFields` is the fields covered by matching allows (all declared fields for an allow
  without `fields`), narrowed the same way by the ceiling, minus the fields of matching guards. It
  is empty when the ability is refused.
- For an ability that declares fields, a check without a field holds when `permittedFields` is
  not empty, so a handler that passed such a check still keeps only the permitted fields from its
  input. An ability without fields ignores every grant's `fields`; compiling refuses them there.

### Access

```typescript
access.can(abilities.reports.export); // claim
access.can(abilities.article.update, { article }); // boolean
access.can(abilities.article.update, { article }, "published"); // one field
access.check(abilities.article.update, { article }); // Decision
access.authorize(abilities.article.delete, { article }); // Result<void, Forbidden>
access.permittedFields(abilities.article.update, { article }); // ["title", "body"]
access.decide(abilities.article, { article, org }); // { create, read, update, delete }: booleans
access.claims(abilities.reports); // { export: false }
```

- Checks take catalog definitions, so the context is typed from the ability and a misspelled
  ability does not compile. The check context is merged over the facts; a key in both is a type
  error.
- `decide` answers every ability of a group for one context. Its context is every key the group's
  abilities need; each ability receives its own keys and claims receive none. A refusal of any
  cause, `error` included, answers `false`.
- `authorize` returns a `Forbidden` failure carrying the decision, for code mapping it to a
  response or an RPC result without throwing.

### Client

The server sends decisions, never grants. A page computes what its components need and passes it
as props:

```tsx
ctx.render(
	<ArticlePage
		article={article}
		can={access.decide(abilities.article, { article, org })}
		nav={access.claims(abilities.reports)}
	/>,
);
```

A hydrated component reads booleans typed as `Decisions<typeof abilities.article>`. Nothing about
the policy, its conditions or its facts reaches the browser, and every request the component makes
is checked again on the server. A list page decides per row, which is synchronous. No hydrated
component in the apps hides UI by permission today, so this serves server-rendered pages first.

### Router

```typescript
import { access, requireAbility } from "@sdxc/authz/middleware/router";

declare module "@sdxc/authz" {
	interface AuthzTypes {
		policy: typeof policy;
	}
}

const teamAccess = access(policy, {
	roles: (ctx) => [ctx.membership.role],
	facts: {
		actor: (ctx) => ({ id: ctx.auth.identity.id, orgId: ctx.team.id }),
		billing: fromEntitlements(),
		flags: fromFlags(features),
	},
	onDenied: (ctx, decision) => renderDenied(ctx, decision),
});

export default createAction(routes.teams.articles.update, {
	middleware: [
		requireUser,
		requireTeam,
		teamAccess,
		requireAbility(abilities.article.update, {
			context: async (ctx) => {
				let article = await loadArticle(ctx);
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

- **`access`** publishes `ctx.access` under an exported, explicitly typed context key, typed for
  the app through the `AuthzTypes` registration interface (as `@sdxc/jobs` types handlers through
  `JobTypes`). It can be installed at router, controller or action level; a later install replaces
  `ctx.access`, so the HTML pages, the API and the MCP endpoint each bind their own principal.
  Router-level middleware runs before routes match, so roles that depend on a route parameter
  (`:team`, `:tenantId`) bind at controller or action level, after the guard that resolves them.
  A router-level install loads nothing until a check needs it.
- **`requireAbility`** loads what the ability needs and decides before the handler runs, so a
  refused request is never validated or acted on. A `context` loader's result is published under
  the ability itself and read with `ctx.get(ability)`; a loader returning `null` answers exactly
  like a `notFound` refusal, so a missing record and a hidden one look the same. A check whose
  context comes from the body runs in the handler after validation, with `ctx.access.authorize`.
- **Answers** come from `onDenied(ctx, decision)`: the app-wide responder on `access`, overridden
  per `requireAbility`. That is where an app renders its own not-found page (a bare 404 that
  differs from the real one would reveal what `notFound` hides), answers `@sdxc/problem` JSON on
  an API, sends a 402 for `entitlement:*`, or adds `WWW-Authenticate: insufficient_scope` for
  `outOfScope`. Without one it answers `forbidden()` or `notFound()` from
  `@sdxc/http/response/html`.
- **Authentication stays separate.** `requireAbility` never authenticates; a route that requires a
  signed-in user installs `requireUser` or `requireAuth()` before it.
- **Logging** follows the wide event: the adapter sets the decision's ability, cause and grant ids
  on `ctx.log`, notes each refusal, and records a cause `error` refusal as a failure.
- Global `formData()` has already parsed a request body by the time route middleware runs, so a
  route accepting uploads stores them from its handler, after the decision.

### Durable Objects and RPC

A Durable Object that every path reaches is the boundary that enforces, so it binds access itself
from its own state:

```typescript
let bound = policy.for({
	roles: [leasedTier(this.settings, Date.now())],
	facts: { flags: fromFlags(features, { client: flagsFor(this.subject) }) },
});
```

RPC methods answer with the decision itself, as plain data: RPC structured-clones what it
returns, so an `Error` subclass like `Forbidden` would arrive without its fields. The Worker that
called maps the decision's cause and reason to a response, and an RPC like reader's
`entitlement()` returns `access.claims(...)` over its plan abilities for server-rendered pages.

### Jobs

```typescript
import { authz } from "@sdxc/authz/middleware/dispatcher";

const dispatcher = createJobDispatcher({
	middleware: [
		database(),
		featureFlags(flags),
		authz(policy, { facts: { flags: fromFlags(features) } }),
	],
	queue,
});

export default createJobHandler(jobs.exportReport, async (ctx) => {
	let member = await Membership.find(ctx.database, ctx.input.teamId, ctx.input.actorId);
	let bound = ctx.authz.for({
		roles: member ? [member.role] : [],
		facts: {
			actor: member ? { id: member.subjectId, orgId: member.teamId } : undefined,
			billing: () => billingFactsOf(ctx.database, ctx.input.teamId),
		},
	});
	if (isFailure(bound)) ctx.exit("authz policy does not compile", { cause: bound.error });

	let access = bound.data;
	await access.load(abilities.reports);
	let decision = access.check(abilities.reports.export);
	if (decision.allowed) return exportReport(ctx.input);

	ctx.log.set({ authz: { ability: decision.ability, cause: decision.cause } });
	if (decision.cause === "error")
		ctx.exit("reports.export undecidable", { cause: decision.errors });
	ctx.ack();
});
```

The dispatcher middleware publishes `ctx.authz`, a binder with the shared fact sources applied;
the handler binds the subject from its own payload, since a dispatcher middleware sees no typed
input. A job acting for a person carries the actor's id and re-reads that actor's roles when it
runs, never the authority of whoever owns the team. A refusal ends the run with `ctx.ack()` after
recording why on the log; an undecidable one ends with `ctx.exit()`, reported as a failure.

### MCP

```typescript
import { guard, requireToolAbility } from "@sdxc/authz/mcp";

mcp.tools.map(toolset.articles.create, { ...guard(abilities.agent.write), handler });
mcp.tools.map(toolset.articles.update, {
	...guard(abilities.agent.write),
	middleware: [
		requireToolAbility(abilities.article.update, {
			context: async (ctx) => {
				let article = await loadArticle(ctx.input.id);
				return article ? { article } : null;
			},
		}),
	],
	handler,
});
```

- `guard(ability)` returns `available` for a claim. `@sdxc/mcp` checks it on `tools/list` and
  again on `tools/call`, so one ability hides the tool and refuses it.
- `requireToolAbility` is a tool middleware for a check that needs arguments, running after they
  validate; a `notFound` refusal answers as the tool's own "no such" error and a `forbidden` one
  as `ForbiddenError`.
- `available` is synchronous, so the MCP route's `access` lists what to load before the handler
  runs: `access(policy, { …, load: [abilities.agent] })`.
- On a credential surface, roles come from the credential: `roles` is the owner's tier or role and
  `within` the token's scope. A session's roles are never unioned with a token's, since a union
  would widen a read-only token.

### Flags as facts

```typescript
fromFlags(features, { client?, context?, onError? })
```

- Facts are keyed by the catalog's property names (`newCheckout`), which conditions read as
  `flags.newCheckout`; a property name containing `.` is refused.
- Only the properties the policy's conditions read are evaluated, found through
  `language.paths()`, so a split flag nobody's rule reads records no exposure.
- `client` defaults to the invocation's client from `@sdxc/flags/middleware`, for requests and
  jobs alike, so `featureFlags` is installed before `access`. A Durable Object passes its own.
- `context` overrides the evaluation context, for a flag whose subject is the team rather than the
  viewer.
- `onError: "default"` (the default) binds the value the client answered, as every other read in
  the request sees it; `"missing"` omits a flag that errored, so a rule reading it refuses. A
  guard reading a flag whose default is the permissive value uses `"missing"`.
- Evaluation goes through `@sdxc/flags`, never the engine's synchronous path, which would bypass
  hooks and wrapper providers.

Targeting rules and authorization conditions share the operator vocabulary and JSON shape. They
differ in reference spelling (`segment` and `condition`), extension operators (`semver` is a flag
operator) and strictness, so a segment is not a condition. A policy that needs a segment reads a
boolean flag targeted with it.

### Billing as facts

`@sdxc/billing` keeps its entitlement reader private and publishes the snapshot only after
`requireEntitlement` passes, so it gains a memoized `readEntitlements(ctx)` that runs the
configured reader at most once per request, caches `null` too, and answers a `Result`;
`requireEntitlement` uses it, so a guard and a policy share one read.

```typescript
fromEntitlements(); // the billing middleware's reader, through readEntitlements(ctx)
fromEntitlements((ctx) => snapshotOf(ctx)); // any loader answering EntitlementSnapshot | null
```

`fromEntitlements` supplies `{ products: string[]; features: string[] }`, where `features` lists
the snapshot's features that are `true`, and a `null` snapshot is two empty lists, so
`includes(ctx.billing.features, "reports")` answers `false` for a free account and never fails.

A plan gate is a guard with a reason, never an allow on a "paid" role: it applies whatever role is
held, and its reason tells `onDenied` which upgrade to offer. An app keeping its own projection
writes its own fact source or role instead: reader's tier, with grace periods and manual grants, is
the role it binds; uptime's owner subscription state is a `billing.state` fact, and its guard
refuses only `inactive`, keeping today's behavior of serving an `unknown` state.

### Time and impersonation

- **Time** is a fact. A policy comparing against the clock declares `now` (epoch milliseconds),
  production binds `Date.now()` and a test binds a fixed value, so decisions stay deterministic.
  A rule as involved as blog's "published" (a `null` date counts as published) is projected by
  the app into a boolean fact or context field.
- **Impersonation** binds the person acting as `actor` and the administrator as an optional
  `impersonator` fact; a guard such as `deny("billing", { when: exists(ctx.impersonator) })` keeps
  sensitive abilities out of an impersonated session, and the log records both.

### Testing

```typescript
import { testAccess } from "@sdxc/authz/testing";

test("members edit their own articles", () => {
	let access = testAccess(policy, {
		roles: ["member"],
		facts: {
			actor: { id: "u1", orgId: "o1" },
			billing: { products: [], features: [] },
			flags: { reportsExport: true },
		},
	});
	let own = { id: "a1", authorId: "u1", orgId: "o1", published: false, locked: false };

	expect(access.can(abilities.article.update, { article: own })).toBe(true);
	expect(access.can(abilities.article.update, { article: { ...own, authorId: "u2" } })).toBe(false);
	expect(access.check(abilities.article.read, { article: { ...own, orgId: "o2" } })).toMatchObject({
		cause: "denied",
		as: "notFound",
	});
});

test("guests read published articles", () => {
	let access = testAccess(policy, {
		roles: [],
		facts: { billing: { products: [], features: [] }, flags: { reportsExport: true } },
	});
	let article = { id: "a2", authorId: "u2", orgId: "o2", published: true, locked: false };

	expect(access.can(abilities.article.read, { article })).toBe(true);
	expect(access.can(abilities.article.update, { article })).toBe(false);
});
```

- `testAccess` binds synchronously; a required root a test leaves unbound fails the conditions
  reading it, so a case that forgot a fact refuses visibly instead of passing.
- `policy.coverage(decisions)` reports grants no recorded decision matched.
- `diffPolicies(before, after, cases)` reports every decision two policies answer differently,
  matching grants by `id`, for reviewing a policy change.
- Compiling the policy in a test catches an unknown ability, field, condition, role or fact.
- A test asserting that every tier role exists in the app's numeric limits keeps the two tables
  keyed by the same names.

### Out of scope

- **Numeric limits and quotas.** Counts (feeds, saved posts, API keys), budgets and rate limits
  stay app data keyed by the same role names; a refusal there carries the counts a decision does
  not.
- **Database filtering.** List pages filter with their own queries and decide per row. Partial
  evaluation of conditions into a `remix/data-table` `where` clause fits the model (facts known,
  record paths unknown) and can follow.
- **Rule snapshots on the client.** Decisions cover what components need without disclosing the
  policy.
- **Policies edited at runtime.** A policy is JSON, so it can be stored and compiled; the package
  ships no storage. A stored policy naming an ability the catalog dropped fails to compile, and
  the app keeps serving the last policy that compiled.
- **Tenant-defined vocabularies.** auth-saas's custom roles and permissions are product data that
  tenants invent, outside a typed catalog.
- **Relationship graphs.** An app materializes the relationships a check needs (team ids,
  ancestor ids) as facts; a deep sharing graph belongs to a dedicated ReBAC service.

## Usage Examples

The examples follow one team app through every surface: teams that own monitors, members holding
a role per team, API keys holding scopes, a public status page, a plan gate, a kill-switch flag,
an MCP endpoint and jobs. Its existing middleware (`requireUser`, `requireTeam`, `requireApiKey`,
`getViewer()`, `apiProblems`) keeps doing what it does today. The Durable Object example is
reader's, whose checks live in each user's object.

### Declaring the catalog

`app/authz/abilities.ts` is imported by handlers, jobs, tools and hydrated components alike:

```typescript
import { abilities, ability, context } from "@sdxc/authz";

import type { Membership, Monitor, StatusPage, Team } from "~/database/schema";

export default abilities({
	team: {
		update: ability({
			context: context<{ team: Team }>("team"),
			fields: ["name", "slug", "timezone"],
		}),
		delete: ability({ context: context<{ team: Team }>("team") }),
		billing: ability({ context: context<{ team: Team }>("team") }),
	},
	member: {
		invite: ability({ context: context<{ team: Team }>("team") }),
		remove: ability({ context: context<{ team: Team; member: Membership }>("team", "member") }),
	},
	monitor: {
		create: ability({ context: context<{ team: Team }>("team") }),
		read: ability({ context: context<{ monitor: Monitor }>("monitor"), deniedAs: "notFound" }),
		update: ability({
			context: context<{ monitor: Monitor }>("monitor"),
			deniedAs: "notFound",
			fields: ["name", "url", "intervalSeconds", "enabled"],
		}),
		delete: ability({ context: context<{ monitor: Monitor }>("monitor"), deniedAs: "notFound" }),
		run: ability({ context: context<{ monitor: Monitor }>("monitor") }),
	},
	statusPage: {
		view: ability({
			context: context<{ statusPage: StatusPage }>("statusPage"),
			deniedAs: "notFound",
		}),
	},
	apiKey: {
		create: ability({ context: context<{ requested: { scopes: string[] } }>("requested") }),
	},
	reports: {
		export: ability({ description: "Download a team's usage report as CSV" }),
	},
	agent: {
		read: ability(),
		write: ability(),
	},
});
```

### Writing the policy

`app/authz/policy.ts` holds every role, every refusal and the facts they read:

```typescript
import { allow, definePolicy, deny, fact } from "@sdxc/authz";

import abilities from "~/app/authz/abilities";

export default definePolicy(abilities, {
	facts: {
		actor: fact<{ id: string; teamId: string; scopes: string[] }>({ optional: true }),
		billing: fact<{ state: "active" | "inactive" | "unknown" }>(),
		flags: fact<{ adhocPing: boolean }>(),
	},
	conditions: {
		sameTeam: {
			op: "all",
			of: [
				{ op: "exists", field: "actor" },
				{ op: "eq", field: "monitor.teamId", path: "actor.teamId" },
			],
		},
	},
	everyone: [
		allow("statusPage.view", { when: { op: "eq", field: "statusPage.isPublic", value: true } }),
	],
	roles: {
		member: [
			allow(["monitor", "reports.export", "agent"]),
			allow("statusPage.view", {
				when: {
					op: "all",
					of: [
						{ op: "exists", field: "actor" },
						{ op: "eq", field: "statusPage.teamId", path: "actor.teamId" },
					],
				},
			}),
		],
		admin: {
			inherits: ["member"],
			grants: [
				allow(["team.update", "member"]),
				allow("apiKey.create", {
					when: { op: "subsetOf", field: "requested.scopes", path: "actor.scopes" },
				}),
			],
		},
		owner: { inherits: ["admin"], grants: [allow(["team.delete", "team.billing"])] },
		"monitors:read": [allow("monitor.read")],
		"monitors:write": [
			allow(["monitor.create", "monitor.update", "monitor.delete", "monitor.run"]),
		],
		"keys:write": [
			allow("apiKey.create", {
				when: { op: "subsetOf", field: "requested.scopes", path: "actor.scopes" },
			}),
		],
		"agent:read": [allow(["agent.read", "monitor.read"])],
		"agent:write": [allow(["agent", "monitor"])],
	},
	guards: [
		deny(["monitor.read", "monitor.update", "monitor.delete", "monitor.run"], {
			id: "other-team",
			when: {
				op: "all",
				of: [
					{ op: "exists", field: "actor" },
					{ op: "not", of: { op: "condition", name: "sameTeam" } },
				],
			},
			reason: "other-team",
			as: "notFound",
		}),
		deny("member.remove", {
			id: "owner-protected",
			when: { op: "eq", field: "member.subjectId", path: "team.ownerId" },
			reason: "owner-protected",
		}),
		deny(["monitor.create", "monitor.run"], {
			id: "subscription",
			when: { op: "eq", field: "billing.state", value: "inactive" },
			reason: "subscription-required",
		}),
		deny("monitor.run", {
			id: "adhoc-ping-switch",
			when: { op: "eq", field: "flags.adhocPing", value: false },
			reason: "switched-off",
		}),
	],
});
```

- Members manage monitors; admins add the team and its people; owners add deletion and billing.
- API-key scopes are roles of their own (`monitors:read`), bound on the API in place of the
  member's role, so a key holds exactly its scopes.
- A team's billing state gates creating and running monitors whatever the role; `unknown` is
  served, as today.
- `app/authz/types.ts` registers the policy once, which types `ctx.access` everywhere:

```typescript
import type policy from "~/app/authz/policy";

declare module "@sdxc/authz" {
	interface AuthzTypes {
		policy: typeof policy;
	}
}
```

### Binding access for team pages

`app/http/middleware/team-access.ts` binds the member's role in the team the route names, so it
runs after `requireTeam`:

```typescript
import { fromFlags } from "@sdxc/authz/facts/flags";
import { access } from "@sdxc/authz/middleware/router";

import policy from "~/app/authz/policy";
import Subscription from "~/app/data/subscription";
import { features } from "~/app/flags";
import { renderDenied } from "~/app/http/denied";
import { getViewer } from "~/app/http/middleware/auth";
import { ALL_SCOPES } from "~/app/services/api-key";

export const teamAccess = access(policy, {
	roles: (ctx) => [ctx.membership.role],
	facts: {
		actor: (ctx) => ({ id: getViewer()!.id, teamId: ctx.team.id, scopes: ALL_SCOPES }),
		billing: async (ctx) => ({ state: await Subscription.stateOf(ctx.db, ctx.team.owner_id) }),
		flags: fromFlags(features, { context: (ctx) => ({ targetingKey: ctx.team.id }) }),
	},
	onDenied: renderDenied,
});
```

```typescript
router.map(
	routes.app.team.monitors,
	createController(routes.app.team.monitors, {
		middleware: [requireUser, requireTeam, teamAccess],
		actions: {
			index: lazy(() => import("~/app/http/controllers/monitors/index")),
			update: lazy(() => import("~/app/http/controllers/monitors/update")),
			run: lazy(() => import("~/app/http/controllers/monitors/run")),
		},
	}),
);
```

`renderDenied` is the one place that turns a decision into a page:

```tsx
export function renderDenied(ctx: RequestContext, decision: Decision) {
	if (decision.as === "notFound") return ctx.render(<NotFoundPage />, { status: 404 });
	if (decision.reason === "subscription-required")
		return redirect(routes.app.team.billing.href({ team: ctx.team.slug }));
	if (decision.reason === "switched-off") return ctx.render(<UnavailablePage />, { status: 503 });
	return ctx.render(<ForbiddenPage reason={decision.reason} />, { status: 403 });
}
```

### A page showing what the user can do

The monitors index decides per row and hands booleans to the view and to the one hydrated row
control:

```tsx
export default createAction(routes.app.team.monitors.index, {
	async handler(ctx) {
		await ctx.access.load(abilities.monitor, abilities.member);

		let monitors = await Monitor.listByTeam(ctx.db, ctx.team.id);
		let rows = monitors.map((monitor) => ({
			monitor,
			can: ctx.access.decide(abilities.monitor, { monitor, team: ctx.team }),
		}));

		return ctx.render(
			<MonitorsPage
				team={ctx.team}
				rows={rows}
				canCreate={ctx.access.can(abilities.monitor.create, { team: ctx.team })}
				canInvite={ctx.access.can(abilities.member.invite, { team: ctx.team })}
			/>,
		);
	},
});
```

```tsx
export interface RunButtonProps {
	monitorId: string;
	can: Decisions<typeof abilities.monitor>;
}

export const RunButton = clientEntry(
	"/resources/components/run-button.tsx#RunButton",
	function RunButton(handle: Handle<RunButtonProps>) {
		return () => (handle.props.can.run ? <button type="submit">Run now</button> : null);
	},
);
```

The component receives `{ read, update, delete, run, create }` booleans; nothing about the
policy, the billing state or the flag reaches the browser.

### A form action on a loaded record

`requireAbility` loads the monitor, decides before the handler runs, and publishes what it
loaded. The handler validates and keeps only the fields the user may write:

```tsx
export default createAction(routes.app.team.monitors.update, {
	middleware: [
		requireAbility(abilities.monitor.update, {
			async context(ctx) {
				let monitor = await Monitor.findByIdForTeam(ctx.db, ctx.params.monitor, ctx.team.id);
				return monitor ? { monitor } : null;
			},
		}),
	],
	async handler(ctx) {
		let { monitor } = ctx.get(abilities.monitor.update);

		let result = await validate(ctx.formData, UpdateMonitorSchema);
		if (isFailure(result))
			return ctx.render(<EditMonitorPage monitor={monitor} errors={result.error} />, {
				status: 400,
			});

		let fields = ctx.access.permittedFields(abilities.monitor.update, { monitor });
		await Monitor.update(ctx.db, monitor.id, pick(result.data, fields));

		return redirect(
			routes.app.team.monitors.show.href({ team: ctx.team.slug, monitor: monitor.id }),
			{
				status: redirect.Status.SeeOther,
			},
		);
	},
});
```

A monitor that does not exist and one belonging to another team both answer through
`renderDenied` as the same not-found page.

### A check on what the body says

Removing a member names the member in the form, so the decision follows validation:

```typescript
export default createAction(routes.teamAdminActions.member.remove, {
	async handler(ctx) {
		let result = await validate(ctx.formData, RemoveMemberSchema);
		if (isFailure(result)) return badRequest("Pick a member to remove.");

		let member = await Team.findMembership(ctx.db, ctx.team.id, result.data.subject_id);
		if (!member) return notFound("Not Found");

		await ctx.access.load(abilities.member);
		let allowed = ctx.access.authorize(abilities.member.remove, { team: ctx.team, member });
		if (isFailure(allowed)) {
			if (allowed.error.decision.reason === "owner-protected")
				return badRequest("The team owner can't be removed.");
			return renderDenied(ctx, allowed.error.decision);
		}

		await Team.removeMembership(ctx.db, ctx.team.id, member.subject_id);
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	},
});
```

### A gate behind a plan or a flag

Running a monitor on demand passes the role, the billing guard and the kill switch in one check;
`renderDenied` already answers each refusal its own way:

```typescript
export default createAction(routes.app.team.monitors.run, {
	middleware: [
		requireAbility(abilities.monitor.run, {
			async context(ctx) {
				let monitor = await Monitor.findByIdForTeam(ctx.db, ctx.params.monitor, ctx.team.id);
				return monitor ? { monitor } : null;
			},
		}),
	],
	async handler(ctx) {
		let { monitor } = ctx.get(abilities.monitor.run);
		await ctx.jobs.enqueue(jobs.checkHttp, { monitorId: monitor.id });
		return redirect(
			routes.app.team.monitors.show.href({ team: ctx.team.slug, monitor: monitor.id }),
			{
				status: redirect.Status.SeeOther,
			},
		);
	},
});
```

### The JSON API

The API binds the key, not a person: its scopes are its roles, and refusals answer as problem
documents with the challenge clients already read:

```typescript
export const apiAccess = access(policy, {
	roles: (ctx) => ctx.apiKey.scopes,
	facts: {
		actor: (ctx) => ({ id: ctx.apiKey.id, teamId: ctx.apiTeam.id, scopes: ctx.apiKey.scopes }),
		billing: async (ctx) => ({ state: await Subscription.stateOf(ctx.db, ctx.apiTeam.owner_id) }),
		flags: fromFlags(features, {
			context: (ctx) => ({ targetingKey: ctx.apiTeam.id }),
			onError: "missing",
		}),
	},
	onDenied(ctx, decision) {
		if (decision.as === "notFound") return apiProblems.notFound({ instance: problemInstance() });
		if (decision.reason === "subscription-required")
			return apiProblems.subscriptionRequired({ instance: problemInstance() });
		if (decision.reason === "switched-off")
			return apiProblems.endpointUnavailable({ instance: problemInstance() });
		return apiProblems.forbidden(
			{ detail: `This key may not ${decision.ability}`, instance: problemInstance() },
			{
				headers: {
					"WWW-Authenticate": apiChallenge(ctx.url.origin, { error: "insufficient_scope" }),
				},
			},
		);
	},
});

export default createController(monitorsRoutes, {
	middleware: [requireApiKey(), apiAccess],
	actions: {
		monitorsCreate: {
			middleware: [
				requireAbility(abilities.monitor.create, { context: (ctx) => ({ team: ctx.apiTeam }) }),
				idempotent,
			],
			handler: createMonitor,
		},
		monitorsDelete: {
			middleware: [
				requireAbility(abilities.monitor.delete, {
					async context(ctx) {
						let id = decodeIdOrUUID("mon", ctx.params.id);
						let monitor = id ? await Monitor.findByIdForTeam(ctx.db, id, ctx.apiTeam.id) : null;
						return monitor ? { monitor } : null;
					},
				}),
			],
			handler: deleteMonitor,
		},
	},
});
```

`requireApiKey()` keeps authenticating the key and answering `401`; the scope it took per route is
now the ability's grant, and its `403` with the `insufficient_scope` challenge now comes from
`onDenied`. Minting a key checks the requested scopes after validating the
body, with `ctx.access.authorize(abilities.apiKey.create, { requested })`, and the `subsetOf`
grant refuses a key asking for more than its minter holds.

### Several teams on one page

The account page lists every team the user belongs to, each with its own role:

```tsx
export default createAction(routes.account, {
	middleware: [requireUser, userAccess],
	async handler(ctx) {
		let memberships = await Team.listMembershipsBySubjectId(ctx.db, getViewer()!.id);

		let teams = memberships.map(({ team, role }) => {
			let inTeam = ctx.access.as({
				roles: [role],
				facts: { actor: { id: getViewer()!.id, teamId: team.id, scopes: [] } },
			});
			return {
				team,
				canDelete: inTeam.can(abilities.team.delete, { team }),
				canBill: inTeam.can(abilities.team.billing, { team }),
			};
		});

		return ctx.render(<AccountPage teams={teams} />);
	},
});
```

`userAccess` is `access(policy, { roles: [] })`: the account page holds no team role of its own,
and `as` binds one per team. Neither binds `billing` or `flags`, because no check here reads them.

### MCP tools

The MCP route binds the person behind the token, capped by the token's scope, and loads the
claims `tools/list` reads before the protocol handler runs:

```typescript
router.map(routes.mcp, {
	actions: {
		index: lazy(() => import("~/app/http/controllers/mcp")),
		action: {
			middleware: [
				requireAgent,
				agentRateLimit(env),
				access(policy, {
					roles: (ctx) => [agentOf(ctx).role],
					within: (ctx) => [`agent:${agentOf(ctx).scope}`],
					facts: {
						actor: (ctx) => ({
							id: agentOf(ctx).subjectId,
							teamId: agentOf(ctx).teamId,
							scopes: [],
						}),
						billing: async (ctx) => ({
							state: await Subscription.stateOfTeam(ctx.db, agentOf(ctx).teamId),
						}),
						flags: fromFlags(features),
					},
					load: [abilities.agent],
				}),
			],
			handler: async (ctx) => (await import("./mcp")).default.fetch(ctx),
		},
	},
});
```

```typescript
import { guard, requireToolAbility } from "@sdxc/authz/mcp";

export default createToolController(toolset.monitors, {
	actions: {
		list: { ...guard(abilities.agent.read), handler: listMonitors },
		run: {
			...guard(abilities.agent.write),
			middleware: [
				requireToolAbility(abilities.monitor.run, {
					async context(ctx) {
						let monitor = await findTeamMonitor(agentOf(ctx).teamId, ctx.input.monitorId);
						return monitor ? { monitor } : null;
					},
				}),
			],
			handler: runMonitor,
		},
	},
});
```

- The agent identity carries the person's role in the token's team, so the token holds what the
  person holds, capped by `within` at what its scope allows.
- A read-scoped token never sees `run` in `tools/list`, and `@sdxc/mcp` refuses a call to it from
  a stale list.
- A write-scoped token whose team stopped paying sees the tool; the call is refused by the
  subscription guard, reported as a `ForbiddenError` carrying `subscription-required`.

### A job that skips work

The dispatcher shares the fact sources every job uses; a handler binds the subject from its own
payload and skips what the subject may not do:

```typescript
const dispatcher = createJobDispatcher({
	logger,
	queue: jobQueue,
	middleware: [
		database(),
		featureFlags(flags, { context: (ctx) => ({ targetingKey: ctx.name }) }),
		authz(policy, { facts: { flags: fromFlags(features) } }),
	],
});
```

```typescript
export default createJobHandler(jobs.exportReport, async (ctx) => {
	let team = await Team.findById(ctx.database, ctx.input.teamId);
	if (!team) ctx.ack();

	let membership = await Team.findMembership(ctx.database, team.id, ctx.input.actorId);

	let bound = ctx.authz.for({
		roles: membership ? [membership.role] : [],
		facts: {
			actor: membership ? { id: membership.subject_id, teamId: team.id, scopes: [] } : undefined,
			billing: async () => ({ state: await Subscription.stateOf(ctx.database, team.owner_id) }),
		},
	});
	if (isFailure(bound)) ctx.exit("authz policy does not compile", { cause: bound.error });

	let access = bound.data;
	await access.load(abilities.reports);
	let decision = access.check(abilities.reports.export);

	if (!decision.allowed) {
		ctx.log.set({ authz: { ability: decision.ability, cause: decision.cause } });
		if (decision.cause === "error")
			ctx.exit("reports.export undecidable", { cause: decision.errors });
		ctx.ack();
	}

	await exportReport(ctx.database, team);
});
```

The job runs with the authority of the member who asked, re-read when it runs: a member removed
from the team between enqueue and run is refused, and the run ends as acked with the refusal on
its record.

### Inside a Durable Object

reader's per-user object is what every path reaches (pages, MCP tools, imports, alarms), so it
binds access from its own row and every write it guards checks there:

```typescript
export class UserDO extends DurableObject {
	async #access(): Promise<Result<Access, AuthzError>> {
		let row = await this.#settingsRow();
		let bound = readerPolicy.for({
			roles: [leasedTier(row, Date.now())],
			facts: { flags: fromFlags(features, { client: flagsFor(this.#subject) }) },
		});
		if (isSuccess(bound)) await bound.data.load(readerAbilities.tags, readerAbilities.plan);
		return bound;
	}

	async createTag(name: string): Promise<UserStore.TagResult> {
		let access = await this.#access();
		if (isFailure(access)) return { ok: false, reason: "undecidable" };

		let decision = access.data.check(readerAbilities.tags.create);
		if (!decision.allowed) return { ok: false, reason: "not-allowed", decision };
		// …
	}

	async entitlement(): Promise<Decisions<typeof readerAbilities.plan>> {
		let access = await this.#access();
		return isSuccess(access) ? access.data.claims(readerAbilities.plan) : NO_CLAIMS;
	}
}
```

The object answers with the decision itself, which is plain data: RPC structured-clones what it
returns, so an `Error` subclass would arrive without its fields. The Worker maps the decision's
reason to a page:

```typescript
let created = await userStore(viewer.id).createTag(submitted[NAME_FIELD]);
if (!created.ok && created.reason === "not-allowed") {
	let query = new URLSearchParams({ [TAG_PARAM]: created.decision.reason ?? "not-entitled" });
	return redirect(`${routes.saved.href()}?${query}`, { status: redirect.Status.SeeOther });
}
```

### Testing the policy

```typescript
import { testAccess } from "@sdxc/authz/testing";

import abilities from "~/app/authz/abilities";
import policy from "~/app/authz/policy";
import { monitorRow, statusPageRow, teamRow } from "~/test/fixtures";

const FACTS = { billing: { state: "active" as const }, flags: { adhocPing: true } };
const TEAM = teamRow({ id: "t1", ownerId: "u1" });
const MONITOR = monitorRow({ id: "m1", teamId: "t1" });

function asRole(role: string, facts = FACTS) {
	return testAccess(policy, {
		roles: [role],
		facts: { ...facts, actor: { id: "u2", teamId: "t1", scopes: [] } },
	});
}

test("roles add up", () => {
	expect(asRole("member").can(abilities.monitor.update, { monitor: MONITOR })).toBe(true);
	expect(asRole("member").can(abilities.member.invite, { team: TEAM })).toBe(false);
	expect(asRole("admin").can(abilities.member.invite, { team: TEAM })).toBe(true);
	expect(asRole("admin").can(abilities.team.delete, { team: TEAM })).toBe(false);
	expect(asRole("owner").can(abilities.team.delete, { team: TEAM })).toBe(true);
});

test("another team's monitor is not found, even for an owner", () => {
	let monitor = monitorRow({ id: "m9", teamId: "t2" });

	expect(asRole("owner").check(abilities.monitor.update, { monitor })).toMatchObject({
		allowed: false,
		cause: "denied",
		as: "notFound",
		reason: "other-team",
	});
});

test("an inactive subscription stops running monitors but not reading them", () => {
	let owner = asRole("owner", { ...FACTS, billing: { state: "inactive" } });

	expect(owner.check(abilities.monitor.run, { monitor: MONITOR })).toMatchObject({
		reason: "subscription-required",
	});
	expect(owner.can(abilities.monitor.read, { monitor: MONITOR })).toBe(true);
});

test("guests see public status pages only", () => {
	let guest = testAccess(policy, { roles: [], facts: FACTS });

	expect(
		guest.can(abilities.statusPage.view, {
			statusPage: statusPageRow({ teamId: "t1", isPublic: true }),
		}),
	).toBe(true);
	expect(
		guest.can(abilities.statusPage.view, {
			statusPage: statusPageRow({ teamId: "t1", isPublic: false }),
		}),
	).toBe(false);
});

test("a key cannot mint a key with more scopes than it holds", () => {
	let key = testAccess(policy, {
		roles: ["keys:write"],
		facts: { ...FACTS, actor: { id: "k1", teamId: "t1", scopes: ["keys:write", "monitors:read"] } },
	});

	expect(key.can(abilities.apiKey.create, { requested: { scopes: ["monitors:read"] } })).toBe(true);
	expect(key.can(abilities.apiKey.create, { requested: { scopes: ["monitors:write"] } })).toBe(
		false,
	);
});
```

A change to the policy is reviewed with `diffPolicies(previous, policy, cases)`, which lists every
case whose answer changed, and `policy.coverage(decisions)` over a suite's recorded decisions
names any grant no test reached.

## Consequences

### Positive

- **One model across apps and runtimes**: route handlers, jobs, MCP tools, Durable Objects and
  server-rendered pages ask the same question of the same policy.
- **Additive roles, one list of refusals**: holding another role never removes anything, and every
  refusal is a reviewed guard with a reason.
- **Fail-closed and order-independent**: incomplete or mistyped facts refuse instead of granting,
  and no ordering of grants or roles changes an answer.
- **Delegation is bounded**: `within` and `subsetOf` keep tokens and minted credentials inside
  the authority of whoever holds or mints them.
- **Nothing sensitive reaches the client**: components receive booleans.
- **Lazy facts**: a request loads only the facts its checks read.

### Negative

- **Depends on ADR-118** and on a change to `@sdxc/billing`.
- **Lists are written twice**: a list query and the per-row decision restate the same condition
  until database filtering exists.
- **Loading is explicit**: a page checking abilities outside `requireAbility` awaits
  `access.load(...)` first, or its checks refuse with cause `error`.
- **Strict facts need typed data**: D1 booleans arrive as `0` and `1` and are mapped before a
  strict comparison against `true`.
- **Several optional peers**: the adapters reach five other packages.

### Neutral

- **Contexts are plain objects**: a check context is a row or a projection, `interface`s and
  `Date`s included.

## Implementation Plan

### Phase 1: Expression changes

**Priority:** High
**Estimated Effort:** 10 hours

Implement [ADR-118](./ADR-118-expression-context-paths.md).

### Phase 2: Billing reader

**Priority:** High
**Estimated Effort:** 1 hour

Export `readEntitlements(ctx)` from `@sdxc/billing/middleware`, switch `requireEntitlement` to
it, update the README; its own commit.

### Phase 3: Core

**Priority:** High
**Estimated Effort:** 10 hours

1. `abilities`, `ability`, `context`, introspection, `allow`, `deny`, `fact`, `definePolicy`,
   compile with every rule above, `policy.for`, lazy loading, `within`, `as`, `Access`,
   `Decision`, `AuthzError`, `Forbidden`.
2. Tests for each decision rule, guards over admin, guests through optional facts, ceilings,
   failures that refuse and failures that do not, field checks, `decide`, `claims`, and every
   compile failure.
3. `expectTypeOf` tests for ability names in grants, check contexts, fact types and decision maps.

### Phase 4: Testing helpers

**Priority:** High
**Estimated Effort:** 2 hours

`testAccess`, `policy.coverage` and `diffPolicies`.

### Phase 5: Adapters

**Priority:** High
**Estimated Effort:** 8 hours

Router `access` and `requireAbility`, dispatcher `authz`, MCP `guard` and `requireToolAbility`,
`fromFlags` and `fromEntitlements`, each with tests against the package it integrates.

### Phase 6: First consumers

**Priority:** Medium
**Estimated Effort:** 8 hours

1. **r3-auth**: roles from the subject's `role`, the admin pages behind `requireAbility`, session
   revocation answering as not found, and a guard protecting the provider's own client.
2. **reader**: bind access inside `UserDO` with the tier `leasedTier` derives as the role; replace
   `limitsOf(tier).<boolean>` reads with checks, the kill-switch flags with guards whose reason is
   `switched-off`, and the MCP write scope with `within`; drop the unused `publicApi`,
   `nonFeedSources` and `ai` fields. Numeric limits stay in `TIER_LIMITS`.

uptime, blog and auth-saas follow in their own ADRs or changes.

## Alternatives Considered

### 1. Adopt CASL

**Rejected because**: last-rule-wins ordering, type-level checks that pass on "some" record, a
second condition language beside `@sdxc/expression`, and a client story that discloses each
user's rules.

### 2. Policy classes per resource (Pundit, Laravel)

**Rejected because**: rules written as code cannot be listed, serialized or shared with flag
targeting, and abilities here are not tied to one record.

### 3. An external decision point (Cerbos, OpenFGA, Permit.io)

**Rejected because**: a service checked from a Worker adds latency and an outage mode, and an
embedded one (Cerbos builds them through its hosted service) still writes conditions in CEL or
YAML, outside the TypeScript types and the expression language.

### 4. Denies inside roles

**Rejected because**: under deny-overrides a role's deny would refuse what every other held role
grants, so whether an editor who is also an admin can delete depends on holding both. Guards keep
every refusal in one list that applies to everyone.

### 5. Ship rules to the client

**Rejected because**: every condition value and fact a rule reads would reach the browser.

### 6. Load every fact up front

**Rejected because**: billing reads, Durable Object round trips and flag evaluations would run on
requests whose checks never read them, and every flag evaluation records an exposure.

### 7. Async lookups during evaluation

**Rejected because**: a lookup per condition issues a query per row, can loop on a cyclic
hierarchy, and leaves MCP's synchronous `available` and server-rendered pages unable to check.

## References

- [CASL](https://casl.js.org/v7/en/guide/intro), [CanCanCan](https://github.com/CanCanCommunity/cancancan),
  [Pundit](https://github.com/varvet/pundit),
  [Laravel authorization](https://laravel.com/docs/authorization)
- [Cedar authorization semantics](https://docs.cedarpolicy.com/auth/authorization.html),
  [Cedar paper](https://arxiv.org/html/2403.04651)
- [Oso enforcement best practices](https://osohq.com/docs/app-integration/integrate-authorization/enforcement-best-practices)
- [OpenFGA concepts](https://openfga.dev/docs/concepts),
  [OPA data filtering](https://www.openpolicyagent.org/docs/filtering/),
  [OPA `not`](https://www.openpolicyagent.org/docs/policy-reference/keywords/not)
- [Cerbos resource policies](https://docs.cerbos.dev/cerbos/latest/policies/resource_policies),
  [Cerbos scoped policies](https://docs.cerbos.dev/cerbos/latest/policies/scoped_policies)
- [AccessControl](https://github.com/onury/accesscontrol),
  [ZenStack access control](https://zenstack.dev/docs/orm/access-control/write-policies),
  [Permix hydration](https://permix.letstri.dev/docs/guide/hydration),
  [Better Auth admin plugin](https://www.better-auth.com/docs/plugins/admin),
  [Casbin frontend](https://casbin.apache.org/docs/frontend)
- [LetMe](https://let-me.hexdocs.pm/readme.html),
  [ASP.NET Core policies](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/policies)
- [ADR-033: Wide Events as the Logging Contract](./ADR-033-wide-events-as-the-logging-contract.md), [ADR-057: Request Context Instead of a Service Container](./ADR-057-request-context-instead-of-a-service-container.md)
- [ADR-105: Expression Package](./ADR-105-expression-package.md),
  [ADR-118: Expression Context Paths](./ADR-118-expression-context-paths.md)

## Current Progress

- [x] Phase 1: Expression changes
- [x] Phase 2: Billing reader
- [x] Phase 3: Core
- [x] Phase 4: Testing helpers
- [x] Phase 5: Adapters
- [x] Phase 6: First consumers

## Notes

- Publishing a new package needs its `description`, `LICENSE.md` and root README row, a
  `bun run release:bootstrap @sdxc/authz` from a developer machine, and a trusted publisher on
  npmjs.com before the first dated release.
- Each phase that touches another workspace (`expression`, `flags-engine`, `sdxc`, `billing`,
  `r3-auth`, `reader`) commits there separately, per the repository's one-workspace rule.
- `context<T>(...keys)` and `fact<T>()` take a type and runtime names separately because
  TypeScript cannot infer the rest of an `ability()` or `definePolicy()` call while `T` is given
  explicitly.
- A write that moves a record (a task into another project) checks the ability against both the
  old and the new parent; checking only one lets a record be moved into a place its author cannot
  reach.
- A check repeated across many rows evaluates once per row and ability; the router adapter
  aggregates them on the wide event rather than logging each one.
