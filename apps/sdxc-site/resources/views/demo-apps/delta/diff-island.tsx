/**
 * Client island for a page of diffs: an expand or "Load diff" link redraws `main` in place, with
 * no history entry and the scroll where the reader left it, and on a review page a line's `+` or
 * a drag over line numbers opens the inline comment form under those lines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { DIFF_COMMENT_EVENT } from "@sdxc/ui/app/diff";
import { clientEntry, createMixin } from "remix/component";

/** Links that change what a diff shows without moving to another place. */
const IN_PLACE_LINKS = 'a[data-slot="diff-expand"], a[data-delta-load]';

/** The template every inline comment form is cloned from, on a review page. */
export const COMMENT_TEMPLATE_ID = "delta-comment-template";

/** The pointer and key events a link is marked on before the runtime reads it. */
const MARK_ON = ["pointerdown", "keydown", "click", "focusin"] as const;

/** Marks an in-place link so the runtime replaces the entry and leaves the scroll alone. */
function markInPlace(event: Event): void {
	let link = event.target instanceof Element ? event.target.closest(IN_PLACE_LINKS) : null;
	if (link === null) return;
	link.setAttribute("data-rmx-history", "replace");
	link.setAttribute("data-rmx-reset-scroll", "manual");
}

/**
 * Opens the inline comment form under the lines a `DIFF_COMMENT_EVENT` names: a copy of the
 * page's template (its parsed content, or its children when drawn by the client) placed in a full-width row after the last line, its hidden fields set to the
 * file, the side and the range, and its text box focused. A second gesture moves the form.
 */
function openCommentForm(event: Event): void {
	let detail = event as Event & { path: string; side: "L" | "R"; start: number; end: number };
	let card = event.target instanceof Element ? event.target.closest("[data-slot=diff-file]") : null;
	let template = document.getElementById(COMMENT_TEMPLATE_ID);
	if (card === null || !(template instanceof HTMLTemplateElement)) return;
	let anchor = card.querySelector(`a[data-comment="${detail.side}${detail.end}"]`)?.closest("tr");
	if (anchor === null || anchor === undefined) return;
	document.querySelector("tr[data-delta-draft]")?.remove();
	let row = document.createElement("tr");
	row.setAttribute("data-delta-draft", "");
	row.setAttribute("data-thread", "");
	let cell = document.createElement("td");
	cell.colSpan = anchor.children.length;
	let source: Node = template.content.hasChildNodes() ? template.content : template;
	for (let child of source.childNodes) cell.appendChild(child.cloneNode(true));
	row.appendChild(cell);
	anchor.insertAdjacentElement("afterend", row);
	let set = (name: string, value: string) => {
		let input = row.querySelector<HTMLInputElement>(`input[name="${name}"]`);
		if (input) input.value = value;
	};
	set("path", detail.path);
	set("side", detail.side);
	set("start", String(detail.start));
	set("end", String(detail.end));
	let range = detail.start === detail.end ? `${detail.start}` : `${detail.start}–${detail.end}`;
	let heading = row.querySelector("[data-delta-draft-lines]");
	if (heading) heading.textContent = `${detail.side === "L" ? "−" : "+"}${range}`;
	row.querySelector("[data-delta-draft-cancel]")?.addEventListener("click", () => row.remove());
	row.querySelector("textarea")?.focus();
}

/** Listens on the document for as long as the marker is in the page. */
const diffIsland = createMixin<HTMLElement, [comments: boolean]>((handle) => {
	let controller: AbortController | undefined;
	let comments = false;
	handle.addEventListener("insert", () => {
		controller?.abort();
		controller = new AbortController();
		let { signal } = controller;
		for (let type of MARK_ON) {
			window.addEventListener(type, markInPlace, { capture: true, signal });
		}
		document.addEventListener(
			DIFF_COMMENT_EVENT,
			(event) => {
				if (comments) openCommentForm(event);
			},
			{ signal },
		);
	});
	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
	return (next) => {
		comments = next;
	};
});

/** Props the island serializes; a `type`, since serialized props reject an interface. */
export type DiffIslandProps = {
	/** The page takes review comments, so a line's `+` opens the inline form. */
	comments?: boolean;
};

/** Renders the hidden marker carrying the island's listeners. */
export const DiffIsland: EntryComponent<DiffIslandProps> = clientEntry(
	import.meta.url,
	function DiffIsland(handle) {
		return () => <span mix={[hidden(), diffIsland(handle.props.comments ?? false)]} />;
	},
);
