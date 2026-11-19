/**
 * Wires a mention list to a composer's field: it follows the caret into an `@handle` being
 * typed, steers the list from the field's keys, writes the picked handle and mirrors the
 * combobox state on the field. Why JS: caret tracking and the keys need script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import type { MentionPerson } from "../utils/mention-query.js";

import { findComposerInput, replaceText } from "../utils/composer-text.js";
import { mentionMatches, mentionQuery } from "../utils/mention-query.js";

/** The gap between the composer's edge and the list, in pixels. */
const MENU_OFFSET = 8;

/** The widest the list grows, in pixels, however wide the composer is. */
const MENU_MAX_WIDTH = 320;

/** A character that continues a handle after the caret, replaced along with the query. */
const HANDLE_TAIL = /[\p{L}\p{N}_.-]/u;

/** The attribute each option carries with its position in the list. */
export const MENTION_INDEX_ATTRIBUTE = "data-mention-index";

/** What the list shows: whether it is open, the query it filters by and the active row. */
export interface MentionMenuState {
	open: boolean;
	query: string;
	active: number;
}

/** Options for {@link mentionMenu}. */
export interface MentionMenuOptions {
	people: readonly MentionPerson[];
	/** @default "@" */
	trigger?: string;
	/** The `id` of the `<textarea>` to watch; the host form's `Composer.Input` when omitted. */
	target?: string;
	limit: number;
	/** The listbox's `id`, which the field's `aria-controls` names. */
	listId: string;
	/** Told every change, and resolves once the host has rendered it. */
	onChange: (state: MentionMenuState) => Promise<unknown>;
}

/** The `id` of a person's option, which the field's `aria-activedescendant` names. */
export function mentionOptionId(listId: string, person: MentionPerson): string {
	return `${listId}-${person.id}`;
}

/**
 * Sets the open list over the composer's frame, aligned with its start edge, or under it when
 * the space above cannot hold the list and the space below is larger. The list never grows
 * past the side it opens on, so every option stays reachable on a short screen.
 */
function place(menu: HTMLElement, frame: DOMRect) {
	let viewport = menu.ownerDocument.documentElement.clientHeight;
	menu.style.left = `${Math.max(0, frame.left)}px`;
	menu.style.width = `${Math.min(frame.width, MENU_MAX_WIDTH)}px`;
	menu.style.maxHeight = "";
	let height = menu.offsetHeight;
	let above = frame.top - MENU_OFFSET * 2;
	let below = viewport - frame.bottom - MENU_OFFSET * 2;
	let under = height > above && below > above;
	menu.style.maxHeight = `min(16rem, ${Math.max(0, under ? below : above)}px)`;
	menu.style.top = under ? `${frame.bottom + MENU_OFFSET}px` : "auto";
	menu.style.bottom = under ? "auto" : `${viewport - frame.top + MENU_OFFSET}px`;
}

/**
 * Put on a `popover="manual"` list inside a composer's form. While open, ArrowUp and ArrowDown
 * move, Enter or Tab write the active person's handle, Escape closes, and those keys are
 * cancelled during capture on the form so the composer's Enter-to-send leaves them alone.
 *
 * @example <div popover="manual" mix={[mentionMenu({ people, limit: 6, listId, onChange })]}>…</div>
 */
export const mentionMenu: MixinFactory<HTMLElement, [options: MentionMenuOptions]> = createMixin<
	HTMLElement,
	[options: MentionMenuOptions]
