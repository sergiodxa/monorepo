# ADR-007: Publishable Package Releases

## Status

**Proposed** - 2026-06-29

## Background

Shared packages currently use the `@pkg/*` namespace inside the monorepo. This works for local Bun workspace development, but it cannot be used for npm publishing because the `@pkg` scope is not available.

The available npm scope is `@sdxc`. Packages should keep working as workspace packages in local apps, but they should also be publishable individually when needed.

## Context

The monorepo has many packages under `packages/*` and apps under `apps/*`. Packages and apps depend on internal packages with Bun workspace ranges:

```json
{
	"dependencies": {
		"@pkg/result": "workspace:*"
	}
}
```

Most package manifests export TypeScript source directly:

```json
{
	"exports": {
		".": "./src/index.ts"
	}
}
```

This is convenient inside the monorepo, but published npm packages should expose JavaScript and declaration files instead of requiring consumers to transpile TypeScript from dependencies.

Publishing also needs to handle internal dependencies. If `@sdxc/markdown` depends on `@sdxc/result`, publishing `@sdxc/markdown` must either publish or reuse the correct published version of `@sdxc/result` first.

Versioning should support multiple publishes per day and avoid republishing unchanged artifacts. A simple daily version like `26.6.29` is insufficient because a package can change after an earlier publish on the same day.

## Decision

Rename the package namespace from `@pkg/*` to `@sdxc/*` and add a package publishing script that generates temporary npm artifacts from workspace packages.

Local package development will continue to use Bun workspaces and `workspace:*` ranges. Published packages will be generated into temporary directories with JavaScript output, declaration files, rewritten exports, exact dependency versions, and artifact-hash-based versions.

### Namespace

All internal package names and imports will use `@sdxc/*`:

```txt
@pkg/result -> @sdxc/result
@pkg/ui -> @sdxc/ui
@pkg/markdown -> @sdxc/markdown
```

Workspace manifests will keep local workspace ranges:

```json
{
	"dependencies": {
		"@sdxc/result": "workspace:*"
	}
}
```

The namespace migration will update package manifests, app manifests, source imports, tool aliases, the `create-app` / `create-package` skills, documentation, and repo rules that reference `@pkg/*`. (The skills replaced the `templates/` directory this originally named; see [ADR-035](./ADR-035-vite-plus-as-the-single-toolchain.md).)

### Source Imports

Source files intended for package publishing will use `.js` extensions for relative imports:

```ts
import { parse } from "./parse.js";
```

TypeScript resolves the import to the matching `.ts` or `.tsx` source file and preserves the `.js` specifier in emitted JavaScript. This keeps published output compatible with Node ESM without a post-build import rewrite step.

### Publish Artifacts

Packages will not be published directly from `packages/*`.

The publish script will generate temporary package artifacts:

```txt
packages/result/package.json
.tmp/publish/result/package.json
.tmp/publish/result/dist/index.js
.tmp/publish/result/dist/index.d.ts
```

The workspace package remains the source of truth. The temporary directory is the npm artifact.

Generated artifacts will contain emitted JavaScript, emitted declaration files, a generated publish-safe `package.json`, exported non-TS files copied as-is, and package documentation when available.

Generated artifacts will not contain workspace-only fields like `private: true`, `workspace:*` dependency ranges, or unexported assets.

### TypeScript Emit

Publishing will use `tsc`, not a bundler.

The publish script will create or use a publish-specific TypeScript config equivalent to:

