# ADR-045: Icons Package Rename

## Status

**Implemented** - 2026-09-03

## Background

`@pkg/lucide-remix` generated Remix UI icon components from `lucide-static`'s SVG source and exported them as `Icon`, `IconName`, and one named component per icon (`ChevronDownIcon`, `PlusIcon`, and so on). It was consumed by `@pkg/ui` (its only runtime dependency besides `remix`, per [ADR-014](./ADR-014-r3-ui-component-library-on-remix-ui.md)) and directly by `apps/uptime` and `apps/r3-gallery`.

## Context

Lucide is where the SVG source comes from, not what the package is for. Every consumer imported it to get an icon component, never to reach anything Lucide-specific, so the name tied the package to a swappable implementation detail rather than the role it plays.

## Decision

Rename `@pkg/lucide-remix` to `@pkg/icons`. The directory moved to `packages/icons`, and the public API is unchanged: `Icon`, `IconName`, and every generated `*Icon` component keep their names.

### Files updated

**Package identity**

- `packages/lucide-remix/` → `packages/icons/` (directory move)
- `packages/icons/package.json` - `name` field
- `packages/icons/src/index.ts` - header comment
- `packages/icons/scripts/generate-icons.ts` - generated header comment (so future codegen runs emit the new name)
- `packages/icons/README.md` - package README

**`package.json` dependency declarations** (`"@pkg/lucide-remix": "workspace:*"` → `"@pkg/icons": "workspace:*"`)

- [apps/r3-gallery/package.json](../../apps/r3-gallery/package.json)
- [apps/uptime/package.json](../../apps/uptime/package.json)
- [packages/ui/package.json](../../packages/ui/package.json)
- `bun.lock` regenerated from these via `bun install`

**Import specifiers** (`from "@pkg/lucide-remix"` → `from "@pkg/icons"`), 57 sites across:

- [apps/r3-gallery/src/views/album.tsx](../../apps/r3-gallery/src/views/album.tsx)
- 27 files under [apps/uptime/app/http/controllers/](../../apps/uptime/app/http/controllers/) and [apps/uptime/resources/](../../apps/uptime/resources/) (controllers, components, layouts, and `resources/content/marketing.ts`)
- 17 files under [packages/ui/src/components/](../../packages/ui/src/components/)

**Prose references** (name mentioned in text, not imported)

- [README.md](../../README.md) - package table row (moved to sit between `i18n` and `iife`) and the `@types/node` / `lucide-static` consumer lists
- [packages/ui/AGENTS.md](../../packages/ui/AGENTS.md) - "only dependencies" statements
- [packages/ui/README.md](../../packages/ui/README.md) - dependencies sentence

## Consequences

### Positive

- **The name says what the package is for** - importing icons, not importing Lucide specifically. A future switch of icon source data would not need a second rename.
- **Consistent with prior renames** - matches the reasoning in [ADR-032](./ADR-032-kv-cache-package-rename.md): each package name should say what it does, not an implementation detail behind it.

### Negative

- **Earlier ADRs refer to the old name** - [ADR-014](./ADR-014-r3-ui-component-library-on-remix-ui.md) and [docs/adr/r3-auth/ADR-001](./r3-auth/ADR-001-port-auth-to-remix-v3.md) describe the package as `@pkg/lucide-remix`, which is what it was called when those decisions were made. Left as written, per the same convention ADR-032 follows.

### Neutral

- **No API change** - `Icon`, `IconName`, and every generated `*Icon` component keep their names; only the import specifier changed.

## Notes

- Historical ADRs keep the name they were written with, since they record what was decided at the time. This ADR is the pointer from the old name to the new one.
