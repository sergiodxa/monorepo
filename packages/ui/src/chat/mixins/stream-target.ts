/**
 * Styles for a reply that streams in with `revealStream()`: a block the text has not reached
 * stays out of the layout, and a reply still pending is unpainted while scripts run and
 * motion is allowed, so the finished text never flashes before its replay starts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { media } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import { STREAM_HIDDEN_ATTRIBUTE, STREAM_PENDING_ATTRIBUTE } from "./reveal-stream.js";

/** The keyframes that paint a pending reply after all when its script never arrives. */
const FALLBACK_KEYFRAMES = "ui-stream-target-fallback";

/** How long a pending reply waits for its replay before it shows whole. */
const FALLBACK_DELAY = "2.5s";

/**
 * Put on the element a reply streams into, the one carrying `data-stream-pending`. Without
 * scripts, or under reduced motion, the reply shows whole at once; with them it waits for
 * the replay, and shows whole after {@link FALLBACK_DELAY} if the replay never starts.
 *
 * @returns The mixins to spread into the reply's `mix`.
 * @example <div id="reply-7" data-stream-pending mix={[streamTarget()]}>…</div>
 */
export function streamTarget() {
	return [
		keyframes(FALLBACK_KEYFRAMES, { to: { visibility: "visible" } }),
		when(`& [${STREAM_HIDDEN_ATTRIBUTE}]`, raw({ display: "none" })),
		media(
			"(scripting: enabled) and (prefers-reduced-motion: no-preference)",
			when(
				`&[${STREAM_PENDING_ATTRIBUTE}]`,
				raw({
					visibility: "hidden",
					animationName: FALLBACK_KEYFRAMES,
					animationDuration: "0s",
					animationDelay: FALLBACK_DELAY,
					animationFillMode: "forwards",
				}),
			),
		),
	];
}
