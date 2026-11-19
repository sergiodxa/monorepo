/**
 * Client island under an open conversation: it marks the conversation read, then follows the
 * server's live stream, showing who is typing, adding each new line to the log as it posts,
 * and flipping presence dots, and tells the server what it saw so a reload keeps it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { TypingIndicator, typingLabel } from "@sdxc/ui/chat/typing-indicator";
import { clientEntry, ref } from "remix/component";

import { TYPING_LABELS } from "~/resources/views/demo-apps/parley/labels";

/** One event the live stream writes, one JSON object per line. */
export type LiveEvent =
	| { type: "typing"; person: string; name: string }
	| { type: "idle"; person: string }
	| { type: "presence"; person: string; state: "active" | "away" | "dnd"; label: string }
	| {
			type: "message";
			person: string;
			/** The log the line belongs to: `log` for the conversation, `thread-<id>` for a thread. */
			target: string;
			html: string;
			/** What the island posts back once the line is shown, such as `{ live: "2" }`. */
			seen: Record<string, string>;
	  };

/**
 * Props {@link ParleyLive} serializes into the page, which is why they are a `type`:
 * `SerializableProps` rejects an interface.
 */
export type ParleyLiveProps = {
	/** The conversation's key, which the sidebar row carries as `data-conversation`. */
	conversation: string;
	/** The stream's address. */
	src: string;
	/** Where the island posts that the visitor read the conversation or saw a line. */
	action: string;
	/** Whether the conversation had unread lines when the page was drawn. */
	unread: boolean;
};

/** Posts a few fields to the app's action in the background, keeping the visitor where they are. */
function post(action: string, fields: Record<string, string>, signal: AbortSignal): void {
	void fetch(action, {
		method: "POST",
		body: new URLSearchParams(fields),
		redirect: "manual",
		credentials: "same-origin",
		signal,
	}).catch(() => undefined);
}

/** Clears the sidebar row's bold and count once its conversation has been read. */
function clearSidebarRow(conversation: string): void {
	for (let row of document.querySelectorAll<HTMLElement>(
		`[data-conversation="${CSS.escape(conversation)}"]`,
	)) {
		row.removeAttribute("data-unread");
		row.querySelector("[data-slot=app-shell-count]")?.remove();
	}
}

/**
 * Adds a server-rendered line to its log, moving any style rules it carries into the head, and
 * scrolls the log to it when the visitor was already at the newest line.
 */
function insertLine(target: string, html: string): void {
	let log = document.querySelector<HTMLElement>(`[data-live-log="${CSS.escape(target)}"]`);
	if (log === null) return;
	let template = document.createElement("template");
	template.innerHTML = html;
	for (let style of template.content.querySelectorAll("style")) document.head.appendChild(style);
	let viewport = log.closest<HTMLElement>("[data-live-viewport]");
	let pinned =
		viewport === null ||
		Math.abs(viewport.scrollTop) < 48 ||
		viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop < 48;
	log.appendChild(template.content);
	let line = log.lastElementChild;
	if (line instanceof HTMLElement) {
		line.setAttribute("data-live-new", "");
		if (pinned) line.scrollIntoView({ block: "end", behavior: "smooth" });
	}
}

/**
 * Reads the stream's lines as they arrive and hands each parsed event on; the stream ending or
 * failing simply stops the updates, leaving the page as drawn.
 */
async function follow(src: string, signal: AbortSignal, onEvent: (event: LiveEvent) => void) {
	let response = await fetch(src, { signal, headers: { accept: "text/plain" } }).catch(() => null);
	if (response?.body == null || !response.ok) return;
	let reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = "";
	while (!signal.aborted) {
		let chunk = await reader.read().catch(() => ({ done: true, value: undefined }));
		if (chunk.done) break;
		buffer += chunk.value ?? "";
		let lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (let line of lines) {
			if (line.trim() === "") continue;
			try {
				onEvent(JSON.parse(line) as LiveEvent);
			} catch {
				continue;
			}
		}
	}
}

/**
 * Renders the typing line, then runs the conversation's live updates for as long as it is on
 * the page; a swap of the main frame unmounts it and the next screen's island takes over.
 */
export const ParleyLive: EntryComponent<ParleyLiveProps> = clientEntry(
	import.meta.url,
	function ParleyLive(handle) {
		return () => (
			<TypingIndicator
				mix={[
					ref((node: HTMLElement, signal) => {
						let { conversation, src, action, unread } = handle.props;
						let typing = new Map<string, string>();
						let text = node.querySelector<HTMLElement>("[data-slot=typing-text]");
						let render = () => {
							let label = typingLabel([...typing.values()], TYPING_LABELS);
							if (text !== null) text.textContent = label;
							node.toggleAttribute("data-empty", label === "");
						};
						if (unread) {
							post(action, { intent: "read" }, signal);
							clearSidebarRow(conversation);
						}
						void follow(src, signal, (event) => {
							if (event.type === "typing") typing.set(event.person, event.name);
							if (event.type === "idle") typing.delete(event.person);
							if (event.type === "presence") {
								for (let dot of document.querySelectorAll<HTMLElement>(
									`[data-presence="${CSS.escape(event.person)}"]`,
								)) {
									dot.dataset.state = event.state;
									dot.setAttribute("aria-label", event.label);
								}
							}
							if (event.type === "message") {
								typing.delete(event.person);
								insertLine(event.target, event.html);
								post(action, { intent: "seen", ...event.seen }, signal);
							}
							render();
						});
					}),
				]}
			/>
		);
	},
);
