/**
 * The browser half of the log viewer: searches every line (counting matches, painting them
 * through the CSS Custom Highlight API and stepping with Enter and ⇧Enter), and streams a live
 * step's lines into place while the log follows its tail. Without it, find-in-page still works.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import type { AnsiStyle } from "../utils/ansi.js";

import { parseAnsiLine } from "../utils/ansi.js";
import {
	LOG_LINE_PLACEHOLDER,
	ansiAttributes,
	formatLogTime,
	readMarker,
	splitTimestamp,
} from "../utils/log-lines.js";

/** Matches painted at once; a query matching more still counts and steps through all of them. */
const HIGHLIGHT_LIMIT = 2_000;

/** How close to the bottom, in pixels, the log still counts as following its tail. */
const FOLLOW_SLACK = 24;

/** Milliseconds the search waits after the last keystroke, so a fast typist scans once. */
const SEARCH_DELAY = 60;

/** The highlight every match is painted with, which the viewer's stylesheet tints. */
const MATCH_HIGHLIGHT = "ui-log-match";

/** The highlight the match the search is on is painted with, drawn solid. */
const CURRENT_HIGHLIGHT = "ui-log-current";

/** Marks the line the search is on. */
const CURRENT_ATTRIBUTE = "data-log-current";

/**
 * Types for {@link logViewerController}.
 */
export namespace LogViewerController {
	/** Plain data only, since the options cross into the browser with the viewer's island. */
	export type Options = {
		/** The counter, with `{index}` and `{count}` replaced. */
		matches: string;
		/** Shown in place of the counter when nothing matches. */
		noMatches: string;
	};
}

/** One occurrence of the query: the line it is on and its offsets in the line's text. */
interface Match {
	row: HTMLElement;
	start: number;
	end: number;
}

/** A Range over `[start, end)` of the row's text, walking its text nodes. */
function rangeIn(row: HTMLElement, start: number, end: number): Range | null {
	let walker = row.ownerDocument.createTreeWalker(row, NodeFilter.SHOW_TEXT);
	let range = row.ownerDocument.createRange();
	let offset = 0;
	let started = false;
	for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
		let length = node.textContent?.length ?? 0;
		if (!started && start < offset + length) {
			range.setStart(node, start - offset);
			started = true;
		}
		if (started && end <= offset + length) {
			range.setEnd(node, end - offset);
			return range;
		}
		offset += length;
	}
	return null;
}

/** Opens every closed `<details>` between the row and the viewer, so the row can be seen. */
function reveal(row: HTMLElement, root: HTMLElement): void {
	for (let details = row.closest("details"); details !== null && root.contains(details);) {
		if (row !== details.querySelector(":scope > summary")) details.open = true;
		details = details.parentElement?.closest("details") ?? null;
	}
}

/** The counter's text: empty with no query, the no-match copy, or "{index} of {count}". */
function counterText(
	options: LogViewerController.Options,
	query: string,
	current: number,
	total: number,
): string {
	if (query === "") return "";
	if (total === 0) return options.noMatches;
	return options.matches.replace("{index}", String(current + 1)).replace("{count}", String(total));
}

