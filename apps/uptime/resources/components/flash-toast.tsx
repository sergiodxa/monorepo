/**
 * A single server-rendered toast, in its own fixed region, that fades itself out with no
 * script driving its removal. Used for the two things this app reports that way: the
 * outcome a redirect flashed into the session, and the answer to a quick check.
 *
 * It exists as a component because both of those are rendered by different requests —
 * one by the page shell, one by a fragment that streams into it — so neither could hand
 * the other a queue to push onto. Each renders its own region; they sit in the same
 * corner, which is only ever a pile if one request carries both, and a request that
 * flashes a message is not also one that ran a check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { animation } from "@pkg/u/animation";
import { Toast } from "@pkg/ui";
import { easings } from "@pkg/ui/animations";

/**
 * Total time, in ms, the toast stays visible before fading out — matches `@pkg/ui`'s own
 * `Toaster` behavior's default auto-dismiss delay, even though this is a single
 * SSR-rendered element rather than a JS-driven queue, so there's no `Toaster` instance
 * here to actually read that default from.
 */
const VISIBLE_MS = 5000;

/**
 * Base name of the fade's `@keyframes` rule, and the name used verbatim whenever no
 * `occurrence` distinguishes one toast from the last — see {@link fadeName}.
 */
const FADE_NAME = "uptime-toast-fade";

/**
 * The animation name this toast fades under: {@link FADE_NAME} on its own, or suffixed
 * with `occurrence` when the caller has something that tells this toast apart from the
 * one before it.
 *
 * That suffix is the whole reason the prop exists. A toast rendered into a frame is
 * patched onto whatever element the last render left behind, not built fresh, so it
 * inherits that element's already-finished fade — held at `opacity: 0` by
 * `animation-fill-mode`, and never restarted, because re-applying the same animation to
 * the same element does nothing. A different name is a different animation, which plays.
 *
 * Sanitized rather than trusted: the value is an identifier from somewhere else in the
 * app, and anything outside an ident would produce a `@keyframes` rule no browser parses.
 */
function fadeName(occurrence?: string): string {
	let suffix = occurrence?.replace(/[^a-zA-Z0-9_-]/g, "");
	return suffix ? `${FADE_NAME}-${suffix}` : FADE_NAME;
}

/**
 * One-shot fade: holds full opacity, then fades to fully transparent over the tail of
 * {@link VISIBLE_MS}, with no JS driving its removal — the toast simply becomes
 * invisible in place once the animation ends. `@pkg/ui/animations`'s `fade()`/
 * `enterExit()` factories are state-driven (`[open]`/`:popover-open`, or a custom
 * attribute a script would need to flip), which doesn't fit a toast with no open/close
 * state of its own — this reuses their `easings.standard` curve so the motion still
 * settles into the same rhythm as every other transition in the catalog. Built on
 * `@pkg/u/animation`'s `animation()`, which emits the `@keyframes` rule plus the
 * longhand host declarations.
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
		 * Identifies the thing being reported, for callers that render this into a frame:
		 * two answers in a row are patched onto one element, and only a value that changes
		 * between them gets the fade to play a second time. Omit it where every render is a
		 * fresh document, which is where the element is new anyway.
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
