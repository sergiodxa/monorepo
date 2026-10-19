# ADR-164: Generated Authorization Uses `@sdxc/authz`

## Status

**Implemented** - 2026-10-19

## Background

`sdxc make policy` (ADR-143) wrote `app/policies/<name>.ts` as one boolean function,
`<key>(actor): boolean`, and `sdxc scaffold` (ADR-163) wrote `authorize<Name>(actor, action)` over
a string union, with every action allowed to an anonymous visitor and every controller calling it
with `null`. The app template held no authorization at all. Meanwhile `@sdxc/authz` is the
repo's authorization package, and the apps that authorize anything use it: one `abilities()`
catalog, one `definePolicy()`, and the router middleware binding the request's principal.

So the kit taught a pattern the repo does not use. A generated app grew a set of unrelated
functions, one per resource, each with its own notion of an actor, none of them testable with
`@sdxc/authz/testing`, none answering a hidden record as not found, and none reachable from an
MCP tool or a page that wants to decide what to show. The user corrected this: what the kit
generates for authorization is `@sdxc/authz`.

## Decision

### The app template carries the catalog, the policy and the binding

- `app/policies/abilities.ts` is `export default abilities({})`.
- `app/policies/policy.ts` is `definePolicy(abilities, { facts: { actor: fact<Actor>({ optional: true }) }, everyone: [], roles: { member: [] } })`,
  registered as `AuthzTypes["policy"]` so `ctx.access` is typed from it.
- `app/http/middleware/access.ts` binds the page chain's principal after the session: a visitor
  whose session holds `actor` is a `member` and is the `actor` fact; anyone else is a guest. Every
  ability loads up front (`load: [abilities]`), so a handler checks with `ctx.access.can(…)`
  synchronously. Signing someone in is `ctx.session.set("actor", { id })`.
- The API chain (`app/http/middleware/api.ts`), which the MCP endpoint uses, binds every caller
  as a guest until the app authenticates API callers.
- `app/test/session.ts` signs a test visitor in through the real session middleware and answers
  the cookie, so a page test runs as a member without knowing the cookie's format.

### `make policy <resource>` declares abilities and grants

`sdxc make policy post` no longer writes a policy file. It adds, through `@sdxc/codemod` like
every other declaration:

- `post: { create, read, update, delete }` to the catalog, `read`, `update` and `delete` taking
  `context<{ post: PostRow }>("post")` (the model's row type when `app/models/post.ts` exports
  one, `{ id: string }` otherwise), and `read` declared `deniedAs: "notFound"`;
- `allow("post.read", { id: "post-read" })` to `everyone` and
  `allow(["post.create", "post.update", "post.delete"], { id: "post-write" })` to `member`
  (`roles.member`, or its `grants` when the role inherits);
- `app/policies/post.test.ts`, deciding each ability for a guest and a member with `testAccess`.

When the catalog or the policy cannot be read or edited, the test is still written and the
lines to add are printed, as every other declaration does. `--dry-run` prints both diffs. A
nested name nests the group: `billing/invoice` declares `billing.invoice.*`.

### `scaffold` registers the same abilities and checks them

`scaffold` makes the `make policy` declaration for its resource and checks the bound access:

- A read hidden by `post.read` is a 404 on a page and a "no such" tool error, exactly as a
  missing row; the index and `list_posts` leave hidden rows out.
- A refused `create`, `update` or `delete` is a 403 on a page and a `ForbiddenError` from a tool.
- Page tests write as a signed-in member and assert a guest's 403; tool tests call as a member
  through a router binding that principal, and as a guest through `/mcp`, which refuses writes.
- Commands check nothing: a command runs on the operator's machine against a database the
  operator already holds, so there is no principal to authorize.

## Consequences

### Positive

- A generated app has one catalog and one policy from its first commit, the shape its
  authorization keeps as it grows roles, conditions and guards.
- Reads and writes are told apart from the start, and a hidden record never leaks its existence.
- The generated tests use `@sdxc/authz/testing`, so `coverage` and `diffPolicies` work on them.

### Negative

- Breaking: `make policy` no longer writes `app/policies/<name>.ts`, and a scaffolded resource's
  writes are refused to guests until the app signs people in. A project made before this release
  needs the template's catalog, policy, access middleware and test helper before scaffolding.
- An MCP write tool answers no real caller until the API authenticates one.

### Neutral

- `make controller` does not yet take a resource to check; a controller checks `ctx.access`
  by hand.

## References

- [ADR-143](./ADR-143-sdxc-make-generators.md): `sdxc make`
- [ADR-163](./ADR-163-sdxc-scaffold.md): `sdxc scaffold`
