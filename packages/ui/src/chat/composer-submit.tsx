/**
 * Island holding a composer's send control. Hydrated, Enter sends and Shift+Enter writes a
 * new line, and when the page just answered a message it replays that reply as a stream,
 * turning Send into Stop until the reply finishes. Without script it is a submit button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle } from "remix/component";

import { ArrowUpIcon, SquareIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { clientEntry } from "remix/component";

import { Button } from "../components/button.js";

import { COMPOSER_STOP_SLOT, composerSend } from "./mixins/composer-send.js";

/** Prop types for {@link ComposerSubmit}. */
export namespace ComposerSubmit {
	/** Plain data only, since the props cross into the browser with the island. */
	export type Props = {
		/** The buttons' accessible names, such as "Send message" and "Stop response". */
		labels: { send: string; stop: string };
		/**
		 * The `id` of a reply the page just answered with, marked `data-stream-pending` and
		 * styled with `streamTarget()`; it replays as a stream, or shows at once under
		 * reduced motion.
		 */
		stream?: string;
		/**
		 * Changes with every new reply, so a page answered in place by client navigation
		 * replays a reply that reuses the previous one's `id`.
		 */
		streamKey?: string;
	};
}

/** The square, round-cornered look both buttons share, so swapping them never moves the row. */
const BUTTON_SHAPE = raw({
	inlineSize: "2.25rem",
	blockSize: "2.25rem",
	paddingInline: "0",
	borderRadius: "var(--ui-composer-button-radius, 999px)",
	flexShrink: "0",
});

/**
 * Renders Send, or Stop while a reply streams. Enter sends a non-empty message unless an
 * input method is composing; Escape stops a streaming reply.
 *
 * @example <ComposerSubmit labels={{ send: "Send message", stop: "Stop response" }} stream="reply-7" />
 */
export const ComposerSubmit: EntryComponent<ComposerSubmit.Props> = clientEntry(
	"@sdxc/ui/chat/composer-submit#ComposerSubmit",
	function ComposerSubmit(handle: Handle<ComposerSubmit.Props>) {
		let streaming = false;

		/** Swaps Send for Stop while the reply replays, and back when it ends. */
		function onStreamingChange(next: boolean) {
			streaming = next;
			if (!handle.signal.aborted) void handle.update();
		}

		return () => {
			let { labels, stream, streamKey } = handle.props;
			return (
				<span
					data-slot="composer-submit"
					mix={[
						raw({ display: "contents" }),
						composerSend({ stream, streamKey, onStreamingChange }),
					]}
				>
					{streaming ? (
						<Button
							type="button"
							color="neutral"
							aria-label={labels.stop}
							title={labels.stop}
							aria-keyshortcuts="Escape"
							data-slot={COMPOSER_STOP_SLOT}
							mix={[BUTTON_SHAPE]}
						>
							<SquareIcon size={14} fill="currentColor" aria-hidden="true" />
						</Button>
					) : (
						<Button
							type="submit"
							color="brand"
							aria-label={labels.send}
							title={labels.send}
							aria-keyshortcuts="Enter"
							data-slot="composer-send"
							mix={[BUTTON_SHAPE]}
						>
							<ArrowUpIcon size={18} aria-hidden="true" />
						</Button>
					)}
				</span>
			);
		};
	},
);
