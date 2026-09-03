---
name: create-package
description: Create a new shared package under `packages/` in this monorepo. Use when adding a `@sdxc/*` workspace from scratch — asking for the package name and description, writing the `src/` layout and `exports` map, keeping it app-agnostic, and pointing at the living package that already solves each concern.
---

# Create Package

Patterns for adding a shared package to `packages/`. There is no template directory to
copy; a package is written from the structure described here and from whichever of the
existing `@sdxc/*` packages already solves the concern being added. Contains 8 rules across
5 categories: required inputs, structure, reuse, wiring, and boundaries.

## When to Apply

Reference these guidelines when:

- Creating a new package inside `packages/`
- Deciding whether something belongs in a package at all, rather than in an app
- Adding a second entry point, a CLI, or a `.css` export to a young package
- Reviewing whether a newly created package matches how the other packages are built

## Rules Summary

### Required Inputs (HIGH)

#### require-package-metadata - @rules/require-package-metadata.md

Get the package name, its one-line description, and its public surface before writing any
file, because the surface is what decides the `exports` map and the `src/` shape.

```text
Required inputs:
- package name: "hostname"        -> @sdxc/hostname
- description:  "Cloudflare for SaaS custom-hostname client."
- surface:      one class, HostnameClient, plus its error and option types
```

#### use-kebab-case-name - @rules/use-kebab-case-name.md

The directory name and the part after `@sdxc/` are the same kebab-case string.

```text
packages/data-table-d1/     package.json -> "@sdxc/data-table-d1"
README.md                   -> "# @sdxc/data-table-d1"
```

### Structure (HIGH)

#### minimum-package-files - @rules/minimum-package-files.md

Six files make a package that resolves, tests, and type-checks. The rule carries the
content of every one of them.

```text
package.json  tsconfig.json  README.md  LICENSE.md
src/index.ts  src/index.test.ts
```

#### exports-map-and-src-layout - @rules/exports-map-and-src-layout.md

`exports` is the whole public surface — one entry per import path a consumer may write —
and `src/` is flat files with colocated `*.test.ts`, re-exported through `index.ts` with
explicit `.js` specifiers.

```json
"exports": {
	".": "./src/index.ts",
	"./middleware": "./src/middleware.ts"
}
```

### Reuse (HIGH)

#### copy-from-living-code - @rules/copy-from-living-code.md

For anything past the minimum, copy the shape out of the package that already ships it
instead of inventing one; that package is the spec, and it stays current.

```text
Pure functions, one export per file  -> packages/result
HTTP client over an external API     -> packages/hostname
Cloudflare binding test doubles      -> packages/cloudflare-mocks
A package with a CLI                 -> packages/spec
Many entry points off one src tree   -> packages/u
```

### Wiring (HIGH)

#### wire-into-the-monorepo - @rules/wire-into-the-monorepo.md

Extend the root `tsconfig.json`, never exclude test files, and keep lint and format
exceptions in the root `vite.config.ts`.

```json
{ "extends": "../../tsconfig.json", "include": ["src/**/*"] }
```

### Boundaries (HIGH)

#### keep-packages-app-agnostic - @rules/keep-packages-app-agnostic.md

A package may not import from, or refer to, `apps/*` — in code, in comments, or in its
README. Anything app-shaped is a constructor option.

```ts
// Bad: new HostnameClient({ zoneId: BLOG_SAAS_ZONE })
// Good: new HostnameClient({ zoneId, metadataKey: "blog_id" })
```

#### document-the-package - @rules/document-the-package.md

Every package has a README following the package documentation guidelines, and every
exported symbol has JSDoc. This is a MUST in the root `AGENTS.md`, not a nice-to-have.

```text
docs/guides/package-documentation.md
-> Title, Overview, Usage, API, Patterns, Related Packages, Tips
```

## Philosophy

Good package creation is:

1. **Derived** - The structure comes from the 49 packages that ship, not a snapshot of them
2. **Minimal** - Six files, one entry point, and a second only when a consumer needs it
3. **Pointed** - Every concern past the minimum names the package to read, so the guidance cannot rot
4. **Agnostic** - No app can be named in it; anything app-specific is passed in
5. **Documented** - README and JSDoc are part of the first commit, not a follow-up
