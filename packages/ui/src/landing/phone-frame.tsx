/**
 * Hardware chrome for a phone screenshot or live screen on a landing: an ink bezel in the
 * proportions of a tall capture, and the screen's rounded corners, at the width the column
 * gives it. Pair with {@link PhoneFan} when several screens share a stage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { raw, mergeMix } from "@sdxc/u/general";
import { is, p } from "@sdxc/u/size";

/** Fallback ink when the page has not set `--app-bezel`. */
const DEFAULT_BEZEL = "#161412";

/**
 * Prop types for {@link PhoneFrame}.
 */
export namespace PhoneFrame {
	/**
	 * Props accepted by {@link PhoneFrame}.
	 */
	export interface Props extends TagProps<"div"> {
		/**
		 * Bezel fill. Defaults to `var(--app-bezel)` so a page can paint every phone from one
		 * token, then to {@link DEFAULT_BEZEL} when that token is unset.
		 */
		bezel?: string;
		/** The screen: a capture, a `picture`, or live UI, clipped with {@link screenCorners}. */
		children: RemixNode;
	}
}

/**
 * The bezel around a phone screen. The capture carries its own status bar, so the frame
 * adds only the hardware rim.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the bezel.
 * @example
 * <PhoneFrame bezel="#1a0830">
 * 	<img src={shot} alt={t("phone.alt")} mix={[screenCorners()]} />
 * </PhoneFrame>
 */
export function PhoneFrame(handle: Handle<PhoneFrame.Props>) {
	return () => {
		let { bezel, children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="phone-frame"
				mix={mergeMix(
					[
						is("full"),
						p(1.5),
						raw({
							backgroundColor: bezel ?? `var(--app-bezel, ${DEFAULT_BEZEL})`,
							borderRadius: "15% / 7%",
							boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)",
						}),
					],
					mix,
				)}
			>
				{children}
			</div>
		);
	};
}

/**
 * The corners of the screen inside a {@link PhoneFrame}, for the element that holds the
 * capture, so the picture itself clips and the bezel hugs it.
 *
 * @returns A `css()` mixin for the screen element.
 * @example
 * <img src={shot} alt="" mix={[screenCorners()]} />
 */
export function screenCorners() {
	return raw({ overflow: "hidden", borderRadius: "12.5% / 5.8%" });
}
