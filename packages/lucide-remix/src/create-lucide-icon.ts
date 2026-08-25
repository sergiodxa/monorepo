/**
 * Shared factory that turns Lucide's framework-agnostic icon data into a
 * `remix/ui` component, so every generated icon in `src/icons/*` stays a
 * one-line call that reuses this module's `<svg>` rendering logic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props } from "remix/ui";

import { createElement } from "remix/ui";

/**
 * A single primitive drawing instruction from Lucide's icon data — an SVG tag
 * name paired with the attributes to render on it, e.g. `["path", { d: "..." }]`.
 */
export type IconNode = ReadonlyArray<
	readonly [tag: string, attrs: Record<string, string | number>]
>;

/**
 * Props accepted by every Lucide icon component. Extends the standard
 * `<svg>` props so any DOM attribute or `mix` still passes through untouched.
 */
export interface LucideProps extends Props<"svg"> {
	/** Width and height in pixels, or any CSS size unit. Defaults to 24. */
	size?: number | string;
	/** Stroke color. Defaults to `currentColor`. */
	color?: string;
	/** Stroke width, in the icon's 24x24 viewBox units. Defaults to 2. */
	strokeWidth?: number | string;
	/**
	 * When true, scales `strokeWidth` against `size` so the rendered stroke
	 * stays visually constant across icons rendered at different sizes.
	 */
	absoluteStrokeWidth?: boolean;
}

const DEFAULT_ATTRIBUTES = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round",
} as const;

/**
 * Builds a `remix/ui` icon component from a Lucide icon name and its node
 * data, matching `lucide-react`'s `createLucideIcon` prop contract: size,
 * color, and strokeWidth props, plus auto `aria-hidden` when no accessible name is given.
 *
 * @param iconName Lucide's kebab-case icon name (e.g. `"circle-alert"`), used for the `lucide-<name>` class.
 * @param iconNode The icon's SVG child elements as `[tag, attrs]` tuples.
 * @returns A `remix/ui` component that renders the icon as an `<svg>`.
 */
export function createLucideIcon(iconName: string, iconNode: IconNode) {
	function LucideIcon({ props }: Handle<LucideProps>) {
		return () => {
			let { size, color, strokeWidth, absoluteStrokeWidth, className, children, ...rest } = props;

			let resolvedSize = size ?? DEFAULT_ATTRIBUTES.width;
			let resolvedStrokeWidth = strokeWidth ?? DEFAULT_ATTRIBUTES.strokeWidth;
			let calculatedStrokeWidth = absoluteStrokeWidth
				? (Number(resolvedStrokeWidth) * 24) / Number(resolvedSize)
				: resolvedStrokeWidth;

			return createElement(
				"svg",
				{
					...DEFAULT_ATTRIBUTES,
					width: resolvedSize,
					height: resolvedSize,
					stroke: color ?? DEFAULT_ATTRIBUTES.stroke,
					strokeWidth: calculatedStrokeWidth,
					className: ["lucide", `lucide-${iconName}`, className].filter(Boolean).join(" "),
					...(!children && !hasA11yProp(rest) ? { "aria-hidden": "true" } : {}),
					...rest,
				},
				...iconNode.map(([tag, attrs]) => createElement(tag, attrs)),
				...(children ? [children] : []),
			);
		};
	}

	Object.defineProperty(LucideIcon, "name", { value: `${toPascalCase(iconName)}Icon` });

	return LucideIcon;
}

/** Checks whether an accessible name (an `aria-*` attribute or `role`) is present among the icon's remaining props. */
function hasA11yProp(props: Record<string, unknown>) {
	for (let key in props) {
		if (key === "role" || key.startsWith("aria-")) return true;
	}
	return false;
}

/** Converts a kebab-case icon name (e.g. `"circle-alert"`) into PascalCase (e.g. `"CircleAlert"`). */
function toPascalCase(iconName: string) {
	return iconName
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}
