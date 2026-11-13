/**
 * Why JS: as-you-type cell filtering, category jump, and dispatching
 * `ui:emoji-pick` have no HTML equivalent.
 * No-JS baseline: every cell stays visible and activatable; the app can still
 * listen for clicks if it wires its own handler.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createElement, createMixin, on } from "remix/component";

import { EmojiPickEvent } from "../lib/events.js";
import { mixList } from "../lib/mix-list.js";

/**
 * Filters picker cells from the search field, scrolls category tabs to their
 * sections, and turns cell activation into a cancelable {@link EmojiPickEvent}.
 */
export const emojiPicker: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
	HTMLElement,
	[],
	ElementProps
>((handle) => {
	let hostNode: HTMLElement | undefined;
	handle.addEventListener("insert", (event) => {
		hostNode = event.node;
		applyFilter(event.node, "");
	});
	handle.addEventListener("remove", () => {
		hostNode = undefined;
	});

	return (props = {}) =>
		createElement(handle.element, {
			...props,
			mix: [
				on<HTMLElement, "input">("input", (event) => {
					let root = hostNode;
					if (!root) return;
					let target = event.target;
					if (!(target instanceof HTMLInputElement)) return;
					if (!target.hasAttribute("data-emoji-search")) return;
					applyFilter(root, target.value);
				}),
				on<HTMLElement, "click">("click", (event) => {
					let root = hostNode;
					if (!root) return;
					let target = event.target;
					if (!(target instanceof Element)) return;

					let tab = target.closest<HTMLElement>("[data-emoji-category-tab]");
					if (tab && root.contains(tab)) {
						let id = tab.dataset.emojiCategoryTab;
						if (!id) return;
						let section = root.querySelector<HTMLElement>(
							`[data-emoji-category="${CSS.escape(id)}"]`,
						);
						section?.scrollIntoView({ block: "start" });
						for (let other of root.querySelectorAll<HTMLElement>("[data-emoji-category-tab]")) {
							other.setAttribute("aria-selected", other === tab ? "true" : "false");
						}
						return;
					}

					let cell = target.closest<HTMLElement>("[data-emoji-cell]");
					if (!cell || !root.contains(cell)) return;
					let detail = cellDetail(cell);
					if (!detail) return;
					cell.dispatchEvent(new EmojiPickEvent(detail));
				}),
				...mixList(props.mix),
			],
		});
});

function applyFilter(root: HTMLElement, query: string) {
	let needle = query.replaceAll(":", "").trim().toLowerCase();
	let cells = [...root.querySelectorAll<HTMLElement>("[data-emoji-cell]")];
	let visible = 0;

	for (let cell of cells) {
		let name = (cell.dataset.name ?? "").toLowerCase();
		let emoji = (cell.dataset.emoji ?? "").toLowerCase();
		let match = needle === "" || name.includes(needle) || emoji.includes(needle);
		cell.hidden = !match;
		if (match) visible += 1;
	}

	for (let section of root.querySelectorAll<HTMLElement>("[data-emoji-category]")) {
		let any = [...section.querySelectorAll<HTMLElement>("[data-emoji-cell]")].some(
			(cell) => !cell.hidden,
		);
		section.hidden = needle !== "" && !any;
	}

	let empty = root.querySelector<HTMLElement>("[data-emoji-empty]");
	if (empty) empty.hidden = visible > 0 || needle === "";

	let status = root.querySelector<HTMLElement>("[data-emoji-status]");
	if (status && needle !== "") {
		status.textContent = String(visible);
	}
}

function cellDetail(cell: HTMLElement): EmojiPickEvent["detail"] | null {
	let name = cell.dataset.name;
	if (!name) return null;
	if (cell.dataset.kind === "custom") {
		let src = cell.dataset.src;
		if (!src) return null;
		return { kind: "custom", name, src, label: cell.dataset.label };
	}
	let emoji = cell.dataset.emoji;
	if (!emoji) return null;
	return { kind: "unicode", emoji, name };
}
