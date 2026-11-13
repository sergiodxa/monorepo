/**
 * Review gestures for a page of diffs, from listeners on the page's diff root rather than
 * one per line: a `+` press or a drag across line numbers names the lines a comment covers,
 * and a file's copy button writes its path. Why JS: ranges and the clipboard need script.
 * No-JS baseline: each `+` links to the app's comment form, and numbers link to their line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createElement, createMixin } from "remix/component";

import type { DiffSide } from "../utils/diff-rows.js";

/** Selector for the element a page's diffs share as their root. */
export const DIFF_SELECTOR = '[data-slot="diff"]';

/** Selector for one file's card, which carries the file's path. */
export const DIFF_FILE_SELECTOR = '[data-slot="diff-file"]';

/**
 * Event a file's card dispatches, bubbling, when a reader asks to comment on lines, as a
 * {@link DiffCommentEvent}. The app opens its comment form from it.
 */
export const DIFF_COMMENT_EVENT = "ui:diff-comment" as const;

declare global {
	interface HTMLElementEventMap {
		[DIFF_COMMENT_EVENT]: DiffCommentEvent;
	}
}

/** Attribute the root carries while this mixin runs, which shows the controls only it answers. */
export const DIFF_LIVE_ATTRIBUTE = "data-diff-live";

/** Attribute a row carries while a drag covers it. */
export const DIFF_SELECTED_ATTRIBUTE = "data-selected";

/** Selector for anything a comment gesture starts or lands on: a number or a `+` link. */
const LINE_SELECTOR = "a[data-line-number], a[data-comment]";

/** How long a copy button reads as copied. */
const COPIED_MS = 2000;

/**
 * Types for {@link diffInteractions}.
 */
export namespace DiffInteractions {
	/** What a {@link DiffCommentEvent} names: the file, the side and the lines, counted from 1. */
	export interface CommentDetail {
		path: string;
		side: DiffSide;
		start: number;
		end: number;
	}

	/** Options for {@link diffInteractions}. */
	export interface Options {
		/** Announced once a path is on the clipboard, such as "Copied". */
		copied: string;
	}
}

/**
 * Dispatched on a file's card when a reader presses a line's `+` or drags across numbers,
 * naming the lines the comment covers, in ascending order.
 */
export class DiffCommentEvent extends Event implements DiffInteractions.CommentDetail {
	readonly path: string;
	readonly side: DiffSide;
	readonly start: number;
	readonly end: number;

	/**
	 * @param detail The file's path, the side and the first and last line.
	 */
	constructor(detail: DiffInteractions.CommentDetail) {
		super(DIFF_COMMENT_EVENT, { bubbles: true });
		this.path = detail.path;
		this.side = detail.side;
		this.start = detail.start;
		this.end = detail.end;
	}
}

/** A line a gesture touches: its file card, side and number. */
interface LinePoint {
	file: HTMLElement;
	side: DiffSide;
	line: number;
}

/**
 * Reads the line an element names: a `+` link carries `data-comment="R12"`, and a number's
 * `id` ends in its side and number.
 */
function pointOf(element: Element | null): LinePoint | undefined {
	let link = element?.closest<HTMLAnchorElement>(LINE_SELECTOR);
	let file = link?.closest<HTMLElement>(DIFF_FILE_SELECTOR);
	if (!link || !file) return undefined;
	let key = link.getAttribute("data-comment") ?? link.id;
	let match = /([LR])(\d+)$/.exec(key);
	if (match === null) return undefined;
	return { file, side: match[1] as DiffSide, line: Number(match[2]) };
}

/** Marks the rows of `side` lines `start`–`end` in `file`, clearing every row marked before. */
function paint(root: HTMLElement, range: LinePoint & { end: number }): void {
	clear(root);
	let fileId = range.file.id;
	let from = Math.min(range.line, range.end);
	let to = Math.max(range.line, range.end);
	for (let line = from; line <= to; line += 1) {
		let number = range.file.ownerDocument.getElementById(`${fileId}${range.side}${line}`);
		number?.closest("tr")?.setAttribute(DIFF_SELECTED_ATTRIBUTE, "");
	}
}

