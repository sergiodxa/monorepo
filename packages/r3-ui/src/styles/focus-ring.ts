/**
 * Focus-visible ring mixin factories a component composes directly in its
 * own `mix` array: {@link focusRingPrimary} for the shared primary-color
 * ring, and {@link focusRingByColor} for a ring that reads a host's own
 * `data-color` attribute and rings in that same semantic color. Each
 * declares a `2px` solid outline offset `2px` from the host under a `when`
 * selector defaulting to `"&:focus-visible"`, alongside whatever `css()`
 * call carries that host's own remaining styling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

import type { CSSStyles } from "../utils/css-styles";

/**
 * Options accepted by {@link focusRingPrimary}.
 */
export namespace FocusRingPrimary {
	export interface Options {
		/**
		 * A selector, relative to the host (e.g. `"&:has(:focus-visible)"`),
		 * under which the ring's four properties are declared. Defaults to
		 * `"&:focus-visible"` for a host that carries its own focus state
		 * directly; a wrapper whose ring only surfaces through a descendant
		 * control passes its own gating selector instead — `"&:focus-within"`
		 * for a group reading a plain child's focus, `"&:has(:focus-visible)"`
		 * or `"&:has(input:focus-visible)"` for one reading a specific
		 * descendant's focus-visible state through `:has()`.
		 */
		when?: string;
	}
}

/** Default selector {@link focusRingPrimary} declares its ring under. */
const DEFAULT_WHEN = "&:focus-visible";

/**
 * Composes the shared primary-color focus-visible ring as its own `css()`
 * mixin: a `2px` solid outline offset `2px` from the host, colored by the
 * shared primary ring variable. Every field lives under the `when` selector
 * (`"&:focus-visible"` by default), so a component composes this alongside
 * its own `css()` call carrying whatever remaining hover, disabled, or
 * sizing declarations are genuinely local to it.
 *
 * @param options Which selector the ring's properties are declared under.
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <button mix={[focusRingPrimary(), css({ color: "var(--ui-neutral-fg)" })]} />;
 * @example
 * // A wrapper whose ring only surfaces through a descendant control's own
 * // focus-visible state.
 * <div
 * 	mix={[
 * 		focusRingPrimary({ when: "&:has(input:focus-visible)" }),
 * 		css({ display: "flex", alignItems: "center" }),
 * 	]}
 * />;
 */
export function focusRingPrimary<Node extends Element = Element>(
	options: FocusRingPrimary.Options = {},
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	let when = options.when ?? DEFAULT_WHEN;

	let declarations: CSSStyles = {};
	declarations[when] = {
		outlineWidth: "2px",
		outlineStyle: "solid",
		outlineOffset: "2px",
		outlineColor: "var(--ui-primary-ring)",
	};

	return css<Node>(declarations);
}

/**
 * Options accepted by {@link focusRingByColor}.
 */
export namespace FocusRingByColor {
	export interface Options {
		/**
		 * A selector, relative to the host (e.g. `"&:has(:focus-visible)"`),
		 * under which the ring's properties are declared. Defaults to
		 * `"&:focus-visible"` for a host that carries its own focus state
		 * directly; a wrapper whose ring only surfaces through a descendant
		 * control passes its own gating selector instead — `"&:focus-within"`
		 * for a group reading a plain child's focus, `"&:has(:focus-visible)"`
		 * or `"&:has(input:focus-visible)"` for one reading a specific
		 * descendant's focus-visible state through `:has()`.
		 */
		when?: string;
	}
}

/**
 * Composes the focus-visible ring mixin colored by a host's own `data-color`
 * attribute: the same `2px` solid outline {@link focusRingPrimary} declares,
 * read in the shared primary ring variable by default and swapped to each
 * remaining semantic color role's own ring variable once the host carries a
 * matching `data-color` attribute, so a keyboard focus ring always reads in
 * the control's own semantic color. Every property lives under the `when`
 * selector (`"&:focus-visible"` by default), the same way
 * {@link focusRingPrimary} declares its own, so a component composes this
 * alongside its own `css()` call carrying whatever remaining hover, disabled,
 * or sizing declarations are genuinely local to it.
 *
 * @param options Which selector the ring's properties are declared under.
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <button
 * 	data-color={resolvedColor}
 * 	mix={[focusRingByColor(), css({ color: "var(--ui-neutral-fg)" })]}
 * />;
 * @example
 * // A wrapper whose ring only surfaces through a descendant control's own
 * // focus-visible state.
 * <div
 * 	data-color={resolvedColor}
 * 	mix={[
 * 		focusRingByColor({ when: "&:has(input:focus-visible)" }),
 * 		css({ display: "flex", alignItems: "center" }),
 * 	]}
 * />;
 */
export function focusRingByColor<Node extends Element = Element>(
	options: FocusRingByColor.Options = {},
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	let when = options.when ?? DEFAULT_WHEN;

	let declarations: CSSStyles = {};
	declarations[when] = {
		outlineWidth: "2px",
		outlineStyle: "solid",
		outlineOffset: "2px",
		outlineColor: "var(--ui-primary-ring)",
		'&[data-color="neutral"]': { outlineColor: "var(--ui-neutral-ring)" },
		'&[data-color="success"]': { outlineColor: "var(--ui-success-ring)" },
		'&[data-color="warning"]': { outlineColor: "var(--ui-warning-ring)" },
		'&[data-color="danger"]': { outlineColor: "var(--ui-danger-ring)" },
	};

	return css<Node>(declarations);
}
