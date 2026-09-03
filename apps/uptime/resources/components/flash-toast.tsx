/**
 * A single server-rendered toast, in its own fixed region, that fades out on a
 * CSS timer. Used for the two things this app reports that way: the outcome a
 * redirect flashed into the session, and the answer to a quick check.
 *
 * It exists as a component because both of those are rendered by different
 * requests — one by the page shell, one by a fragment that streams into it —
 * so each gets its own region in the same corner, populated at most once per
 * request since a flash and a check result belong to separate requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { animation } from "@sdxc/u/animation";
import { Toast } from "@sdxc/ui";
import { easings } from "@sdxc/ui/animations";

/**
 * Total time, in ms, the toast stays visible before it fades, long enough for
 * a visitor to read a short status line.
 */
const VISIBLE_MS = 5000;

/**
 * Base name of the fade's `@keyframes` rule, and the name used verbatim whenever no
 * `occurrence` distinguishes one toast from the last — see {@link fadeName}.
 */
const FADE_NAME = "uptime-toast-fade";

/**
 * The animation name this toast fades under: {@link FADE_NAME}, suffixed with
 * `occurrence` so a toast patched onto a frame's prior element still gets its
 * own fresh animation name and replays its fade.
 *
 * @param occurrence - Sanitized to safe identifier characters, since the raw
 * value could otherwise produce a `@keyframes` rule no browser parses.
 * @returns The animation name to apply to this toast's fade.
 */
function fadeName(occurrence?: string): string {
	let suffix = occurrence?.replace(/[^a-zA-Z0-9_-]/g, "");
	return suffix ? `${FADE_NAME}-${suffix}` : FADE_NAME;
}

/**
 * One-shot fade: holds full opacity, then fades to transparent over the tail of
 * {@link VISIBLE_MS}, with the toast becoming invisible in place once it ends.
 * Uses `easings.standard` so the motion settles into the same rhythm as the rest.
 */
function autoFade(occurrence?: string) {
	return animation(fadeName(occurrence), {
		keyframes: {
			"0%": { opacity: 1 },
			"85%": { opacity: 1 },
			"100%": { opacity: 0, visibility: "hidden" },
		},
		duration: `${VISIBLE_MS}ms`,
		easing: easings.standard,
		fillMode: "forwards",
	});
}

namespace FlashToast {
	export interface Props {
		/** Semantic tone the toast is colored with. */
		color: Toast.Color;
		/** Accessible name for the region landmark holding the toast. */
		label: string;
		/**
		 * Identifies the thing being reported, for callers that render this into a
		 * frame: two answers patched onto one element only replay the fade when this
		 * value changes between them. Omit it when every render is a fresh document.
		 */
		occurrence?: string;
		/** Optional bold first line, for a message whose body needs naming. */
		title?: string;
		description: string;
	}
}

/** Renders one already-settled toast, pinned to the viewport corner, that fades on its own. */
export default function FlashToast(handle: Handle<FlashToast.Props>) {
	return () => {
		let { color, label, occurrence, title, description } = handle.props;

		return (
			<Toast.Region aria-label={label}>
				<Toast color={color} mix={[autoFade(occurrence)]}>
					<Toast.Content>
						{title && <Toast.Title>{title}</Toast.Title>}
						<Toast.Description>{description}</Toast.Description>
					</Toast.Content>
				</Toast>
			</Toast.Region>
		);
	};
}
