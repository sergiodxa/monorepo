# @sdxc/icons

[Lucide](https://lucide.dev) icons as `remix/ui` components, one tree-shakeable export per
icon.

Lucide publishes its icons as framework-agnostic data — a list of SVG tag and attribute
pairs per icon. This package turns that data into components ahead of time and ships them,
so an icon is a plain import with no codegen step of your own, and a bundler drops the ~1700
icons you never name. The prop contract matches
[`lucide-react`](https://www.npmjs.com/package/lucide-react): the same defaults, the same
prop names, the same `aria-hidden` fallback.

## Installation

```bash
npm add @sdxc/icons
```

Every icon is a `remix/ui` component, so [`remix`](https://www.npmjs.com/package/remix)
installs alongside this package and renders them.

## Usage

### Render An Icon

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

Every icon in the [Lucide catalog](https://lucide.dev/icons/) is exported as
`<PascalCaseName>Icon`, so `activity` is `ActivityIcon` and `circle-alert` is
`CircleAlertIcon`.

### Size, Color And Stroke

```tsx
import { CircleAlertIcon } from "@sdxc/icons";

function ErrorBanner() {
	return () => <CircleAlertIcon size={32} color="crimson" strokeWidth={1.5} className="banner" />;
}
```

`color` sets the stroke and defaults to `currentColor`, so an icon inherits the surrounding
text color until you say otherwise. A `className` is appended to the `lucide` and
`lucide-<name>` classes the icon always carries.

### Name An Icon For Assistive Technology

An icon renders with `aria-hidden="true"`, which is what you want beside visible text. An
`aria-*` attribute or a `role` replaces that fallback and gives the icon its own name:

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

### Render An Icon Chosen At Runtime

When the icon arrives as data — a content field, a config value, a row in a database — render
`<Icon name />`. The `name` prop is typed as the union of every icon in the catalog, so a
misspelling is a compile error:

```tsx
import type { IconName } from "@sdxc/icons";
import type { Handle } from "remix/ui";

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

One component per Lucide icon, each its own module. It renders a 24x24 `<svg>` with Lucide's
default attributes and the icon's own elements inside.

Props, as `LucideProps`:

- `size?`: `number | string` — width and height, defaulting to `24`.
- `color?`: `string` — stroke color, defaulting to `"currentColor"`.
- `strokeWidth?`: `number | string` — stroke width in the 24x24 viewBox's units, defaulting
  to `2`.
- `absoluteStrokeWidth?`: `boolean` — scales `strokeWidth` against `size`, so a stroke stays
  visually the same weight across icons rendered at different sizes.
- Every other `<svg>` prop — `className`, `style`, `aria-*`, `mix` — reaches the root
  element untouched.

```tsx
<ActivityIcon size={32} color="teal" absoluteStrokeWidth />
```

Children render inside the `<svg>`, after the icon's own elements, which is where an extra
`<title>` or decoration belongs.

### `Icon`

Renders the icon matching `name` and forwards the rest of its props to it. `IconProps` is
`LucideProps` plus `name: IconName`.

```tsx
<Icon name="heart" size={16} color="red" />
```

### `iconExportNames`

An object mapping every icon's kebab-case name (`"circle-alert"`) to the identifier its data
is stored under (`"circleAlert"`). `Object.keys(iconExportNames)` is the full catalog, which
is what an icon picker enumerates.

### `createLucideIcon(iconName: string, iconNode: IconNode): Component`

Builds an icon component from a name and its SVG node data, giving a drawing of your own the
same props, defaults and classes as every shipped icon.

```typescript
import { createLucideIcon } from "@sdxc/icons";

let CustomIcon = createLucideIcon("custom", [["path", { d: "M4 4h16v16H4z" }]]);
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

/** The union of every Lucide icon name. */
type IconName = keyof typeof iconExportNames;
```

## Pattern: Building An Icon Picker

`iconExportNames` carries the catalog and `<Icon />` renders any entry of it, so a picker is
a list of keys and one component:

```tsx
import type { IconName } from "@sdxc/icons";
import type { Handle } from "remix/ui";

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
						<button value={name}>
							<Icon name={name} size={20} />
							{name}
						</button>
					</li>
				))}
		</ul>
	);
}
```

The same keys are what a stored icon name validates against, so a value round-trips from the
picker through your database and back into `<Icon name />`.

## Pattern: Keeping Icons Out Of The Client Bundle

`<Icon />` reaches the whole catalog's data, because it resolves a name that only exists at
render time. Server-rendered components never ship their code to the browser, so that
catalog costs the page nothing: `<Icon name />` is the right call anywhere the server draws
the markup.

A component wrapped in `clientEntry` is bundled for the browser, and there the specific
import is what you want — it carries one icon's data:

```tsx
import type { Handle } from "remix/ui";

import { HeartIcon } from "@sdxc/icons";
import { clientEntry, on } from "remix/ui";

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

An island that genuinely needs a data-driven icon can take the resolved component as a prop
from its server-rendered parent, which keeps the choice on the server and the bundle at one
icon.

## Pattern: Adding An Icon Lucide Doesn't Ship

A brand mark or a product glyph becomes a component through the same factory the catalog
uses, so it accepts `size`, `color` and `strokeWidth` and sits beside Lucide icons without a
second set of rules:

```tsx
import { createLucideIcon } from "@sdxc/icons";

export let SparkIcon = createLucideIcon("spark", [
	["path", { d: "M12 2v6" }],
	["path", { d: "m16 6-4 4-4-4" }],
	["circle", { cx: "12", cy: "16", r: "4" }],
]);
```

Draw the paths against a 24x24 viewBox with a stroke width of 2 and no fill, the geometry
every Lucide icon is authored in, and the icon scales with the rest of them.

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