/** Clears every row a drag marked. */
function clear(root: HTMLElement): void {
	for (let row of root.querySelectorAll(`tr[${DIFF_SELECTED_ATTRIBUTE}]`)) {
		row.removeAttribute(DIFF_SELECTED_ATTRIBUTE);
	}
}

/** Sends the comment request from `file`, lines in ascending order. */
function request(point: LinePoint, end: number): void {
	point.file.dispatchEvent(
		new DiffCommentEvent({
			path: point.file.getAttribute("data-path") ?? "",
			side: point.side,
			start: Math.min(point.line, end),
			end: Math.max(point.line, end),
		}),
	);
}

/**
 * Owns a page's diff gestures from inside its one island: a press on a `+` asks to comment
 * on its line, a drag from a number or a `+` across others on the same side asks for the
 * range (the rows paint while it moves), and `[data-action="copy-path"]` copies `data-path`.
 *
 * @param options The copy announced after a copy.
 * @example <span role="status" mix={[diffInteractions({ copied: t("copied") })]} />
 */
export const diffInteractions: MixinFactory<
	HTMLElement,
	[options: DiffInteractions.Options],
	ElementProps
> = createMixin<HTMLElement, [options: DiffInteractions.Options], ElementProps>((handle) => {
	let options: DiffInteractions.Options = { copied: "" };

	handle.addEventListener("insert", (event) => {
		let status = event.node;
		let found = status.closest<HTMLElement>(DIFF_SELECTOR);
		if (found === null) return;
		let root: HTMLElement = found;
		let signal = handle.signal;
		let drag: (LinePoint & { end: number }) | undefined;
		let swallowClick = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		signal.addEventListener("abort", () => clearTimeout(timer));

		root.setAttribute(DIFF_LIVE_ATTRIBUTE, "");
		signal.addEventListener("abort", () => root.removeAttribute(DIFF_LIVE_ATTRIBUTE));

		root.addEventListener(
			"pointerdown",
			(down) => {
				if (down.button !== 0 || !(down.target instanceof Element)) return;
				let point = pointOf(down.target);
				clear(root);
				if (point === undefined) return;
				down.preventDefault();
				drag = { ...point, end: point.line };
			},
			{ signal },
		);

		root.addEventListener(
			"pointermove",
			(move) => {
				if (drag === undefined) return;
				let under = root.ownerDocument.elementFromPoint(move.clientX, move.clientY);
				let point = pointOf(under) ?? pointOf(move.target instanceof Element ? move.target : null);
				if (point === undefined || point.file !== drag.file || point.side !== drag.side) return;
				if (point.line === drag.end) return;
				drag.end = point.line;
				paint(root, drag);
			},
			{ signal },
		);

		window.addEventListener(
			"pointerup",
			() => {
				let done = drag;
				drag = undefined;
				if (done === undefined || done.end === done.line) return;
				swallowClick = true;
				request(done, done.end);
			},
			{ signal },
		);

		root.addEventListener(
			"click",
			(click) => {
				if (!(click.target instanceof Element)) return;
				if (swallowClick) {
					swallowClick = false;
					if (click.target.closest(LINE_SELECTOR)) click.preventDefault();
					return;
				}
				let copy = click.target.closest<HTMLElement>('[data-action="copy-path"]');
				if (copy !== null && root.contains(copy)) {
					void copyPath(copy);
					return;
				}
				let comment = click.target.closest<HTMLAnchorElement>("a[data-comment]");
				let point = pointOf(comment);
				if (point === undefined) return;
				click.preventDefault();
				paint(root, { ...point, end: point.line });
				request(point, point.line);
			},
			{ signal },
		);

		/** Writes a file's path to the clipboard and says so for a moment. */
		async function copyPath(button: HTMLElement): Promise<void> {
			try {
				await navigator.clipboard.writeText(button.getAttribute("data-path") ?? "");
			} catch {
				return;
			}
			if (signal.aborted) return;
			button.setAttribute("data-copied", "");
			status.textContent = options.copied;
			clearTimeout(timer);
			timer = setTimeout(() => {
				button.removeAttribute("data-copied");
				status.textContent = "";
			}, COPIED_MS);
		}
	});

	return (next) => {
		options = next;
		return createElement(handle.element, {});
	};
});
