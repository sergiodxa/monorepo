/**
 * Client island: the inbox's keyboard layer. `j` and `k` walk the notifications with an inset
 * ring, Enter or `o` opens one, `x` selects it for the bulk bar, and `e` marks the focused one
 * done and moves on to the next. A row whose toggle moves it out of the view hides at once, and
 * the view says it is all caught up once none is left; without script every row is a link and a form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { rowNavigation, shortcutRegistry } from "@sdxc/ui/app";
import { clientEntry, createMixin } from "remix/component";

/** Props the island serializes; a `type`, since serialized props reject an interface. */
export type InboxKeysProps = {
	/** The list the rows sit in, as a selector the marker finds among its ancestors. */
	within: string;
	/** Which rows the view keeps: the inbox drops done ones, Saved and Done keep only theirs. */
	view: "inbox" | "saved" | "done";
	/** The help sheet's words for each key. */
	labels: {
		group: string;
		next: string;
		previous: string;
		open: string;
		toggle: string;
		selected: string;
		deselected: string;
		done: string;
	};
};

/** The rows the keys walk, which a done toggle hides from the inbox at once. */
const ROWS = "li[data-row]";

/** Whether a row is on screen, rather than hidden by the toggle that moved it out of this view. */
function shown(row: HTMLElement): boolean {
	return !row.hidden;
}

/**
 * Marks the focused row done: focus moves to the next row still shown (or the one before it)
 * first, so the keyboard keeps its place, then the row's Done toggle is pressed. Declines while
 * rows are selected, where the bulk bar's own `e` answers.
 */
const doneKey = createMixin<
	HTMLElement,
	[options: { within: string; label: string; group: string }]
>((handle) => {
	let options: { within: string; label: string; group: string } | undefined;
	handle.addEventListener("insert", (event) => {
		let list = event.node.closest<HTMLElement>(options?.within ?? "");
		if (list === null || options === undefined) return;
		shortcutRegistry(event.node.ownerDocument).register({
			keys: "e",
			label: options.label,
			group: options.group,
			signal: handle.signal,
			run() {
				if (list.querySelector("input[data-selection-item]:checked") !== null) return false;
				let active = list.ownerDocument.activeElement;
				let row = active?.closest<HTMLElement>(ROWS);
				if (row === null || row === undefined || !list.contains(row)) return false;
				let rows = [...list.querySelectorAll<HTMLElement>(ROWS)].filter(shown);
				let index = rows.indexOf(row);
				let next = rows[index + 1] ?? rows[index - 1];
				row
					.querySelector<HTMLButtonElement>('[data-inbox-action="done"] button[type=submit]')
					?.click();
				next?.querySelector<HTMLElement>("a[data-row-link]")?.focus();
			},
		});
	});
	return (next) => {
		options = next;
	};
});

/** Whether a row's toggle for `action` is pressed now, as its form's `data-pressed` says. */
function pressed(row: Element, action: "done" | "saved"): boolean {
	return row.querySelector(`[data-inbox-action="${action}"] form[data-pressed]`) !== null;
}

/** Whether a row still belongs in the view after its toggles changed. */
function belongs(row: Element, view: InboxKeysProps["view"]): boolean {
	if (view === "inbox") return !pressed(row, "done");
	return pressed(row, view);
}

/**
 * Hides each row whose toggle moved it out of the view, then each day or repository group left
 * empty, and shows the caught-up state once no row is left, as the server draws the next load.
 */
function sync(list: HTMLElement, view: InboxKeysProps["view"]): void {
	for (let row of list.querySelectorAll<HTMLElement>(ROWS)) row.hidden = !belongs(row, view);
	for (let group of list.querySelectorAll<HTMLElement>("[data-inbox-group]")) {
		group.hidden = group.querySelector(`${ROWS}:not([hidden])`) === null;
	}
	let empty = list.querySelector(`${ROWS}:not([hidden])`) === null;
	let cleared = list.querySelector<HTMLElement>("[data-inbox-cleared]");
	if (cleared !== null) cleared.hidden = !empty;
}

/** Keeps the view's rows in step with their toggles as they flip. */
const viewSync = createMixin<
	HTMLElement,
	[options: { within: string; view: InboxKeysProps["view"] }]
>((handle) => {
	let options: { within: string; view: InboxKeysProps["view"] } | undefined;
	handle.addEventListener("insert", (event) => {
		let list = event.node.closest<HTMLElement>(options?.within ?? "");
		if (list === null || options === undefined) return;
		let view = options.view;
		let observer = new MutationObserver(() => sync(list, view));
		observer.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-pressed"] });
		handle.signal.addEventListener("abort", () => observer.disconnect());
	});
	return (next) => {
		options = next;
	};
});

/** Renders a hidden marker carrying the inbox's row navigation and its `e` key. */
export const InboxKeys: EntryComponent<InboxKeysProps> = clientEntry(
	import.meta.url,
	function InboxKeys(handle) {
		return () => {
			let { labels, view, within } = handle.props;
			return (
				<span
					mix={[
						hidden(),
						rowNavigation({
							within,
							rows: ROWS,
							primary: "a[data-row-link]",
							labels,
						}),
						doneKey({ within, label: labels.done, group: labels.group }),
						viewSync({ within, view }),
					]}
				/>
			);
		};
	},
);
