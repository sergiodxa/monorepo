---
name: sdxc-icons
description: "@sdxc/icons ships the whole Lucide catalog as `remix/ui` components, one tree-shakeable `<PascalCaseName>Icon` export per icon, plus `<Icon name />` for a name chosen at runtime, the `IconName` union, `iconExportNames` and `createLucideIcon`. Use when adding an icon to a `remix/ui` component, rendering an icon stored as data, building an icon picker, labelling an icon for assistive technology, or drawing a glyph Lucide does not ship."
---

# @sdxc/icons

Lucide publishes its icons as framework-agnostic data; this package turns that data into `remix/ui` components ahead of time, so an icon is a plain import with no codegen step of your own and a bundler drops the ~1700 icons you never name. Every icon in the catalog is exported as `<PascalCaseName>Icon`, `<Icon name />` resolves one at runtime against the `IconName` union, and `createLucideIcon` builds a component of your own with the same props, defaults and classes. The prop contract matches `lucide-react`: the same defaults, the same prop names, the same `aria-hidden` fallback.

Full API, options and examples: [packages/icons/README.md](packages/icons/README.md)

## When to reach for it

- Putting an icon beside a label in a `remix/ui` component.
- Rendering an icon whose name arrives as data — a content field, a config value, a database row — with the name typed so a misspelling is a compile error.
- Building an icon picker, or validating a stored icon name against the catalog.
- Giving an icon its own accessible name, or keeping it out of the accessibility tree beside visible text.
- Adding a brand mark or product glyph that sits beside Lucide icons without a second set of rules.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/icons": "workspace:*" } }
```

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

`activity` is `ActivityIcon` and `circle-alert` is `CircleAlertIcon`.

## Suggestions

- `<Icon name />` reaches the whole catalog's data because it resolves a name that only exists at render time. Server-rendered components never ship their code to the browser, so that costs the page nothing — but inside a `clientEntry` island, import the specific icon, which carries one icon's data. An island that genuinely needs a data-driven icon can take the resolved component as a prop from its server-rendered parent.
- An icon renders with `aria-hidden="true"`, which is what you want beside visible text. Any `aria-*` attribute or a `role` replaces that fallback, so `aria-label="Delete"` is how an icon-only button gets its name.
- `color` sets the stroke and defaults to `currentColor`, so an icon inherits the surrounding text color until you say otherwise. A `className` is appended to the `lucide` and `lucide-<name>` classes the icon always carries, rather than replacing them.
- `absoluteStrokeWidth` scales `strokeWidth` against `size`, which keeps a stroke visually the same weight across icons rendered at different sizes.
- `Object.keys(iconExportNames)` is the full catalog, and the same keys are what a stored icon name validates against, so a value round-trips from a picker through a database and back into `<Icon name />`.
- Draw a custom icon's paths against a 24x24 viewBox with a stroke width of 2 and no fill — the geometry every Lucide icon is authored in — so it scales with the rest.
- Children render inside the `<svg>` after the icon's own elements, which is where an extra `<title>` or decoration belongs.

## Related

- `@sdxc/ui` — depends on this package and renders its icons inside components such as the combobox and date picker; skill `sdxc-ui`