```json
{
	"extends": "./tsconfig.json",
	"compilerOptions": {
		"noEmit": false,
		"declaration": true,
		"emitDeclarationOnly": false,
		"outDir": "./.tmp/publish/<package>/dist",
		"rootDir": "./src",
		"sourceMap": false,
		"declarationMap": false
	},
	"include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

The emitted output will preserve source structure under `dist`:

```txt
src/index.ts -> dist/index.js
src/index.ts -> dist/index.d.ts
src/server/index.ts -> dist/server/index.js
src/server/index.ts -> dist/server/index.d.ts
```

### Export Rewriting

Package exports will be rewritten only in generated publish manifests.

Workspace manifest:

```json
{
	"exports": {
		".": "./src/index.ts",
		"./server": "./src/server/index.ts",
		"./styles/light.css": "./styles/prism-light.css"
	}
}
```

Generated publish manifest:

```json
{
	"exports": {
		".": {
			"types": "./dist/index.d.ts",
			"default": "./dist/index.js"
		},
		"./server": {
			"types": "./dist/server/index.d.ts",
			"default": "./dist/server/index.js"
		},
		"./styles/light.css": "./styles/prism-light.css"
	}
}
```

Only TS and TSX export targets will be rewritten to `dist`. Non-TS exported files will be copied as-is and left in the export map unchanged.

### Dependency Publishing

The publish script will discover all packages in `packages/*` and build a graph from internal dependencies named `@sdxc/*`.

When publishing a target package, the script will find all internal dependencies recursively, topologically sort them, and process dependencies before dependents.

Generated manifests will rewrite internal workspace ranges to exact published versions:

```json
{
	"dependencies": {
		"@sdxc/result": "26.6.29-a1b2c3f"
	}
}
```

Dependents must be generated after dependency versions are known because their manifests include exact dependency versions.

### Versioning

Published versions will use a date plus artifact hash:

```txt
yy.M.d-<hash>
```

Example:

```txt
26.6.29-a1b2c3f
```

Month and day values are not zero-padded because SemVer numeric identifiers cannot contain leading zeroes.

The hash suffix allows multiple releases on the same day and ties each version to the generated npm artifact.

### Artifact Hashing

The release hash will be computed from the generated npm artifact, not from raw source files.

The hash will include emitted JS, emitted declarations, copied exported assets, generated exports, generated dependency versions, and relevant package metadata.

The hash will exclude fields derived from the hash itself, including `version` and `sdxc.releaseHash`.

Generated manifests will store the full hash:

```json
{
	"sdxc": {
		"releaseHash": "a1b2c3f4..."
	}
}
```

The npm version may use a short hash prefix, while the manifest stores the full hash.

### Reusing Published Versions

Before publishing an artifact, the script will check npm for existing versions of the same package.

If an existing version has the same `sdxc.releaseHash`, the script will reuse that version instead of publishing a new one.

This avoids republishing unchanged packages just because the date changed:

```txt
@sdxc/result was published as 26.6.28-a1b2c3f
@sdxc/result artifact is unchanged on 26.6.29
@sdxc/result remains 26.6.28-a1b2c3f in dependent manifests
```

If the artifact changed, the script will publish a new version using the current date and hash:

```txt
26.6.29-b4c5d6e
```

### Script Interface

The root package will expose a publish command:

```json
{
	"scripts": {
		"publish:package": "bun scripts/publish-package.ts"
	}
}
```

Expected usage:

```bash
bun run publish:package @sdxc/result --dry-run
bun run publish:package @sdxc/markdown --dry-run
bun run publish:package @sdxc/markdown --publish
```

Dry run should be the safe default while developing and validating the script.

The script should print the selected target package, internal dependency order, generated artifact paths, release hashes, reused npm versions, new versions that need publishing, and the final publish plan.

## Consequences

### Positive

- **Publishable scope**: Packages can be published under the available `@sdxc` npm scope.
- **Workspace-friendly**: Apps and packages keep using Bun workspaces during local development.
- **No bundling**: Published packages remain close to source structure and avoid bundler-specific output.
- **Typed packages**: Published artifacts include declaration files.
- **Deterministic reuse**: Unchanged artifacts can reuse existing published versions across days.
- **Dependency correctness**: Published packages depend on exact published versions of internal dependencies.

### Negative

- **More publishing logic**: The custom script must handle graph traversal, emit, manifest generation, hashing, npm lookup, and publishing.
- **Import discipline required**: Relative source imports need `.js` extensions for Node ESM compatibility.
- **Manifest divergence**: Workspace manifests and generated publish manifests intentionally differ, so the rewrite logic must be well tested.
- **Version readability**: Hash-based prerelease versions are less human-readable than simple date-only versions.

### Neutral

- **Temporary artifacts**: Publishing works from generated directories and does not mutate workspace package manifests.
- **Assets are explicit**: Non-TS files are published only when exported, and consumers decide how to handle them.
- **CI can be added later**: The workflow can later move to GitHub Actions without changing the core publishing model.

## Implementation Plan

### Phase 1: Namespace Migration

1. Rename all package names from `@pkg/*` to `@sdxc/*`.
2. Update all workspace dependency references.
3. Update source imports and exports.
4. Update tool aliases, the `create-app` / `create-package` skills, documentation, and rules.
5. Run `bun install`, `bun typecheck`, and relevant tests.

### Phase 2: ESM Import Compatibility

1. Update relative TS and TSX imports in publishable packages to use `.js` extensions.
2. Adjust package TypeScript configs if needed to validate Node ESM-compatible output.
3. Run typechecking for all workspaces.

### Phase 3: Dry-Run Publish Script

1. Add `scripts/publish-package.ts`.
2. Discover packages from `packages/*/package.json`.
3. Build the internal dependency graph.
4. Detect missing packages and dependency cycles.
5. Print the dependency-ordered publish plan without writing publish artifacts.

### Phase 4: Artifact Generation

1. Emit JS and declarations with `tsc` into temporary artifact directories.
2. Copy exported non-TS files as-is.
3. Generate publish manifests with rewritten exports and dependency versions.
4. Validate that no generated manifest contains `private: true` or `workspace:*`.

### Phase 5: Hashing And Reuse

1. Compute artifact hashes from generated package contents.
2. Store the full hash in `sdxc.releaseHash`.
3. Query npm for existing versions with the same hash.
4. Reuse matching versions and print planned new versions for changed artifacts.

### Phase 6: Real Publishing

1. Require an explicit `--publish` flag for real publishing.
2. Publish packages in dependency order.
3. Record the resolved version of every processed package for dependents.
4. Run `npm pack --dry-run` or equivalent before publish.

## Alternatives Considered

### Keep `@pkg/*`

Rejected because the npm scope is not available and the packages cannot be published under that namespace.

### Use A Bundler

Rejected for the initial implementation because the packages do not need bundling. `tsc` can emit JavaScript and declarations while preserving package structure.

### Publish Raw TypeScript

Rejected because npm consumers should not be required to transpile TypeScript from dependencies.

### Date-Only Versions

Rejected because multiple package releases can happen on the same day and because unchanged artifacts should be reusable across days.

### Git Commit Hash Versions

Rejected because the relevant identity is the generated npm artifact, not the repository commit. Different commits can produce the same artifact, and the same commit can produce different artifacts if dependency versions differ.

## Notes

The publish script should validate that every TS or TSX export target maps to emitted JS and declaration files, every non-TS export target exists, generated versions are valid SemVer, and internal dependencies are resolved to exact published versions.
