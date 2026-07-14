/**
 * `<a>` styled identically to {@link Button} for navigation actions that should
 * look like a button (e.g. "Create monitor", "Cancel" out of a form). Shares
 * {@link Button}'s `color`/`variant`/`size` API and CSS mixins so the two never
 * drift apart visually.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as ElementProps } from "remix/ui";

import type { ButtonColor, ButtonSize, ButtonVariant } from "~/resources/components/button";

import { buttonBase, buttonSizeMix, buttonVariantMix } from "~/resources/components/button";

namespace LinkButton {
	/** `type`, not `interface`: `ElementProps<"a">` is an intersection TS can't `extend`. */
	export type Props = ElementProps<"a"> & {
		href: string;
		color?: ButtonColor;
		variant?: ButtonVariant;
		size?: ButtonSize;
	};
}

/** Renders an `<a>` in one of nine color/variant combinations, at one of three sizes. */
export default function LinkButton(handle: Handle<LinkButton.Props>) {
	return () => {
		let { color = "neutral", variant = "solid", size = "md", mix = [], ...rest } = handle.props;

		return (
			<a
				{...rest}
				mix={[buttonBase, buttonSizeMix[size], buttonVariantMix[variant][color], ...mix]}
			/>
		);
	};
}
