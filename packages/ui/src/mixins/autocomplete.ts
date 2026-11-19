/**
 * Turns a server-rendered `Autocomplete` into an ARIA combobox: the native `<datalist>` gives
 * way to a styled listbox that filters as the reader types, walks with the arrows and picks on
 * Enter or a press. Without script the field keeps its datalist and submits the typed text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createMixin } from "remix/component";

import { chooseOption, chosenOption } from "./active-descendant-keys.js";

/** Name of the bubbling event a pick dispatches on the field, carrying {@link AutocompleteSelectDetail}. */
export const AUTOCOMPLETE_SELECT_EVENT = "autocomplete-select";

/** Gap, in pixels, between the field and the list under it, and between the list and the viewport. */
const GAP = 6;

/** Height, in pixels, below which the list opens above the field when there is more room there. */
const MIN_LIST_HEIGHT = 200;

/** Widest a list grows past a narrow field, in pixels, before the viewport caps it. */
const MIN_LIST_WIDTH = 256;

/** The option a pick chose, as the `detail` of {@link AUTOCOMPLETE_SELECT_EVENT}. */
export interface AutocompleteSelectDetail {
	value: string;
	label: string;
}

declare global {
	interface HTMLElementEventMap {
		[AUTOCOMPLETE_SELECT_EVENT]: CustomEvent<AutocompleteSelectDetail>;
	}
}

/** The parts of one autocomplete the behavior reads and writes. */
interface Parts {
	root: HTMLElement;
	input: HTMLInputElement;
	popup: HTMLElement;
	listbox: HTMLElement;
	options: Array<HTMLElement>;
	heading: HTMLElement | null;
	empty: HTMLElement | null;
	hidden: HTMLInputElement | null;
}

/** Collects the parts under `root`, or `null` when its markup is incomplete. */
function partsOf(root: HTMLElement): Parts | null {
	let input = root.querySelector<HTMLInputElement>("[data-autocomplete-input]");
	let popup = root.querySelector<HTMLElement>("[data-autocomplete-popup]");
	let listbox = root.querySelector<HTMLElement>("[data-autocomplete-listbox]");
	if (!input || !popup || !listbox) return null;
	return {
		root,
		input,
		popup,
		listbox,
		options: Array.from(listbox.querySelectorAll<HTMLElement>("[data-autocomplete-option]")),
		heading: root.querySelector<HTMLElement>("[data-autocomplete-heading]"),
		empty: root.querySelector<HTMLElement>("[data-autocomplete-empty]"),
		hidden: root.querySelector<HTMLInputElement>("[data-autocomplete-value]"),
	};
}

/**
 * Writes `text` into `target`, wrapping its first case-insensitive occurrence of `query` in a
 * `<mark>`, so the reader sees why each option matched.
 */
function highlight(target: Element | null, text: string, query: string): void {
	if (!target) return;
	let at = query ? text.toLowerCase().indexOf(query) : -1;
	if (at < 0) {
		target.replaceChildren(text);
		return;
	}
	let mark = target.ownerDocument.createElement("mark");
	mark.textContent = text.slice(at, at + query.length);
	target.replaceChildren(text.slice(0, at), mark, text.slice(at + query.length));
}

/**
 * Shows the options whose label or description holds the typed text, ignoring case, and gives
 * every other one up as an option, so the arrows only walk what is on screen. The heading
 * shows while the field is empty, and the empty message while nothing matches.
 */
function filter(parts: Parts): void {
	let query = parts.input.value.trim().toLowerCase();
	let shown = 0;
	for (let option of parts.options) {
		let label = option.dataset.label ?? "";
		let description = option.dataset.description ?? "";
		let match =
			query === "" ||
			label.toLowerCase().includes(query) ||
			description.toLowerCase().includes(query);
		option.hidden = !match;
		option.setAttribute("role", match ? "option" : "presentation");
		if (match) shown += 1;
		highlight(option.querySelector("[data-autocomplete-label]"), label, query);
		highlight(option.querySelector("[data-autocomplete-description]"), description, query);
	}
	if (parts.heading) parts.heading.hidden = query !== "";
	if (parts.empty) parts.empty.hidden = shown > 0;
	chooseOption(parts.input, -1);
}

/**
 * Places the list under the field in viewport coordinates, as wide as the field and never
 * past the viewport's edges, flipping above it when the room below is short and above is not.
 */
function place(parts: Parts): void {
	let view = parts.input.ownerDocument.documentElement;
	let rect = parts.input.getBoundingClientRect();
	let viewWidth = view.clientWidth;
	let viewHeight = view.clientHeight;
	let width = Math.min(Math.max(rect.width, MIN_LIST_WIDTH), viewWidth - GAP * 2);
	let left = Math.max(GAP, Math.min(rect.left, viewWidth - width - GAP));
	let below = viewHeight - rect.bottom - GAP * 2;
	let above = rect.top - GAP * 2;
	let flip = below < MIN_LIST_HEIGHT && above > below;
	let style = parts.popup.style;
	style.setProperty("left", `${left}px`);
	style.setProperty("inline-size", `${width}px`);
	style.setProperty("max-block-size", `${Math.max(flip ? above : below, 0)}px`);
	if (flip) {
		style.removeProperty("top");
		style.setProperty("bottom", `${viewHeight - rect.top + GAP}px`);
	} else {
		style.removeProperty("bottom");
		style.setProperty("top", `${rect.bottom + GAP}px`);
	}
}

/** Whether the list is showing. */
function isOpen(parts: Parts): boolean {
	return parts.popup.matches(":popover-open");
}

/** Shows the list under the field. */
function open(parts: Parts): void {
	if (parts.input.disabled || parts.input.readOnly) return;
	if (!isOpen(parts)) parts.popup.showPopover();
	place(parts);
	parts.input.setAttribute("aria-expanded", "true");
}

