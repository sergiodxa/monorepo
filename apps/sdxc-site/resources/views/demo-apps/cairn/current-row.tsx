/**
 * Client island: keeps the list's open row marked when only the issue frame reloads. A row, or
 * Previous or Next beside the list, swaps the issue without redrawing the list, so the island
 * moves `aria-current` to the row the link opens. Without script every link loads the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { clientEntry, createMixin } from "remix/component";

/** Links that reload only the issue frame. */
const ISSUE_LINKS = 'a[href][data-rmx-target="cairn-issue"]';

/** Marks the row of the issue `href` opens as the current one, and clears the others. */
function markRow(doc: Document, href: string): void {
	let id = new URL(href, doc.baseURI).searchParams.get("issue");
	if (id === null) return;
	for (let link of doc.querySelectorAll("#cairn-rows a[data-issue-link][aria-current]")) {
		link.removeAttribute("aria-current");
	}
	doc
		.querySelector(`#cairn-rows [data-issue="${CSS.escape(id)}"] a[data-issue-link]`)
		?.setAttribute("aria-current", "page");
}

/** Listens for clicks on issue-frame links for as long as the marker is in the page. */
const currentRow = createMixin<HTMLElement, []>((handle) => {
	let controller: AbortController | undefined;
	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		let doc = event.node.ownerDocument;
		doc.addEventListener(
			"click",
			(click) => {
				if (click.defaultPrevented || click.button !== 0) return;
				if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
				let link = click.target instanceof Element ? click.target.closest(ISSUE_LINKS) : null;
				if (link) markRow(doc, link.getAttribute("href") ?? "");
			},
			{ signal: controller.signal },
		);
	});
	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});

/** Renders the hidden marker carrying the listener. */
export const CurrentRow: EntryComponent<Record<never, never>> = clientEntry(
	import.meta.url,
	function CurrentRow() {
		return () => <span mix={[hidden(), currentRow()]} />;
	},
);
