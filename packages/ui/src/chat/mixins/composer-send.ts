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

import { STREAM_PENDING_ATTRIBUTE, collapseStream, revealStream } from "./reveal-stream.js";

/**
 * Empties the field once the submission it belongs to has been read. A script that takes the
 * submission over (`preventDefault` in a later `submit` listener) reads it during `submit`, so
 * the field empties a task later. A navigation's form data is taken when its `navigate` event
 * fires, which for a multipart form comes a task after `submit`, so it empties after that.
 */
function clearAfterSubmit(event: SubmitEvent, input: HTMLTextAreaElement, signal: AbortSignal) {
	let clear = () => setTimeout(() => (input.value = ""));
	let navigation = input.ownerDocument.defaultView?.navigation;
	if (navigation === undefined) return clear();
	let controller = new AbortController();
	signal.addEventListener("abort", () => controller.abort(), { once: true });
	navigation.addEventListener("navigate", clear, { once: true, signal: controller.signal });
	setTimeout(() => {
		if (!event.defaultPrevented) return;
		controller.abort();
		input.value = "";
	});
}

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
	/** The host's lifetime, taken while it is inserted, so a replay started later still ends with it. */
	let lifetime: AbortSignal | undefined;
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
			collapseStream(target);
			return;
		}
		let controller = new AbortController();
		lifetime?.addEventListener("abort", () => controller.abort(), { once: true });
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
		lifetime = signal;
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
				clearAfterSubmit(event, input, signal);
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
