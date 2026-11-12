/**
 * Wires a composer's send control: Enter sends, Shift+Enter writes a new line, the field
 * clears once a message goes, and a reply the page just answered replays as a stream that
 * Stop or Escape freezes. Why JS: keys, clearing and the replay need script. No-JS baseline:
 * the send button submits the form, Enter writes a new line, and the reply shows whole.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { prefersReducedMotion } from "../../utils/prefers-reduced-motion.js";
import { COMPOSER_INPUT_SLOT } from "../composer.js";
import { STREAM_PENDING_ATTRIBUTE, revealStream } from "../utils/stream-reveal.js";

/** The slot of the button that stops a streaming reply, inside the mixin's host. */
export const COMPOSER_STOP_SLOT = "composer-stop";

/** Options for {@link composerSend}. */
export interface ComposerSendOptions {
	/**
	 * The `id` of a reply the page just answered with, marked `data-stream-pending`; it replays
	 * as a stream, or shows at once under reduced motion.
	 */
	stream?: string;
	/** Changes with every new reply, so a reply that reuses the previous one's `id` replays too. */
	streamKey?: string;
	/** Told when a replay starts and ends, so the host can swap Send for Stop. */
	onStreamingChange: (streaming: boolean) => void;
}

/**
 * Put on an element inside a composer's form, around its send and stop buttons. It finds the
 * form's `Composer.Input`, and a click on a `[data-slot="composer-stop"]` inside it stops the
 * replay.
 *
 * @example <span mix={[composerSend({ stream: "reply-7", onStreamingChange: (on) => … })]}>…</span>
 */
export const composerSend: MixinFactory<HTMLElement, [options: ComposerSendOptions]> = createMixin<
	HTMLElement,
	[options: ComposerSendOptions]
>((handle) => {
	let options: ComposerSendOptions | undefined;
	let host: HTMLElement | undefined;
	let started: string | undefined;
	let streaming = false;
	let stop = () => {};

	/** Records the replay's state and tells the host. */
	function setStreaming(next: boolean) {
		if (streaming === next) return;
		streaming = next;
		options?.onStreamingChange(next);
	}

	/** Replays the reply `stream` names, once per key, while it is still pending. */
	function startStream() {
		let id = options?.stream;
		let key = `${id}|${options?.streamKey ?? ""}`;
		if (id === undefined || host === undefined || key === started) return;
		let target = host.ownerDocument.getElementById(id);
		if (target === null || !target.hasAttribute(STREAM_PENDING_ATTRIBUTE)) return;
		started = key;
		stop();
		if (prefersReducedMotion()) {
			target.removeAttribute(STREAM_PENDING_ATTRIBUTE);
			return;
		}
		let controller = new AbortController();
		handle.signal.addEventListener("abort", () => controller.abort(), { once: true });
		let reveal = revealStream(target, {
			signal: controller.signal,
			onEnd: () => {
				stop = () => {};
				setStreaming(false);
			},
		});
		stop = () => reveal.stop();
		setStreaming(true);
	}

	handle.addEventListener("insert", ({ node }) => {
		host = node;
		let signal = handle.signal;
		let form = node.closest("form");
		let input = form?.querySelector<HTMLTextAreaElement>(`[data-slot="${COMPOSER_INPUT_SLOT}"]`);

		input?.addEventListener(
			"keydown",
			(event) => {
				if (event.key === "Escape" && streaming) return stop();
				if (event.key !== "Enter" || event.shiftKey || event.altKey || event.isComposing) return;
				event.preventDefault();
				if (streaming || input.value.trim() === "") return;
				form?.requestSubmit();
			},
			{ signal },
		);
		form?.addEventListener(
			"submit",
			(event) => {
				if (event.defaultPrevented || !input) return;
				setTimeout(() => {
					input.value = "";
				});
			},
			{ signal },
		);
		node.addEventListener(
			"click",
			(event) => {
				if (!(event.target instanceof Element)) return;
				if (event.target.closest(`[data-slot="${COMPOSER_STOP_SLOT}"]`)) stop();
			},
			{ signal },
		);
		startStream();
	});

	return (next) => {
		options = next;
		handle.queueTask(() => startStream());
		return handle.element;
	};
});
