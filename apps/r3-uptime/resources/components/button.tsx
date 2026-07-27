/**
 * Shared "click to submit/navigate" button styling — solid/outline/ghost variants
 * across primary/neutral/danger colors and sm/md/lg sizes, matching `@pkg/ui`'s
 * `Button` API (`color`/`variant`/`size`). Exists so every submit, secondary, and
 * destructive button shares one definition instead of each view hand-rolling the
 * same `css({...})` block, as most views did before this component existed. Use
 * {@link LinkButton} for an `<a>` styled the same way; leave tabs, popover
 * triggers, and other non-submit affordances alone.
 *
 * Internally composes `@pkg/r3-ui`'s own `Button`, restricted to this app's
 * three-color palette (`primary`/`neutral`/`danger` — no `success`/`warning`)
 * so every call site keeps its existing prop shape while picking up r3-ui's
 * `data-color`/`data-variant`/`data-size` styling, focus ring, and (unused
 * here, but now available for free) `isPending` busy state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { Button as UIButton } from "@pkg/r3-ui";

export type ButtonColor = "brand" | "neutral" | "danger";
export type ButtonVariant = "solid" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

namespace Button {
	export interface Props extends TagProps<"button"> {
		color?: ButtonColor;
		variant?: ButtonVariant;
		size?: ButtonSize;
	}
}

/** Renders a `<button>` in one of nine color/variant combinations, at one of three sizes, through `@pkg/r3-ui`'s `Button`. */
export default function Button(handle: Handle<Button.Props>) {
	return () => {
		let { color, variant, size, mix, ...rest } = handle.props;

		return <UIButton {...rest} color={color} variant={variant} size={size} mix={mix} />;
	};
}