>((handle) => {
	let options: MentionMenuOptions | undefined;
	let menu: HTMLElement | undefined;
	let field: HTMLTextAreaElement | null = null;
	let state: MentionMenuState = { open: false, query: "", active: 0 };
	let start = -1;
	/** The host's lifetime, taken while it is inserted, so later events can tell it was removed. */
	let lifetime: AbortSignal | undefined;
	/** The start of a mention Escape dismissed, which stays closed until the caret leaves it. */
	let dismissed = -1;

	/** The people the current query lists. */
	function matches(): MentionPerson[] {
		if (options === undefined) return [];
		return mentionMatches(options.people, state.query, options.limit);
	}

	/** Shows or hides the list, places it over the composer and mirrors the state on the field. */
	function reflect() {
		if (menu === undefined || field === null || options === undefined) return;
		if (!state.open) {
			if (menu.matches(":popover-open")) menu.hidePopover();
			field.setAttribute("aria-expanded", "false");
			field.removeAttribute("aria-controls");
			field.removeAttribute("aria-activedescendant");
			return;
		}
		if (!menu.matches(":popover-open")) menu.showPopover();
		place(menu, (field.closest("form") ?? field).getBoundingClientRect());
		field.setAttribute("aria-expanded", "true");
		field.setAttribute("aria-controls", options.listId);
		let current = matches()[state.active];
		if (current === undefined) return field.removeAttribute("aria-activedescendant");
		let id = mentionOptionId(options.listId, current);
		field.setAttribute("aria-activedescendant", id);
		menu.ownerDocument.getElementById(id)?.scrollIntoView({ block: "nearest" });
	}

	/** Hands the new state to the host, then reflects it once rendered. */
	async function commit(next: MentionMenuState) {
		state = next;
		if (lifetime?.aborted !== false || options === undefined) return;
		await options.onChange(next);
		reflect();
	}

	/** Closes the list without touching the text. */
	function close() {
		if (state.open) void commit({ ...state, open: false });
	}

	/** Reads the mention the caret is in, opening, refiltering or closing the list to match. */
	function sync() {
		if (field === null) return;
		let caret = field.selectionStart;
		let found =
			caret === field.selectionEnd
				? mentionQuery(field.value, caret, options?.trigger ?? "@")
				: null;
		if (found === null || found.start === dismissed) {
			if (found === null) dismissed = -1;
			return close();
		}
		if (state.open && found.query === state.query && found.start === start) return;
		let active = found.query === state.query && found.start === start ? state.active : 0;
		start = found.start;
		void commit({ open: true, query: found.query, active });
	}

	/** Writes the person's handle over the mention being typed, followed by a space. */
	function pick(person: MentionPerson) {
		if (field === null || !state.open) return;
		let end = field.selectionStart;
		while (end < field.value.length && HANDLE_TAIL.test(field.value[end] ?? "")) end += 1;
		state = { ...state, open: false };
		replaceText(field, start, end, `${options?.trigger ?? "@"}${person.handle} `);
		void commit(state);
	}

	/** Moves the active option by `step`, wrapping at either end. */
	function move(step: number) {
		let count = matches().length;
		if (count === 0) return;
		void commit({ ...state, active: (state.active + step + count) % count });
	}

	/** Steers the list from the field's keys, cancelling the ones it uses. */
	function onKeydown(event: KeyboardEvent) {
		if (!state.open || event.target !== field || event.isComposing) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			return move(event.key === "ArrowDown" ? 1 : -1);
		}
		if (event.key === "Escape") {
			event.preventDefault();
			dismissed = start;
			return close();
		}
		if ((event.key !== "Enter" && event.key !== "Tab") || event.shiftKey) return;
		let person = matches()[state.active];
		if (person === undefined) return close();
		event.preventDefault();
		pick(person);
	}

	/** The position of the option an event landed in, or `-1` outside every option. */
	function indexOf(event: Event): number {
		if (!(event.target instanceof Element)) return -1;
		let option = event.target.closest(`[${MENTION_INDEX_ATTRIBUTE}]`);
		return option === null ? -1 : Number(option.getAttribute(MENTION_INDEX_ATTRIBUTE));
	}

	handle.addEventListener("insert", ({ node }) => {
		let signal = handle.signal;
		lifetime = signal;
		menu = node;
		field = findComposerInput(node, options?.target);
		if (field === null) return;
		let input = field;
		input.setAttribute("aria-autocomplete", "list");
		input.setAttribute("aria-haspopup", "listbox");
		input.setAttribute("aria-expanded", "false");
		let form: HTMLElement = input.closest("form") ?? input;
		form.addEventListener("keydown", onKeydown, { capture: true, signal });
		input.addEventListener("input", sync, { signal });
		input.addEventListener("click", sync, { signal });
		input.addEventListener(
			"keyup",
			(event) => {
				if (/^(Arrow(Left|Right)|Home|End)$/.test(event.key)) sync();
			},
			{ signal },
		);
		input.addEventListener("blur", close, { signal });
		node.addEventListener(
			"pointerdown",
			(event) => {
				if (indexOf(event) !== -1) event.preventDefault();
			},
			{ signal },
		);
		node.addEventListener(
			"pointermove",
			(event) => {
				let index = indexOf(event);
				if (index !== -1 && index !== state.active) void commit({ ...state, active: index });
			},
			{ signal },
		);
		node.addEventListener(
			"click",
			(event) => {
				let person = matches()[indexOf(event)];
				if (person !== undefined) pick(person);
			},
			{ signal },
		);
		signal.addEventListener("abort", () => {
			for (let name of ["aria-autocomplete", "aria-haspopup", "aria-expanded"]) {
				input.removeAttribute(name);
			}
		});
	});

	return (next) => {
		options = next;
		return handle.element;
	};
});
