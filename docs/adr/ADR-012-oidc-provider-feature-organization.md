# ADR-012: OIDC Provider Feature-Based File Organization

## Status

**Accepted** - 2026-07-04

## Background

[ADR-011](./ADR-011-oidc-provider-engine-package.md) extracted the OIDC provider
into `@pkg/oidc-provider`. The extraction moved the code as-is, preserving the
layer-based (technical) directory structure it had inside `apps/auth-saas`:
`controllers/`, `models/`, `values/`, `middleware/`, `lib/`. Now that it is a
standalone package meant to be read, understood, and evolved on its own, a
feature-based (vertical-slice) organization fits it better: someone working on the
WebAuthn flow, or on client management, should find the controllers, models, and
values for that concern in one place rather than spread across five sibling
directories.

## Context

### Current Structure (layer-based)

```
src/
  controllers/   oauth/  oidc/  discover/  webauthn/  api/{,client/,subject/}  index.tsx  verify-email.tsx  not-found.ts
  models/        (17 files) + client/{secret,redirect-uri,logout-uri}
  values/        access-token  id-token  logout-token  scope-set
  middleware/    db  logger  analytics  management-auth
  lib/           (17 cross-cutting helpers)
  components/    layout.tsx
  client/        webauthn-auth.tsx  webauthn-register.tsx  entry.ts
  database/      migrations.ts
  migrations/    *.sql
  test/          db.ts  fixtures.ts
  index.ts  provider.ts  routes.ts  globals.d.ts  router-context.d.ts
```

To work on, say, passkeys you touch `controllers/webauthn/*`,
`models/passkey.ts`, `models/webauthn-challenge.ts`, and `client/webauthn-*.tsx`
— four directories. The layer split optimizes for "all controllers together,"
which is rarely how the code is actually navigated or changed.

### Import Mechanism Constraint

The package uses relative imports (`./`, `../`), not a path alias. ADR-011
established why a `~/`-style alias cannot be used: a consumer (e.g.
`apps/auth-saas`) compiles the package's `.ts` sources against its _own_ tsconfig
paths, so a `~/` alias resolves to the consumer's `src`, not the package's.

Package.json subpath imports (`#/*` → `./src/*`) would be move-stable _and_
consumer-safe in principle (they resolve relative to the importing package). They
were evaluated and **rejected**: with this repo's `moduleResolution: "bundler"`
plus the `@total-typescript/tsconfig` base and the root tsconfig's catch-all
`paths: { "*": ["./*"] }`, `tsc` does not resolve `#/…` specifiers (it reports
`TS2307`), even though `bun` and Vite resolve them at runtime. A green typecheck is
required, so relative imports remain the mechanism. This makes moves a one-time
cost (imports must be rewritten), which is acceptable because a settled
feature structure changes rarely.

## Decision

Reorganize `@pkg/oidc-provider` **feature-first**: each domain concern is a
top-level directory under `src/`, and files are grouped by layer _within_ the
feature. Cross-cutting code lives in `shared/`; schema, client bundles, and the
composition root stay in their own top-level directories.

### Target Structure

```
src/
  index.ts            # createOidcProvider (public entry)
  provider.ts         # router assembly
  routes.ts           # route map
  globals.d.ts  router-context.d.ts

  shared/             # cross-cutting; no feature imports it for domain logic
    lib/              # feature-agnostic helpers
      action.ts middleware.ts form.ts db-errors.ts request-handler.ts
      crypto-utils.ts base64url.ts safe-json.ts schema-checks.ts timestamp.ts
      uri-validation.ts parse-basic-auth.ts reject.ts css-sanitizer.ts
      user-agent.ts user-rate-limit.ts internal-auth.ts
    layout.tsx home.tsx not-found.ts
    middleware/{db,logger,analytics}.ts
    test/{db,fixtures}.ts

  database/migrations.ts       # journaled runner
  migrations/*.sql             # engine-wide schema
  client/                      # browser entries, built as a group by the host
    entry.ts webauthn-auth.tsx webauthn-register.tsx

  oauth/         controllers/{authorize,token,revoke,introspect}  models/{authorization-code,grant,session}  values/{access-token,id-token,scope-set}
  oidc/          controllers/{userinfo,logout}  values/{logout-token}
  discovery/     controllers/{jwks,oauth,oidc}
  webauthn/      controllers/{register-options,register-verify,auth-options,auth-verify}  models/{passkey,webauthn-challenge}
  subjects/      controllers/{verify-email,subjects,sessions,grants,passkeys,connections}  models/{subject,credential,connection,email-verification-token}
  clients/       controllers/{clients,secrets,redirect-uris,logout-uris}  models/{client,secret,redirect-uri,logout-uri}
  resources/     controllers/{resources}  models/{resource}
  branding/      controllers/{brand}  models/{brand}
  signing-keys/  controllers/{signing-keys}  models/{signing-key}
  management/    controllers/{setup,stats}  middleware/{management-auth}  models/{tenant-meta}
```

> The utility helpers are nested one level under `shared/lib/` rather than sitting
> flat in `shared/`. This avoids a name collision: the `middleware.ts` helper (the
> `remix/router` type wrapper) would otherwise sit next to the
> `shared/middleware/` runtime-middleware directory, and a file and directory with
> the same stem cannot be referenced by an unambiguous relative import from inside
> that directory. Scope management has no dedicated controller — scopes are handled
> within `resources/controllers/resources.ts`.

