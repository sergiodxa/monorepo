/**
 * Merges per-instance declarations into whatever `style` prop a host received.
 * Components that carry a value too dynamic for a hashed `css()` class — a
 * ratio, a hue, a fill percentage — have to write it inline, and the incoming
 * prop may already be either CSS text or a declaration object, so each one
 * would otherwise hand-roll the same two-branch merge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Props } from "remix/ui";

/** The `style` prop an element accepts: CSS text, a declaration object, or nothing. */
export type StyleProp = Props<"div">["style"];

/**
 * Declarations to merge into a host's `style`, keyed by CSS property name.
 * Keys are written exactly as CSS spells them — `--ui-slider-fill`,
 * `view-transition-name` — so the same record serves both prop forms. Entries
 * with no value are dropped rather than emitted as empty declarations.
 */
export type StyleDeclarations = Record<string, string | number | null | undefined>;

/**
 * Merges declarations into a host's `style` prop, preserving the form the prop
 * arrived in: CSS text gains the declarations appended, an object gains them
 * assigned over it. The result never mutates the caller's object, so a prop
 * shared between renders stays untouched.
 *
 * @param style The host's incoming `style` prop, in either form.
 * @param declarations Per-instance declarations to merge in.
 * @returns The merged `style` prop, in the same form as `style`.
 * @example
 * mergeStyle(style, { "--ui-slider-fill": `${fillPercent}%` })
 * @example
 * mergeStyle(style, { "--ui-resizable-panel-size": size == null ? null : `${size}%` })
 */
export function mergeStyle(style: StyleProp, declarations: StyleDeclarations): StyleProp {
	let present = Object.entries(declarations).filter(([, value]) => value != null);

	if (typeof style === "string") {
		return [style, ...present.map(([name, value]) => `${name}:${value}`)].filter(Boolean).join(";");
	}

	// `Object.assign` rather than a spread: `remix/ui` derives its style type
	// from `keyof CSSStyleDeclaration`, so the type carries a `Symbol.iterator`
	// key whose value type is `string | number | null | undefined`. The object is
	// never iterable at runtime, but a spread of a type holding that key reads as
	// spreading an iterable to every type-level iterability check.
	return Object.assign({}, style, Object.fromEntries(present));
}
