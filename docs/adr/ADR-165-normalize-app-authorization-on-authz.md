# ADR-165: Normalize App Authorization on `@sdxc/authz`

## Status

**Accepted** - 2026-10-19 (blog, r3-auth, reader and uptime done; auth-saas planned)

## Background

[ADR-164](./ADR-164-generated-authorization-uses-authz.md) made the kit generate authorization
with `@sdxc/authz`. The apps in this repo predate it, and each authorizes its own way: a
role check in middleware, a boolean in a handler, a scope list, a policy bound inside a
Durable Object. The user asked to normalize them on the shape the template now generates.

## Decision

Every app that authorizes a principal holds one catalog, `app/policies/abilities.ts`, and one
policy, `app/policies/policy.ts`, which registers itself as `AuthzTypes["policy"]` in the same
file. Requests bind the principal with `access()` from `@sdxc/authz/middleware/router`
(`app/http/middleware/access.ts`), and handlers check `ctx.access`. Jobs use
`@sdxc/authz/middleware/dispatcher`, MCP tools `@sdxc/authz/mcp`, and plan or flag gates
become facts from `./facts/billing` and `./facts/flags`. An app with no principal to
authorize gets no catalog.

Authentication stays where it is: middleware that resolves who is asking and redirects a
signed-out visitor is not a policy. So does query scoping (`inTeam(team.id)`), signed links,
webhook signatures, rate limits and numeric quotas.

## Survey

| App         | Principal                                                       | What it authorized before                                                                       | Outcome                             |
| ----------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------- |
| agentic-hub | —                                                               | no code                                                                                         | nothing to do                       |
| blog        | KV session → `users.role` (`guest`, `admin`)                    | `requireAdmin` on `/cms`; `isAdmin()` for drafts (403) and search topic links                   | converted                           |
| books       | none                                                            | signed sample links, Essentials ownership looked up by email, Polar signatures                  | no authz: no principal              |
| demo        | none                                                            | captcha and per-IP budget                                                                       | no authz                            |
| pkmn        | none                                                            | dev-server gate and write-path allow-list                                                       | no authz                            |
| r3-auth     | session subject, `role` column                                  | already on authz; registration lived in `types.ts`                                              | registration moved into `policy.ts` |
| reader      | per-reader Durable Object, leased tier, agent scope             | already on authz, decided inside the object                                                     | registration added to `policy.ts`   |
| sdxc-site   | none                                                            | GitHub Sponsors webhook signature                                                               | no authz                            |
| uptime      | OIDC viewer + team membership, API keys with scopes             | `requireRole("admin")`, owner checks in handlers, 7 subscription gates, API scopes, 1 flag gate | converted                           |
| auth-saas   | management caller: agent client, person token, dashboard cookie | `requireScope` on 72 routes from `scopesForRole`, entitlement middleware, `dashboardRole`       | planned below                       |

### blog

`cms.open`, `posts.read` (checked with `{ published }`) and `search.linkTopics`; `everyone`
reads a published post, `admin` holds everything, `guest` nothing more. `access` runs on the
HTML surface after `auth`; the CMS guard is `requireAbility(abilities.cms.open)` with the same
redirect to the feed. The guest redirect and the admin draft read had no test and now do.

### r3-auth and reader

Both keep their behavior. r3-auth binds per controller after `requireSubject`, because its
account and admin areas are the only places a subject exists; a page chain would have to carry
`requireSubject` too, which is the same thing under another name. reader decides inside the
per-reader object, which owns the tier lease every surface reads, so `app/policies/access.ts`
binds there instead of in request middleware.

Left as they are, each a behavior change to decide on its own:

- r3-auth: the grants page hides "revoke" for the server's own client with its own comparison
  instead of `ctx.access.can(abilities.account.grant.revoke, …)`; the API consent check is an
  ad-hoc 404 rather than a `notFound` ability bound to the API client.
- reader: MCP writes use `WRITES`/`requireWriteScope` rather than `guard()` from
  `@sdxc/authz/mcp` (the error text would change); raw `features.savedPosts` checks could read
  `can.posts.keep`, while `features.tags` cannot become `can.tags.label` without hiding labels
  from free readers.

### uptime

Converted with every status code, redirect, copy and the API's `insufficient_scope` challenge
kept. `requireUser`, `requireApiKey` (now authentication alone), `requireTeam` and `inTeam`
query scoping stay.

- The catalog's read and write pairs follow the API key scopes one to one; `monitors.delete`
  (HTTP monitors only, admin), `team.{update,delete,leave}`, `members.{manage,remove,changeRole}`,
  `billing.manage`, `checks.run`, `ping.{trigger,api}` and `stats.backfill` complete it.
- Roles: `member`, `admin` inheriting it, and `owner` holding everything; a team's owner binds
  `owner` alone. Guards keep the owner in the team (`members.remove`, `members.changeRole`,
  `team.leave`, reason `owner`), ask an admin to be demoted before leaving (reason `admin`),
  refuse `checks.run` for a subscription known `inactive` (the `billing` fact reads the D1
  projection through `stateFor`, so it fails open as before), and close `ping.api` while the
  `adhocPingApi` flag is off for the calling team.
- An API key binds `owner` within one `scope:<name>` role per scope; `API_SCOPES` in
  `policy.ts` is the table, and the first scope granting a refused ability is the one the
  challenge names.
- `teamAccess` ends `MEMBER_GUARDS`; admin actions add `requireAbility` for the ability each
  performs. Team deletion is admitted by `team.update` and refused in the action, with its 400,
  for anyone but the owner. `app/initializers/router.test.ts` drives the real router to prove
  every team action is guarded.

The two product questions stay as they were, by decision: HTTP-monitor deletes remain admin-only
while members delete every other kind, and any key with `monitors:write` may enqueue the global
stats backfill. The trial page's `stateFor` read picks a billing path for a signed-in visitor
rather than refusing anything, so it stays a model call.

### auth-saas (planned)

Medium size, low risk (not deployed). `MANAGEMENT_SCOPES` stays the public OAuth vocabulary,
and the RFC 6750 `insufficient_scope` challenge naming the scope must survive.

1. Decide the scope matrix first: `export:credentials` is unreachable outside tests; end-user
   roles sit behind `members:write`; several reads need write scopes; `member` can export PII.
2. Catalog and policy with a parity test reproducing `scopesForRole` and every `requireScope`
   exactly: roles `member` < `admin` < `owner`, plus `scope:<name>` roles bound as `within` for
   a token, so `within` replaces today's intersection.
3. `managementAuth` installs `access(policy, { roles, within, facts, onDenied })`; replace each
   `requireScope` with `requireAbility`, one resource folder at a time.
4. Fold `managementEntitlement` into billing-fact guards and `dashboardRole` into `access` on
   the web router; filter MCP tools with `requireToolAbility`.
5. Entitlement and DAU checks stay inside the tenant Durable Object, the runtime boundary that
   receives the traffic; move SCIM's Worker-side entitlement RPC into the object.

## Consequences

### Positive

- Four apps share one shape, and auth-saas has a plan that keeps its wire contracts.
- Two untested blog rules now have tests.

### Negative

- auth-saas still authorizes by hand until its plan lands.

## References

- [ADR-164](./ADR-164-generated-authorization-uses-authz.md)
- `packages/authz/README.md`