/** Wires the search box: scanning, counting, painting and stepping through matches. */
function attachSearch(
	root: HTMLElement,
	options: LogViewerController.Options,
	signal: AbortSignal,
) {
	let box = root.querySelector<HTMLElement>("[data-log-search]");
	let input = root.querySelector<HTMLInputElement>("[data-log-search-input]");
	let count = root.querySelector<HTMLElement>("[data-log-search-count]");
	if (box === null || input === null) return;
	box.hidden = false;
	let matches: Match[] = [];
	let current = -1;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let highlights = typeof CSS !== "undefined" && "highlights" in CSS ? CSS.highlights : undefined;

	let show = (index: number) => {
		root.querySelector(`[${CURRENT_ATTRIBUTE}]`)?.removeAttribute(CURRENT_ATTRIBUTE);
		current = matches.length === 0 ? -1 : (index + matches.length) % matches.length;
		let match = matches[current];
		if (count !== null)
			count.textContent = counterText(options, input.value, current, matches.length);
		highlights?.delete(CURRENT_HIGHLIGHT);
		if (match === undefined) return;
		reveal(match.row, root);
		match.row.setAttribute(CURRENT_ATTRIBUTE, "");
		let range = rangeIn(match.row, match.start, match.end);
		if (range !== null) highlights?.set(CURRENT_HIGHLIGHT, new Highlight(range));
		match.row.scrollIntoView({ block: "center" });
	};

	let scan = () => {
		let query = input.value.toLowerCase();
		matches = [];
		if (query !== "") {
			for (let row of root.querySelectorAll<HTMLElement>("[data-log-line]")) {
				let text = (row.textContent ?? "").toLowerCase();
				for (let at = text.indexOf(query); at !== -1; at = text.indexOf(query, at + query.length)) {
					matches.push({ row, start: at, end: at + query.length });
				}
			}
		}
		if (highlights !== undefined) {
			let ranges = matches
				.slice(0, HIGHLIGHT_LIMIT)
				.map((match) => rangeIn(match.row, match.start, match.end))
				.filter((range): range is Range => range !== null);
			highlights.set(MATCH_HIGHLIGHT, new Highlight(...ranges));
		}
		show(0);
	};

	input.addEventListener(
		"input",
		() => {
			clearTimeout(timer);
			timer = setTimeout(scan, SEARCH_DELAY);
		},
		{ signal },
	);
	input.addEventListener(
		"keydown",
		(event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				clearTimeout(timer);
				if (timer !== undefined) {
					timer = undefined;
					scan();
				}
				show(current + (event.shiftKey ? -1 : 1));
			} else if (event.key === "Escape" && input.value !== "") {
				event.preventDefault();
				input.value = "";
				scan();
			}
		},
		{ signal },
	);
	root
		.querySelector("[data-log-search-previous]")
		?.addEventListener("click", () => show(current - 1), { signal });
	root
		.querySelector("[data-log-search-next]")
		?.addEventListener("click", () => show(current + 1), { signal });
	signal.addEventListener("abort", () => {
		clearTimeout(timer);
		highlights?.delete(MATCH_HIGHLIGHT);
		highlights?.delete(CURRENT_HIGHLIGHT);
	});
}

/** Where a live step's next line goes and how its links read. */
interface LiveStep {
	step: HTMLElement;
	/** The innermost open fold first; the step's live container last. */
	containers: HTMLElement[];
	next: number;
	href: string;
	style: AnsiStyle;
}

/**
 * Builds one streamed line in the markup the server draws: a row holding its number link and
 * its spans, or a fold whose summary is the row. An `##[endgroup]` closes the innermost fold.
 */
function appendLine(live: LiveStep, raw: string): void {
	let document = live.step.ownerDocument;
	let { ts, text: rest } = splitTimestamp(raw);
	let { marker, text } = readMarker(rest);
	let parsed = parseAnsiLine(text, live.style);
	live.style = parsed.state;
	if (marker === "endgroup") {
		if (live.containers.length > 1) live.containers.shift();
		return;
	}
	let n = live.next++;
	let href = live.href.replace("{n}", String(n));
	let hash = href.indexOf("#");
	let isGroup = marker === "group";
	let row = document.createElement(isGroup ? "summary" : "div");
	row.setAttribute("data-log-line", "");
	if (hash !== -1) row.id = decodeURIComponent(href.slice(hash + 1));
	if (marker !== undefined && !isGroup) row.setAttribute("data-tone", marker);
	let link = document.createElement("a");
	link.href = href;
	link.dataset["n"] = String(n);
	if (ts !== undefined) link.dataset["ts"] = formatLogTime(ts);
	link.tabIndex = -1;
	link.setAttribute("aria-hidden", "true");
	let title = isGroup ? document.createElement("span") : row;
	if (isGroup) title.setAttribute("data-log-group-title", "");
	for (let span of parsed.spans) {
		let attributes = Object.entries(ansiAttributes(span));
		if (attributes.length === 0) {
			title.appendChild(document.createTextNode(span.text));
			continue;
		}
		let element = document.createElement("span");
		for (let [name, value] of attributes) element.setAttribute(name, value);
		element.textContent = span.text;
		title.appendChild(element);
	}
	row.insertBefore(link, row.firstChild);
	if (isGroup) row.appendChild(title);
	let parent = live.containers[0]!;
	if (!isGroup) {
		parent.appendChild(row);
		return;
	}
	let details = document.createElement("details");
	details.setAttribute("data-log-group", "");
	let body = document.createElement("div");
	body.setAttribute("data-log-group-body", "");
	details.appendChild(row);
	details.appendChild(body);
	parent.appendChild(details);
	live.containers.unshift(body);
}

