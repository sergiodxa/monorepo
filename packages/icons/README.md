# @sdxc/icons

[Lucide](https://lucide.dev) icons as `remix/component` components, one tree-shakeable export per
icon.

The icons ship prebuilt, so each one is a plain import and a bundler keeps only the ones you name.
Props and defaults match [`lucide-react`](https://www.npmjs.com/package/lucide-react).

## Installation

```sh
npm add @sdxc/icons
```

The icons render through `remix/component`, from [`remix`](https://www.npmjs.com/package/remix).

## Usage

### Render an icon

Every icon in the [Lucide catalog](https://lucide.dev/icons/) is exported as
`<PascalCaseName>Icon`: `heart` is `HeartIcon`, `circle-alert` is `CircleAlertIcon`.

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

### Set size, color and stroke

```tsx
import { CircleAlertIcon } from "@sdxc/icons";

function ErrorBanner() {
	return () => <CircleAlertIcon size={32} color="crimson" strokeWidth={1.5} className="banner" />;
}
```

`color` defaults to `currentColor`, so an icon follows the surrounding text color. `className` is
added to the `lucide` and `lucide-<name>` classes every icon carries.

### Give an icon an accessible name

An icon renders `aria-hidden="true"`, which suits an icon beside visible text. Pass any `aria-*`
attribute or a `role` and the icon is exposed with that name instead:

```tsx
import { TrashIcon } from "@sdxc/icons";

function DeleteButton() {
	return () => (
		<button>
			<TrashIcon aria-label="Delete" />
		</button>
	);
}
```

### Render an icon chosen at runtime

When the icon comes from data, render `<Icon name />`. `name` is typed as the union of every icon
name, so a misspelling is a compile error:

```tsx
import type { IconName } from "@sdxc/icons";
import type { Handle } from "remix/component";

import { Icon } from "@sdxc/icons";

interface NavLinkProps {
	icon: IconName;
	label: string;
	href: string;
}

function NavLink({ props }: Handle<NavLinkProps>) {
	return () => (
		<a href={props.href}>
			<Icon name={props.icon} size={18} />
			{props.label}
		</a>
	);
}
```

## API

### `<PascalCaseName>Icon`

One component per Lucide icon, each in its own module. It renders an `<svg>` with a 24x24 viewBox,
no fill and round line caps, and accepts `LucideProps`:

- `size`: width and height, default `24`.
- `color`: stroke color, default `"currentColor"`.
- `strokeWidth`: stroke width in viewBox units, default `2`.
- `absoluteStrokeWidth`: scales `strokeWidth` against `size`, so the stroke keeps the same visual
  weight at any size.

Every other `<svg>` prop (`className`, `style`, `aria-*`, `mix`) reaches the root element.
Children render inside the `<svg>` after the icon's own elements, and an icon with children skips
the `aria-hidden` default.

### `Icon`

Renders the icon whose kebab-case name is `name`, forwarding the remaining `LucideProps`. It reaches
the whole catalog's data, so prefer the specific `<XyzIcon>` import wherever the icon is known.

```tsx
<Icon name="heart" size={16} color="red" />
```

### `iconExportNames`

An object keyed by every icon's kebab-case name (`"circle-alert"`); `Object.keys(iconExportNames)`
lists the full catalog.

### `createLucideIcon(iconName: string, iconNode: IconNode)`

Builds an icon component from a kebab-case name and SVG node data, with the same props, defaults
and classes as every shipped icon.

```tsx
let SquareOutlineIcon = createLucideIcon("square-outline", [["path", { d: "M4 4h16v16H4z" }]]);
```

### Types

```typescript
type IconNode = ReadonlyArray<readonly [tag: string, attrs: Record<string, string | number>]>;

interface LucideProps extends Props<"svg"> {
	size?: number | string;
	color?: string;
	strokeWidth?: number | string;
	absoluteStrokeWidth?: boolean;
}

interface IconProps extends LucideProps {
	name: IconName;
}

type IconName = keyof typeof iconExportNames;
```

## Pattern: Building An Icon Picker

`iconExportNames` lists the catalog and `<Icon />` draws any entry of it:

```tsx
import type { IconName } from "@sdxc/icons";
import type { Handle } from "remix/component";

import { Icon, iconExportNames } from "@sdxc/icons";

let names = Object.keys(iconExportNames) as IconName[];

function IconPicker({ props }: Handle<{ query: string }>) {
	return () => (
		<ul>
			{names
				.filter((name) => name.includes(props.query))
				.slice(0, 60)
				.map((name) => (
					<li>
						<button name="icon" value={name}>
							<Icon name={name} size={20} />
							{name}
						</button>
					</li>
				))}
		</ul>
	);
}
```

## Pattern: Validating A Stored Icon Name

An icon name read from a form or a database is a plain string. Validate it against the catalog with
[`remix/data-schema`](https://www.npmjs.com/package/remix) and it becomes an `IconName` that
`<Icon />` accepts:

```tsx
import type { IconName } from "@sdxc/icons";

import { Icon, iconExportNames } from "@sdxc/icons";
import { enum_, parseSafe } from "remix/data-schema";

let IconNameSchema = enum_(Object.keys(iconExportNames) as [IconName, ...IconName[]]);

function renderStoredIcon(value: unknown) {
	let result = parseSafe(IconNameSchema, value);
	if (!result.success) return null;
	return <Icon name={result.value} size={20} />;
}
```

## Pattern: Keeping Icons Out Of The Client Bundle

Server-rendered components never ship to the browser, so `<Icon name />` costs the page nothing
there. Inside a `clientEntry` component, which the browser loads, import the specific icon so the
bundle carries one icon's data:

```tsx
import type { Handle } from "remix/component";

import { HeartIcon } from "@sdxc/icons";
import { clientEntry, on } from "remix/component";

export let LikeButton = clientEntry(
	"/assets/like-button.js#LikeButton",
	function LikeButton(handle: Handle<{ label: string }>) {
		let liked = false;

		return () => (
			<button
				mix={[
					on("click", () => {
						liked = !liked;
						handle.update();
					}),
				]}
			>
				<HeartIcon size={16} color={liked ? "crimson" : "currentColor"} />
				{handle.props.label}
			</button>
		);
	},
);
```

## Pattern: Adding An Icon Lucide Doesn't Ship

A brand mark or product glyph drawn on Lucide's grid (24x24 viewBox, stroke width 2, no fill)
becomes a component that takes `size`, `color` and `strokeWidth` like the rest:

```tsx
import { createLucideIcon, HeartIcon } from "@sdxc/icons";

let SparkIcon = createLucideIcon("spark", [
	["path", { d: "M12 2v6" }],
	["path", { d: "m16 6-4 4-4-4" }],
	["circle", { cx: "12", cy: "16", r: "4" }],
]);

function Toolbar() {
	return () => (
		<nav>
			<SparkIcon size={20} absoluteStrokeWidth />
			<HeartIcon size={20} absoluteStrokeWidth />
		</nav>
	);
}
```

The component carries the `lucide` and `lucide-spark` classes, so stylesheets targeting icons
reach it too.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/icons": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
