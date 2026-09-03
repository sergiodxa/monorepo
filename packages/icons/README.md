# @sdxc/icons

[Lucide](https://lucide.dev) icons as `remix/ui` components, mirroring how `lucide-react` exposes icons for React.

## Overview

Lucide ships its raw icon data (SVG tag/attribute pairs, framework-agnostic) through `lucide-static`. This package turns that data into one `remix/ui` component per icon — the same shape as `lucide-react`'s per-icon modules — so each icon is its own importable, tree-shakeable export instead of a single bundle containing all 1700+ icons.

Icons are generated ahead of time by `scripts/generate-icons.ts` and checked into `src/icons/`, rather than resolved at runtime, so consumers get plain `remix/ui` components with no codegen step of their own. Each icon component follows the `Handle<Props>` pattern (see `remix/ui`'s [component docs](https://www.npmjs.com/package/remix)) and renders an `<svg>` with the same defaults, prop names, and `aria-hidden` fallback behavior as `lucide-react`'s `Icon`.

## Usage

### Basic Example

```tsx
import { HeartIcon } from "@sdxc/icons";

function LikeButton() {
	return () => (
		<button>
			<HeartIcon size={16} />
			Like
		</button>
	);
}
```

### Customizing color and stroke width

```tsx
import { CircleAlertIcon } from "@sdxc/icons";

function ErrorBanner() {
	return () => <CircleAlertIcon color="crimson" strokeWidth={1.5} className="banner-icon" />;
}
```

### Accessible icons

By default, icons render with `aria-hidden="true"` since they're usually paired with visible text. Pass an accessible name to make one stand alone:

```tsx
import { TrashIcon } from "@sdxc/icons";

function DeleteButton() {
	return () => (
		<button aria-label="Delete">
			<TrashIcon />
		</button>
	);
}
```

### Rendering an icon by name

When the icon isn't known until runtime — driven by a CMS field, a config value, or user data — use `<Icon name />` instead of importing a specific icon component. `name` is typechecked against every icon in the catalog:

```tsx
import { Icon } from "@sdxc/icons";

function NavLink({ props }: Handle<{ iconName: IconName; label: string }>) {
	return () => (
		<a href="/">
			<Icon name={props.iconName} size={18} />
			{props.label}
		</a>
	);
}
```

`<Icon />` builds the component on demand by calling `createLucideIcon(name, ...)` against the matching entry in a generated `registry.ts`, rather than lazily `import()`-ing icons — see [Why `<Icon />` isn't lazy-loaded](#pattern-why-icon--isnt-lazy-loaded) below for why that's the right tradeoff here.

## API

### `<IconName>Icon`

Every icon in the [Lucide catalog](https://lucide.dev/icons/) is exported as `<PascalCaseName>Icon`, e.g. `activity` → `ActivityIcon`, `circle-alert` → `CircleAlertIcon`.

**Props (`LucideProps`):**

- `size?`: `number | string` - Width and height. Defaults to `24`.
- `color?`: `string` - Stroke color. Defaults to `"currentColor"`.
- `strokeWidth?`: `number | string` - Stroke width in the icon's 24x24 viewBox units. Defaults to `2`.
- `absoluteStrokeWidth?`: `boolean` - When `true`, scales `strokeWidth` against `size` so the rendered stroke stays visually constant across sizes.
- Any other `<svg>` prop (`className`, `mix`, `aria-*`, `style`, etc.) - Passed through to the root `<svg>` element.

**Example:**

```tsx
<ActivityIcon size={32} color="teal" absoluteStrokeWidth />
```

### `Icon`

Renders any Lucide icon by name. Internally, it maps `name` to its export in `registry.ts` via `iconExportNames`, then calls `createLucideIcon(name, node)` to build the component and renders it with the rest of the props.

**Props (`IconProps`):**

- `name`: `IconName` - The icon to render, e.g. `"circle-alert"`. Typechecked against every icon in the catalog.
- Everything from `LucideProps` (`size`, `color`, `strokeWidth`, `absoluteStrokeWidth`, and any other `<svg>` prop) - Forwarded to the resolved icon component.

**Example:**

```tsx
<Icon name="heart" size={16} color="red" />
```

### `iconExportNames`

Maps every icon's public kebab-case name (`"circle-alert"`) to its export name in `registry.ts` (`"circleAlert"`) — a valid `export const` can't contain hyphens, and a handful of names (`"delete"`, `"import"`, `"package"`) also get a `Node` suffix to dodge JS reserved words. Declared `as const`, so indexing it with an `IconName` is fully typechecked with no casts. Exported in case you need to enumerate icon names yourself (e.g. building an icon picker) via `Object.keys(iconExportNames)`.

### `createLucideIcon(iconName: string, iconNode: IconNode): Component`

Builds a `remix/ui` icon component from a Lucide icon name and its node data. Used internally by every generated icon in `src/icons/`; reach for it directly only when adding an icon that Lucide doesn't ship yet.

**Parameters:**

- `iconName`: Lucide's kebab-case icon name (e.g. `"circle-alert"`), used to build the `lucide-<name>` class.
- `iconNode`: The icon's SVG child elements as `[tag, attrs]` tuples, e.g. `[["path", { d: "..." }]]`.

**Returns:**

- A `remix/ui` component that renders the icon as an `<svg>`.

**Example:**

```typescript
import { createLucideIcon } from "@sdxc/icons";

let CustomIcon = createLucideIcon("custom", [["path", { d: "M4 4h16v16H4z" }]]);
```

### Types

#### `IconNode`

```typescript
type IconNode = ReadonlyArray<readonly [tag: string, attrs: Record<string, string | number>]>;
```

#### `LucideProps`

```typescript
interface LucideProps extends Props<"svg"> {
	size?: number | string;
	color?: string;
	strokeWidth?: number | string;
	absoluteStrokeWidth?: boolean;
}
```

#### `IconName`

```typescript
type IconName = keyof typeof iconExportNames; // the union of every Lucide icon name
```

## Pattern: How `<Icon />` stays typesafe with kebab-case names

`registry.ts` has one named export per icon (`export const circleAlert = [...] satisfies IconNode;`) so `src/icons/<name>.ts` can import only the one constant it needs, and so `<Icon />` can `import * as registry from "./registry.js"` and get a fully-typed namespace object back. But a public `name` like `"circle-alert"` can't be used as an export name — hyphens aren't valid in identifiers — so `Icon` looks up the corresponding registry key through `iconExportNames`:

```typescript
let IconComponent = createLucideIcon(name, registry[iconExportNames[name]]);
```

Because `iconExportNames` is declared `as const`, `iconExportNames[name]` resolves to the exact union of registry export names for `name: IconName`, and indexing `registry` with that union typechecks with no casts — TypeScript narrows `registry[iconExportNames[name]]` down to `IconNode` on its own.

## Pattern: Why `<Icon />` isn't lazy-loaded

It's tempting to make `<Icon name />` dynamically `import()` only the requested icon's module, code-splitting the other ~1700 icons out of the bundle. That doesn't work with how `remix/ui` renders on the server: `renderToStream`/`renderToString` call a component's setup function once and read only its returned render output — any work scheduled through `handle.queueTask()` (which is how you'd kick off and await a dynamic import) is discarded rather than awaited, so a lazily-loaded icon would never resolve during SSR and would permanently render whatever fallback you gave it.

`<Icon />` instead keeps `registry.ts` — every icon's raw SVG node data, as plain arrays — always loaded, and calls `createLucideIcon` to build the requested icon's component synchronously on each render. This is the actually-scalable choice for this framework: server-rendered (non-`clientEntry`) components never ship their code to the client at all, so keeping every icon's data in the server's module graph costs nothing in the browser, and the data itself (plain tag/attribute tuples, no component closures) is far lighter than 1700 pre-built components would be.

The one case to avoid: don't render `<Icon name />` inside a `clientEntry`-wrapped component. Since `clientEntry` components _do_ get bundled for the browser, doing so would ship all ~1700 icons' node data to the client for that entry point. Use a specific `<XyzIcon />` import instead inside client-hydrated islands.

## Pattern: Regenerating icons after a `lucide-static` upgrade

Lucide adds and renames icons over time. Bump `lucide-static` in `package.json`, install, then regenerate every icon module from the updated icon data:

```bash
bun install
bun run --cwd packages/icons generate
bun format:fix
```

This clears and rewrites `src/icons/`, `src/registry.ts`, `src/icon-names.ts`, and `src/index.ts` from the currently installed `lucide-static` version — do not hand-edit those files.

## Related Packages

- [`@sdxc/markdown/client`](/packages/markdown) - Renders Markdoc content as `remix/ui` components, the same component model icons use here.

## Tips

1. **Import only what you use** - Each icon is its own module (`sideEffects: false`), so bundlers tree-shake unused icons as long as you import by name from `@sdxc/icons` rather than a wildcard.
2. **Icons are stateless** - `createLucideIcon` never calls `handle.update()`, so an icon's props are read fresh on every render; there's no internal state to worry about.
3. **Don't edit generated files** - Everything under `src/icons/`, `src/registry.ts`, `src/icon-names.ts`, and `src/index.ts` is overwritten by `bun run generate`; add new/custom icons via `createLucideIcon` in your own app code instead.
4. **Prefer a specific `<XyzIcon />` when you know the icon at code time** - `<Icon name />` is for genuinely dynamic, data-driven icon names; a direct import is simpler and reads better everywhere else.