/**
 * Keeps the log on its newest line while the reader is there, and once they scroll up, shows
 * the "Jump to latest" pill instead of pulling them down.
 */
function followTail(root: HTMLElement, signal: AbortSignal): () => void {
	let body = root.querySelector<HTMLElement>('[data-slot="log-viewer-body"]');
	let pill = root.querySelector<HTMLElement>("[data-log-jump]");
	if (body === null) return () => {};
	let following = true;
	let toBottom = () => {
		body.scrollTop = body.scrollHeight;
	};
	body.addEventListener(
		"scroll",
		() => {
			following = body.scrollHeight - body.scrollTop - body.clientHeight <= FOLLOW_SLACK;
			if (following && pill !== null) pill.hidden = true;
		},
		{ signal },
	);
	pill?.addEventListener(
		"click",
		() => {
			following = true;
			pill.hidden = true;
			toBottom();
		},
		{ signal },
	);
	if (root.ownerDocument.location.hash === "") toBottom();
	return () => {
		if (following) toBottom();
		else if (pill !== null) pill.hidden = false;
	};
}

/**
 * Reads a live step's stream, appending each complete line as it arrives and the last partial
 * one at the end. The step's `data-stream-end` becomes `done` or `failed`, and its Refresh link
 * shows again, since the page now holds a newer state than the log.
 */
async function stream(step: HTMLElement, appended: () => void, signal: AbortSignal) {
	let src = step.getAttribute("data-log-stream") ?? "";
	let live: LiveStep = {
		step,
		containers: [step.querySelector<HTMLElement>("[data-log-live]") ?? step],
		next: Number(step.getAttribute("data-log-next") ?? "1"),
		href: (step.getAttribute("data-log-href") ?? "").replace(String(LOG_LINE_PLACEHOLDER), "{n}"),
		style: {},
	};
	let refresh = step.querySelector<HTMLElement>("[data-log-refresh]");
	let end = (state: "done" | "failed") => {
		step.removeAttribute("data-stream-pending");
		step.setAttribute("data-stream-end", state);
		if (refresh !== null) refresh.hidden = false;
		step.dispatchEvent(new CustomEvent("log-stream-end", { bubbles: true, detail: { state } }));
	};
	try {
		let response = await fetch(src, { signal, headers: { accept: "text/plain" } });
		if (!response.ok || response.body === null) return end("failed");
		if (refresh !== null) refresh.hidden = true;
		let reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
		let buffer = "";
		for (let read = await reader.read(); !read.done; read = await reader.read()) {
			buffer += read.value;
			let lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (let line of lines) appendLine(live, line.replace(/\r$/, ""));
			step.setAttribute("data-log-next", String(live.next));
			if (lines.length > 0) appended();
		}
		if (buffer !== "") {
			appendLine(live, buffer);
			appended();
		}
		end("done");
	} catch {
		if (!signal.aborted) end("failed");
	}
}

/** Wires one viewer: search, the tail it follows, and every live step's stream. */
function attach(root: HTMLElement, options: LogViewerController.Options, signal: AbortSignal) {
	attachSearch(root, options, signal);
	let steps = [...root.querySelectorAll<HTMLElement>("[data-log-stream][data-stream-pending]")];
	if (steps.length === 0) return;
	let appended = followTail(root, signal);
	for (let step of steps) void stream(step, appended, signal);
}

/**
 * Wires the `LogViewer` the host sits in, for as long as the host stays mounted.
 *
 * @param options The counter's copy.
 * @example <div hidden mix={[logViewerController({ matches: "{index} of {count}", noMatches: "No results" })]} />
 */
export const logViewerController: MixinFactory<
	HTMLElement,
	[options: LogViewerController.Options]
> = createMixin<HTMLElement, [options: LogViewerController.Options]>((handle) => {
	let options: LogViewerController.Options | undefined;

	handle.addEventListener("insert", (event) => {
		let root = event.node.closest<HTMLElement>('[data-slot="log-viewer"]');
		if (root !== null && options !== undefined) attach(root, options, handle.signal);
	});

	return (next) => {
		options = next;
	};
});
