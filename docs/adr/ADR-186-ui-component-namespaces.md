# ADR-186: `@sdxc/ui` Ships General Components at the Root and Domain Kits as Namespaces

## Status

**Accepted** - 2026-10-31. Supersedes [ADR-185](./ADR-185-landing-components-stay-in-patterns.md).

## Background

`@sdxc/ui` grew two domain kits on top of its general components in two days: landing pages and
documentation. The landing kit lived in `@sdxc/ui/patterns` with a few band primitives on the root
catalog; the docs kit landed 20 components on the root and 3 in `patterns`. The root also held
components only an application uses (chat, colour editing, charts and data tables). The root no
longer said "usable anywhere", and `patterns` mixed two audiences under a name that described
neither.

ADR-185 had kept landing pieces in `patterns` to avoid renaming imports. The user reversed it:
the root is reserved for general components, and each domain gets its own namespace.

## Context

- Every root component was already importable on its own (`"./*": "./src/components/*.tsx"`),
  which is how islands load (`@sdxc/ui/dialog-dismiss`). `patterns` had no per-file subpath.
- `@sdxc/u` already ships the target shape: a barrel per family plus `./<family>/*` per module.
- Larger libraries split the same way: Mantine has a general core and domain packages
  (`dates`, `charts`, `notifications`); MUI moves domains into `@mui/x-*`; Fumadocs exposes
  `fumadocs-ui/components/*` and `fumadocs-ui/layouts/*`.
- Helper modules (mixins, behaviors, styles, animations, utils) were shared subpaths, yet many
  existed for one domain only (`tocSpy`, `chartTooltip`, the colour-drag mixins, the `marketing`
  styles).
- "Marketing" named the landing kit's tokens, styles and two components, while every page they
  build is a landing, and the skill, the hero and the catalogue page already said "landing".

## Decision

1. **The root `@sdxc/ui` holds general components**, usable on any page: primitives, forms,
   overlays, navigation, typography, `Sidebar`. Each is importable as `@sdxc/ui/<component>`.
2. **Domain kits are namespaces**, each a folder `src/<namespace>/` exported as a barrel
   `@sdxc/ui/<namespace>` and per module as `@sdxc/ui/<namespace>/<module>`:
   - `landing`: landing-page bands, composition craft and animated visuals (formerly `patterns`,
     plus `CtaGroup`, `Feature`, `LogoCloud`, `LandingHeader`, `LandingSection`, `Split`,
     `StatStrip` from the root).
   - `docs`: the documentation shell, navigation and content blocks.
   - `chat`: `Message`, `MessageScroller`, `Bubble`, `Marker`, `Attachment`.
   - `color`: the colour pickers, fields, sliders, swatches, area and wheel.
   - `app`: dashboard and workspace components (`Chart`, `Table`, `GridList`, `Tree`, `Empty`,
     `Skeleton`, `Toast`, `Toolbar`, `Menubar`, `ContextMenu`, `Resizable`, `DropIndicator`,
     `ShortcutList`, `DropZone`, `FileTrigger`).
3. **Namespaces build on the root and never on each other.** A component two namespaces need
   moves to the root.
4. **Helpers follow their only consumer.** A mixin, behavior, style, animation or util used by one
   namespace lives in that namespace's folder and ships from its barrel; one used by the root or by
   two namespaces stays in the shared subpaths (`mixins`, `behaviors`, `styles`, `animations`,
   `utils`), which also gain per-module subpaths (`@sdxc/ui/mixins/<module>`).
5. **Marketing is renamed Landing** everywhere it names the landing kit: components
   (`LandingSection`, `LandingHeader`), styles (`landingContainer`, `landingCtaChrome`, the
   `landing` style module), and tokens (`--ui-landing-*`).
6. **`patterns` is removed** with no alias; there are no compatibility shims.
7. **No module may share a name with a namespace or helper subpath**, since they share the
   `@sdxc/ui/<name>` space; a test enforces it.
8. **An island's specifier is its module path**: `@sdxc/ui/<module>` at the root,
   `@sdxc/ui/<namespace>/<module>` inside a namespace.

## Consequences

- Every import of `@sdxc/ui/patterns`, of a moved root component, of a moved helper and of a
  `marketing*` name changes; the breaking release lists each step, and the apps move in the same
  round.
- The sdxc.dev catalogue groups its sidebar by namespace, and the `sdxc ui` registry and the
  release build read every namespace folder, not only `src/components`.
- A new domain kit (a future article kit, for example) is a new folder and two export entries,
  with no change to the others.
- The root stays small enough that "import from `@sdxc/ui`" means "safe on any page".

## Alternatives Considered

- **Keep `patterns` and only move the docs pieces out** (ADR-185's direction): leaves the root
  mixing general and app-only components, and the next kit faces the same question.
- **`@sdxc/ui/marketing`**: names a broader activity than the pages these pieces build.
- **Rename `mixins` to `mix`**: `mix` takes `@sdxc/u` utilities, `css()` and style mixins too, so
  the name would not say these are the behaviour mixins; the other helper subpaths are plural
  nouns naming the kind of module.
- **A `sidebar` namespace**: one compound component gains nothing from a namespace, and the docs
  kit builds on it, so it stays general.
- **One package per kit**: one version and one theme across kits matter more than independent
  releases.