### Placement Rules

- **Feature = a domain concern**, top-level under `src/`. Within it, `controllers/`,
  `models/`, `values/` as needed. Filenames are unchanged (only their directory
  moves), so `subjects/models/subject.ts` vs `subjects/controllers/subjects.ts`
  stay distinct.
- **Cross-feature imports are expected and fine.** The token endpoint (`oauth/`)
  reads clients, subjects, and signing keys; `subjects/controllers/passkeys.ts`
  reads `webauthn/models/passkey`. Feature-based organization co-locates cohesive
  code; it does not forbid a feature from importing another feature's model.
- **`shared/` must not depend on features.** Only genuinely cross-cutting,
  feature-agnostic code goes there (the `remix/router` helpers, crypto, the
  base layout, the DB/logger/analytics middleware, the 404 and home pages, test
  helpers). Middleware that reads feature models is not shared — `management-auth`
  reads clients/signing-keys/tenant-meta, so it lives in `management/`.
- **`client/` is not feature-split.** The browser entries are built as one group by
  the host (`apps/auth-saas/vite.config.client.ts` globs `src/client/**`); keeping
  them in a single directory keeps that build simple and the entries discoverable.
- **`database/` and `migrations/` stay top-level.** The schema is engine-wide, not
  owned by any one feature.
- **`management/`** owns the cross-cutting management-API concerns (the `setup` and
  `stats` endpoints, the `management-auth` middleware, and the `tenant-meta` model
  that `setup` writes).

### Import Rewriting

Because imports are relative, moving files requires recomputing them. The move is
done with a scripted old→new path map: files are `git mv`d to their new homes, then
every relative import in every file is re-resolved against the map (resolving the
target's old path, looking up its new path, and recomputing the relative specifier),
including `?raw` migration imports. No import target or behavior changes — only
directory locations and the relative paths between them.

## Consequences

### Positive

- **Cohesion**: everything for a concern (WebAuthn, client management, subjects) is
  in one directory, so a change to that concern touches one place.
- **Discoverability**: the top-level `src/` listing reads as a table of contents of
  what the provider does, not of technical layers.
- **Clear cross-cutting boundary**: `shared/` is now explicitly "no feature logic,"
  which makes accidental coupling visible in review.
- **No behavior change**: this is a pure move; the same endpoints, flows, schema,
  and public API (`createOidcProvider`, the internal-auth re-exports) are preserved,
  and the ~200 tests move with their features and keep passing.

### Negative

- **A large one-time move** with scripted import rewriting; even mechanical, it
  carries churn and review cost, and it is the third relocation of these files in
  quick succession (extract → relativize → reorganize).
- **Relative imports remain move-sensitive**: a future feature reshuffle will again
  need an import rewrite. Mitigated by the structure being intended to settle.
- **Cross-feature imports blur the "vertical slice" ideal**: some features import
  another's models (unavoidable for an OIDC provider, where the token flow spans
  clients, subjects, and keys).

### Neutral

- `apps/auth-saas` is unaffected: it imports only the package's public entry, so no
  consumer change is needed.
- `client/`, `database/`, and `migrations/` deliberately stay layer-ish because they
  are not feature-owned.

## Implementation Plan

1. Build the old→new path map for every file per the structure above.
2. `git mv` files to their new locations (preserving history).
3. Run the import-rewrite script over all `.ts`/`.tsx` files.
4. Verify: package typecheck, `apps/auth-saas` typecheck, `bun test` (package + app),
   `bun run build`, and `wrangler deploy --dry-run` — all green.
5. Update `apps/auth-saas/vite.config.client.ts` only if the client glob needs it
   (it globs `src/client/**`, which is unchanged).

## Alternatives Considered

### Keep the layer-based structure

**Rejected**: it works, but it optimizes for the rare "all controllers at once" view
over the common "everything for this concern" view, which is the point of extracting
a standalone package meant to be understood on its own.

### `#`-prefixed package.json subpath imports

Would make moves painless (imports reference the package root, not siblings) and are
consumer-safe.

**Rejected**: `tsc` does not resolve them in this repo's config (see Context);
runtime tools do, but typecheck must pass. Revisit if the repo's TypeScript
configuration changes to resolve `imports`.

### A `features/` wrapper directory

Put every feature under `src/features/*`.

**Rejected**: it adds a level without value; the features _are_ the package, so they
read better at the `src/` root next to `shared/`, `database/`, and the composition
root.

### Split `client/` entries into their features

**Rejected for now**: the host builds the client entries as a group via a
`src/client/**` glob; scattering them would complicate that build for little gain.
The server-side WebAuthn code still lives in `webauthn/`.

## References

- [ADR-011: OIDC Provider Engine Package](./ADR-011-oidc-provider-engine-package.md) — the extraction this reorganizes
- [ADR-001: New Package Extraction](./ADR-001-new-package-extraction.md)

## Notes

- Cross-feature model imports are expected for an OIDC provider; the goal is
  cohesion, not zero coupling.
- A few placements are judgment calls documented above: `session`/`grant` models in
  `oauth/` (they belong to the authorization flow), `management-auth` in
  `management/` (it reads multiple features' models), and `client/`, `database/`,
  `migrations/` kept top-level as non-feature infrastructure.
