# ADR-165: Normalize App Authorization on `@sdxc/authz`

## Status

**Accepted** - 2026-10-19 (blog, r3-auth and reader done; uptime and auth-saas planned)

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
| uptime      | OIDC viewer + team membership, API keys with scopes             | `requireRole("admin")`, owner checks in handlers, 7 subscription gates, API scopes, 1 flag gate | planned below                       |
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

### uptime (planned)

Medium: few rules, many call sites. Keep `requireUser`, `requireApiKey` (authentication),
`requireTeam` (membership lookup, 404) and the `inTeam` query scoping.

1. Catalog: `monitors.{write,delete,check}` (one group per monitor kind if the scopes stay per
   kind), `alerts`, `maintenance`, `statusPages`, `team.{update,delete,leave}`,
   `members.{remove,changeRole}`, `invites`, `domains`, `apiKeys`, `billing.manage`,
   `ping.trigger`, `stats.backfill`.
2. Policy: `member`; `admin` inherits it and adds team, members, invites, domains and keys;
   `owner` inherits admin and adds `team.delete` and `billing.manage`; a guard refuses
   `members.*` and `team.leave` for the owner. One ceiling role per API scope bound as
   `within`, so a key never exceeds its scopes. Facts: `billing` from `fromEntitlements`, with a
   guard on `monitors.check` and `ping.trigger` for an `inactive` subscription (fail-open as
   today), and `flags.adhocPingApi` as a guard on the API ping.
3. Bind `access` after `requireTeam` in `MEMBER_GUARDS`/`ADMIN_GUARDS` and after
   `requireApiKey`; replace `requireRole("admin")` with `requireAbility`, keeping its 403 page
   through `onDenied`, and the API's `insufficient_scope` challenge through the API's
   `onDenied`.
4. Replace the owner checks in `actions/team.ts`, `actions/account.ts`, `checkout.tsx` and the
   HTTP-monitor delete, and the 7 `stateFor` gates, one area at a time, each keeping its status
   and copy.
5. First add a router test asserting the guards are attached, since today every action test
   stubs `ctx.team`/`ctx.membership` and dropping `ADMIN_GUARDS` fails nothing.

Open product questions: deletes are admin-only for HTTP monitors and open to members for every
other kind; any team's `monitors:write` key can enqueue the global stats backfill.

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

- Three apps share one shape, and the next two have a plan that keeps their wire contracts.
- Two untested blog rules now have tests.

### Negative

- uptime and auth-saas still authorize by hand until their plans land.

## References

- [ADR-164](./ADR-164-generated-authorization-uses-authz.md)
- `packages/authz/README.md`