/** Hides the list and drops the active option. */
function close(parts: Parts): void {
	if (isOpen(parts)) parts.popup.hidePopover();
	parts.input.setAttribute("aria-expanded", "false");
	chooseOption(parts.input, -1);
}

/** The options the typed text left showing, in document order. */
function shownOptions(parts: Parts): Array<HTMLElement> {
	return parts.options.filter((option) => !option.hidden);
}

/**
 * Fills the field with `option`'s label and its value into the hidden field, closes the list,
 * and tells the page as a native pick would: a bubbling `change`, then
 * {@link AUTOCOMPLETE_SELECT_EVENT} with the value and label.
 */
function pick(parts: Parts, option: HTMLElement): void {
	let label = option.dataset.label ?? "";
	let value = option.dataset.value ?? "";
	parts.input.value = label;
	if (parts.hidden) parts.hidden.value = value;
	parts.root.dataset.picked = label;
	close(parts);
	filter(parts);
	parts.input.dispatchEvent(new Event("change", { bubbles: true }));
	parts.input.dispatchEvent(
		new CustomEvent<AutocompleteSelectDetail>(AUTOCOMPLETE_SELECT_EVENT, {
			bubbles: true,
			detail: { value, label },
		}),
	);
}

/**
 * Moves the active option by `step` through the showing options, wrapping at both ends, and
 * opens the list first when it is closed.
 */
function move(parts: Parts, step: 1 | -1): void {
	open(parts);
	let rows = shownOptions(parts);
	if (rows.length === 0) return;
	let current = chosenOption(parts.input);
	let next = current + step;
	if (current < 0 && step < 0) next = rows.length - 1;
	if (next >= rows.length) next = 0;
	if (next < 0) next = rows.length - 1;
	chooseOption(parts.input, next);
}

/** Answers the field's keys: arrows walk, Enter picks without submitting, Escape closes then clears. */
function onKeyDown(parts: Parts, event: KeyboardEvent): void {
	if (event.defaultPrevented || event.isComposing) return;
	if (event.key === "ArrowDown") {
		event.preventDefault();
		if (event.altKey) open(parts);
		else move(parts, 1);
	} else if (event.key === "ArrowUp") {
		event.preventDefault();
		move(parts, -1);
	} else if (event.key === "Enter") {
		let row = shownOptions(parts)[chosenOption(parts.input)];
		if (!isOpen(parts) || !row) return;
		event.preventDefault();
		pick(parts, row);
	} else if (event.key === "Escape") {
		if (isOpen(parts)) {
			event.preventDefault();
			close(parts);
		} else if (parts.input.value !== "") {
			event.preventDefault();
			parts.input.value = "";
			edited(parts);
		}
	} else if (event.key === "Tab") close(parts);
}

/** Refilters after the text changed, and forgets a picked value once the text no longer reads as it. */
function edited(parts: Parts): void {
	if (parts.input.value !== parts.root.dataset.picked) {
		if (parts.hidden) parts.hidden.value = "";
		delete parts.root.dataset.picked;
	}
	filter(parts);
}

/**
 * Wires every listener for one autocomplete, removed through `signal`. A press inside the list
 * keeps focus in the field, so the field's blur alone closes the list on a click elsewhere or
 * on Tab; scroll and resize keep an open list under its field.
 */
function enhance(parts: Parts, signal: AbortSignal): void {
	let { input, popup, root } = parts;
	let options = { signal };
	input.removeAttribute("list");
	input.setAttribute("role", "combobox");
	input.setAttribute("aria-autocomplete", "list");
	input.setAttribute("aria-expanded", "false");
	input.setAttribute("aria-controls", parts.listbox.id);
	root.dataset.enhanced = "";
	filter(parts);

	input.addEventListener("focus", () => open(parts), options);
	input.addEventListener("click", () => open(parts), options);
	input.addEventListener(
		"input",
		() => {
			edited(parts);
			open(parts);
		},
		options,
	);
	input.addEventListener("keydown", (event) => onKeyDown(parts, event), options);
	input.addEventListener("blur", () => close(parts), options);
	popup.addEventListener("pointerdown", (event) => event.preventDefault(), options);
	popup.addEventListener(
		"pointermove",
		(event) => {
			let row = event.target instanceof Element ? event.target.closest("[role='option']") : null;
			if (!(row instanceof HTMLElement)) return;
			let index = shownOptions(parts).indexOf(row);
			if (index >= 0 && index !== chosenOption(input)) chooseOption(input, index);
		},
		options,
	);
	popup.addEventListener(
		"click",
		(event) => {
			let row = event.target instanceof Element ? event.target.closest("[role='option']") : null;
			if (row instanceof HTMLElement) pick(parts, row);
		},
		options,
	);
	let view = input.ownerDocument.defaultView;
	/** Keeps an open list under its field as the page scrolls or resizes. */
	function reposition() {
		if (isOpen(parts)) place(parts);
	}
	view?.addEventListener("resize", reposition, options);
	view?.addEventListener("scroll", reposition, { signal, capture: true, passive: true });
}

/**
 * Enhances the `[data-slot="autocomplete"]` around the host into a combobox over its styled
 * list, and undoes nothing on removal beyond dropping its listeners. Mount it on a hidden
 * element inside the autocomplete, which is how the island that carries it renders.
 *
 * @example <span hidden mix={autocomplete()} />
 */
export const autocomplete = createMixin<HTMLElement>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		let root = event.node.closest<HTMLElement>('[data-slot="autocomplete"]');
		let parts = root ? partsOf(root) : null;
		if (!parts) return;
		controller = new AbortController();
		enhance(parts, controller.signal);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});
