/**
 * The phone an app landing frames a screenshot in: an ink bezel in the proportions of a
 * 560 × 1218 capture, and the screen's rounded corners, at whatever width the column gives
 * it. The capture carries its own status bar, so the frame adds only the hardware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { is, p } from "@sdxc/u/size";

/**
 * The bezel around a screen, painted in the page's `--app-bezel`.
 *
 * @param handle Runtime handle carrying the screen, which clips itself with {@link screenCorners}.
 * @returns The render function producing the bezel.
 */
export function PhoneFrame(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<div
			mix={[
				is("full"),
				p(1.5),
				raw({
					backgroundColor: "var(--app-bezel)",
					borderRadius: "15% / 7%",
					boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)",
				}),
			]}
		>
			{handle.props.children}
		</div>
	);
}

/**
 * The corners of the screen inside a {@link PhoneFrame}, for the element that holds the
 * capture, so the picture itself clips and the bezel hugs it.
 */
export function screenCorners() {
	return raw({ overflow: "hidden", borderRadius: "12.5% / 5.8%" });
}
