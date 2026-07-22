/**
 * `<a>` styled identically to {@link Button} for navigation actions that should
 * look like a button (e.g. "Create monitor", "Cancel" out of a form). Shares
 * {@link Button}'s `color`/`variant`/`size` API by composing `@pkg/r3-ui`'s own
 * `LinkButton` internally, which already shares its styling with `@pkg/r3-ui`'s
 * `Button` pixel for pixel, so the two never drift apart visually.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { LinkButton as UILinkButton } from "@pkg/r3-ui";

import type { ButtonColor, ButtonSize, ButtonVariant } from "~/resources/components/button";

namespace LinkButton {
	/** `type`, not `interface`: `TagProps<"a">` is an intersection TS can't `extend`. */
	export type Props = TagProps<"a"> & {
		href: string;
		color?: ButtonColor;
		variant?: ButtonVariant;
		size?: ButtonSize;
	};
}

/** Renders an `<a>` in one of nine color/variant combinations, at one of three sizes, through `@pkg/r3-ui`'s `LinkButton`. */
export default function LinkButton(handle: Handle<LinkButton.Props>) {
	return () => {
		let { color, variant, size, mix, ...rest } = handle.props;

		return <UILinkButton {...rest} color={color} variant={variant} size={size} mix={mix} />;
	};
}
