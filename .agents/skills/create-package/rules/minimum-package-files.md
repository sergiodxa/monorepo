---
title: The Minimum Files a New Package Needs
impact: HIGH
tags: [packages, bootstrapping, structure]
---

# The Minimum Files a New Package Needs

Six files make a package that resolves from every workspace, runs its tests under
`bun run test`, and passes `vp check`. Everything below is the whole content, not a
sketch. Write these, run `bun install` at the repo root, and the workspace is real.

Substitute `slugify` for the package name throughout.

## Why

- **The old `templates/package` was three files and two of them were wrong.** Its
  `tsconfig.json` carried `"exclude": ["src/**/*.test.ts"]`, which is the opposite of the
  repo's rule that test files are type-checked; its `package.json` was missing the
  `typecheck` script, the `license` field, and had `version: 0.0.0` where every real
  package has `0.0.1`; and its README was a fill-in-the-blank sheet with React Router
  loader and action examples from a framework this repo left behind.
- **Six files is the floor and, for a pure package, often the ceiling.** `@sdxc/hostname`
  is a full Cloudflare API client in exactly this shape.

## Pattern

### `package.json`

```json
{
	"name": "@sdxc/slugify",
	"version": "0.0.1",
	"private": true,
	"license": "MIT",
	"type": "module",
	"exports": {
		".": "./src/index.ts"
	},
	"scripts": {
		"typecheck": "tsc --noEmit"
	},
	"devDependencies": {
		"@types/bun": "^1.3.14"
	}
}
```

Notes on each field, because every one of them is load-bearing:

- **`private: true`** on a new package. Workspace consumers resolve it through Bun either
  way; the flag comes off once the package is meant for npm consumers, following the
  publishing steps in `AGENTS.md` and ADR-007 (a `description`, a `LICENSE.md`, the mark in
  the root README table, a bootstrap publish, a trusted publisher).
- **`version: "0.0.1"`** — the shared placeholder. The daily release writes the dated
  version into the generated publish manifest, so nothing in the repo reads or bumps it.
- **`license: "MIT"`**, matching the `LICENSE.md` next to it.
- **`type: "module"`** always.
- **`exports`** points at TypeScript source (`./src/index.ts`). Development and tests run
  that source directly; the release script compiles a published package into `dist/` and
  rewrites these targets in the generated manifest, so there is no `main`, `types`, or
  `files` field to maintain.
- **`typecheck`** gives `tsc`'s second opinion on the workspace. CI runs `vp check`, which
  covers this package either way.
- **`@types/bun`** as the only devDependency a pure package needs; add `msw` when the
  package makes outbound HTTP calls and its tests intercept them.

Take `@sdxc/*` dependencies as `workspace:*`. Read every version pin off a sibling package
rather than off this rule; `bun run upgrade` moves them across the repo at once.

### `tsconfig.json`

```json
{
	"extends": "../../tsconfig.json",
	"include": ["src/**/*"]
}
```

That is the whole file for a pure package. `compilerOptions` appear only to override
something specific — `@sdxc/cloudflare-mocks` adds
`"types": ["@cloudflare/workers-types", "bun"]` because it builds Workers test doubles,
and the few React-only packages set `"jsxImportSource": "react"` back.

There is no `exclude`. `src/**/*` picks up the `*.test.ts` files on purpose.

### `src/index.ts`

For a single-concern package, the implementation lives here directly:

```ts
/**
 * Converts arbitrary text into a URL-safe slug. Normalizes accents away, collapses
 * runs of non-alphanumerics into single hyphens, and trims the result, so a title
 * typed by a person becomes a path segment that survives a round trip through a URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Builds a URL-safe slug from `input`.
 *
 * Accents are stripped rather than transliterated, so `"Café"` becomes `"cafe"`. An
 * input with no alphanumerics returns the empty string; callers that need a
 * non-empty path segment supply their own fallback.
 *
 * @param input - The text to slugify.
 * @returns The slug, lowercase and hyphen-separated.
 * @example slugify("Hello, World!") // "hello-world"
 */
export function slugify(input: string): string {
	return input
		.normalize("NFD")
		.replaceAll(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "");
}
```

Once there is more than one concern, `index.ts` becomes a re-export barrel and each
function gets its own file — see
[exports-map-and-src-layout](./exports-map-and-src-layout.md).

### `src/index.test.ts`

Colocated with the module it covers, and under `src/` — that is what the packages Vitest
project collects.

```ts
/**
 * Tests for {@link slugify}, covering the accent-stripping, the collapse of
 * non-alphanumeric runs, and the empty-string contract for input that has no
 * alphanumerics at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { slugify } from "./index.js";

describe(slugify, () => {
	test("lowercases and hyphenates", () => {
		expect(slugify("Hello, World!")).toBe("hello-world");
	});

	test("strips accents rather than transliterating them", () => {
		expect(slugify("Café Möller")).toBe("cafe-moller");
	});

	test("returns an empty string when there is nothing to slug", () => {
		expect(slugify("!!!")).toBe("");
	});
});
```

`describe(slugify, …)` takes the function itself, which is the convention here — the test
name follows a rename. Every relative import carries its `.js` extension — `./index.js`,
`./thing.js` — because emitted JavaScript keeps specifiers verbatim and Node resolves only
that form; `test/import-extensions.test.ts` fails on any other.

### `README.md`

Follows [the package documentation guidelines](../../../../docs/guides/package-documentation.md):
title, overview, usage, API, patterns, related packages, tips. Do not restate that
structure here; open the guide. See [document-the-package](./document-the-package.md) for
what makes it a MUST.

### `LICENSE.md`

MIT, `Copyright (c) 2026 Sergio Xalambrí`. Copy the text from any sibling package.

### After writing

```bash
bun install                              # from the repo root, so the workspace resolves
bun test packages/slugify                # single-scope run needs no --isolate
vp check                                 # format, lint, and type check
```

## Rules

1. Write the six files, then `bun install` at the repo root
2. Read version pins off a sibling package, never off this rule
3. Start with `private: true`; keep `version: "0.0.1"`, `license: "MIT"`, `type: "module"`, and a `typecheck` script
4. Point `exports` at TypeScript source with no `main` or `types` field; the release script builds `dist/` for npm
5. Start every file with the module JSDoc header, `@author` and `@copyright` included, and give every export its own JSDoc
6. Colocate `*.test.ts` next to the module, import through `./index.js`, and never exclude tests from the tsconfig
