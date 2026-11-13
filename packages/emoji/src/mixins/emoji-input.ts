/**
 * Why JS: detecting an open `:name` token, filtering suggestions, and splicing
 * a pick into an input or textarea has no HTML equivalent.
 * No-JS baseline: the field still accepts typed `:shortcode:` text; render
 * paths expand known names later.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createElement, createMixin, on } from "remix/component";

import type { EmojiEntry, ShortcodeIndex } from "../lib/types.js";

import { EmojiPickEvent } from "../lib/events.js";
import { indexEntries } from "../lib/index-entries.js";
import { mixList } from "../lib/mix-list.js";
import { preferredName, searchEmojis, SUGGEST_MIN_CHARS } from "../lib/search.js";
import { isCustomEmoji, isUnicodeEmoji } from "../lib/types.js";

/** Options for {@link emojiInput}. */
export interface EmojiInputOptions {
	/** Catalog rows or a prebuilt shortcode index. */
	catalog: readonly EmojiEntry[] | ShortcodeIndex;
	/**
	 * Element that hosts suggest rows; the mixin fills it while a token is
	 * active and listens for picks on it.
	 */
	suggest: HTMLElement | string | (() => HTMLElement | null);
	/** Max suggest rows. @default 12 */
	limit?: number;
}

const TEXT_INPUT_TYPES = new Set(["text", "search", ""]);

/**
 * Opens colon-suggest after two characters following `:`, inserts Unicode or
 * `:name:` for customs on pick, and ignores password-like inputs and fenced
 * regions in textareas.
 */
export const emojiInput: MixinFactory<
	HTMLInputElement | HTMLTextAreaElement,
	[options: EmojiInputOptions]
> = createMixin<HTMLInputElement | HTMLTextAreaElement, [options: EmojiInputOptions], ElementProps>(
	(handle) => {
		let hostNode: HTMLInputElement | HTMLTextAreaElement | undefined;
		handle.addEventListener("insert", (event) => {
			hostNode = event.node;
		});
		handle.addEventListener("remove", () => {
			hostNode = undefined;
		});

		return (options, props = {}) => {
			let entries = resolveEntries(options.catalog);
			let index = resolveIndex(options.catalog);
			let limit = options.limit ?? 12;

			function suggestRoot(): HTMLElement | null {
				if (typeof options.suggest === "function") return options.suggest();
				if (typeof options.suggest === "string") {
					return hostNode?.ownerDocument.getElementById(options.suggest) ?? null;
				}
				return options.suggest;
			}

			function refresh() {
				let field = hostNode;
				if (!field || !isTextField(field)) return;
				completeClosedShortcode(field, index);
				let caret = field.selectionStart ?? field.value.length;
				let token = activeToken(field.value, caret);
				let root = suggestRoot();
				if (!root) return;
				if (!token || token.query.length < SUGGEST_MIN_CHARS) {
					root.hidden = true;
					root.replaceChildren();
					return;
				}
				fillSuggest(root, searchEmojis(entries, token.query, limit), field);
			}

			return createElement(handle.element, {
				...props,
				mix: [
					on<HTMLInputElement | HTMLTextAreaElement, "input">("input", () => refresh()),
					on<HTMLInputElement | HTMLTextAreaElement, "keydown">("keydown", (event) => {
						let root = suggestRoot();
						if (!root || root.hidden) return;
						let items = [...root.querySelectorAll<HTMLElement>("[data-emoji-item]")];
						let active = items.findIndex((item) => item.dataset.active !== undefined);
						if (event.key === "ArrowDown") {
							event.preventDefault();
							setActive(items, Math.min(items.length - 1, active + 1));
						} else if (event.key === "ArrowUp") {
							event.preventDefault();
							setActive(items, Math.max(0, active - 1));
						} else if (event.key === "Enter" && active >= 0) {
							event.preventDefault();
							items[active]?.click();
						} else if (event.key === "Escape") {
							event.preventDefault();
							root.hidden = true;
							root.replaceChildren();
						}
					}),
					...mixList(props.mix),
				],
			});
		};
	},
);

/**
 * When the caret sits just after a completed `:name:` that resolves to Unicode,
 * swaps that token for the character so typing a closing colon finishes the pick.
 */
function completeClosedShortcode(
	field: HTMLInputElement | HTMLTextAreaElement,
	index: ShortcodeIndex,
) {
	let caret = field.selectionStart ?? field.value.length;
	if (field.selectionEnd !== caret) return;
	if (isInsideFence(field.value, caret)) return;
	let before = field.value.slice(0, caret);
	let match = before.match(/(^|[\s(]):([a-z0-9_+-]+):$/i);
	if (!match) return;
	let name = match[2]!.toLowerCase();
	let entry = index.get(name);
	if (!entry || !isUnicodeEmoji(entry)) return;
	let token = `:${name}:`;
	let start = caret - token.length;
	field.value = field.value.slice(0, start) + entry.emoji + field.value.slice(caret);
	let at = start + entry.emoji.length;
	field.setSelectionRange(at, at);
}

function fillSuggest(
	root: HTMLElement,
	hits: EmojiEntry[],
	field: HTMLInputElement | HTMLTextAreaElement,
) {
	root.hidden = hits.length === 0;
	root.replaceChildren();
	for (let [rowIndex, entry] of hits.entries()) {
		let button = document.createElement("button");
		button.type = "button";
		button.dataset.emojiItem = "";
		button.dataset.name = preferredName(entry);
		if (isUnicodeEmoji(entry)) {
			button.dataset.kind = "unicode";
			button.dataset.emoji = entry.emoji;
			button.textContent = `${entry.emoji} :${preferredName(entry)}:`;
		} else {
			button.dataset.kind = "custom";
			button.dataset.src = entry.src;
			if (entry.label) button.dataset.label = entry.label;
			let img = document.createElement("img");
			img.src = entry.src;
			img.alt = entry.label ?? preferredName(entry);
			img.draggable = false;
			button.append(img, document.createTextNode(` :${preferredName(entry)}:`));
		}
		if (rowIndex === 0) button.dataset.active = "";
		button.addEventListener("click", () => {
			let detail = pickDetail(entry);
			let event = new EmojiPickEvent(detail);
			if (!root.dispatchEvent(event) || event.defaultPrevented) return;
			insertPick(field, detail);
			root.hidden = true;
			root.replaceChildren();
		});
		root.append(button);
	}
}

function insertPick(
	field: HTMLInputElement | HTMLTextAreaElement,
	detail: EmojiPickEvent["detail"],
) {
	let caret = field.selectionStart ?? field.value.length;
	let token = activeToken(field.value, caret);
	if (!token) return;
	let insertion = detail.kind === "unicode" ? detail.emoji : `:${detail.name}:`;
	field.value = field.value.slice(0, token.start) + insertion + field.value.slice(caret);
	let at = token.start + insertion.length;
	field.setSelectionRange(at, at);
	field.dispatchEvent(new Event("input", { bubbles: true }));
}

function activeToken(value: string, caret: number): { start: number; query: string } | null {
	let before = value.slice(0, caret);
	let match = before.match(/(^|[\s(])(:([a-z0-9_+-]{0,64}))$/i);
	if (!match) return null;
	if (isInsideFence(value, caret)) return null;
	let token = match[2]!;
	let query = match[3] ?? "";
	if (query.includes(":")) return null;
	return { start: caret - token.length, query };
}

function setActive(items: HTMLElement[], index: number) {
	for (let [i, item] of items.entries()) {
		if (i === index) item.dataset.active = "";
		else delete item.dataset.active;
	}
}

function pickDetail(entry: EmojiEntry): EmojiPickEvent["detail"] {
	if (isCustomEmoji(entry)) {
		return { kind: "custom", name: preferredName(entry), src: entry.src, label: entry.label };
	}
	return { kind: "unicode", emoji: entry.emoji, name: preferredName(entry) };
}

function resolveEntries(catalog: readonly EmojiEntry[] | ShortcodeIndex): EmojiEntry[] {
	if (catalog instanceof Map) {
		return [...new Set(catalog.values())];
	}
	return [...(catalog as readonly EmojiEntry[])];
}

function resolveIndex(catalog: readonly EmojiEntry[] | ShortcodeIndex): ShortcodeIndex {
	if (catalog instanceof Map) return catalog;
	return indexEntries(catalog as readonly EmojiEntry[]);
}

function isTextField(field: EventTarget | null): field is HTMLInputElement | HTMLTextAreaElement {
	if (field instanceof HTMLTextAreaElement) return true;
	if (field instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(field.type);
	return false;
}

function isInsideFence(value: string, caret: number): boolean {
	let before = value.slice(0, caret);
	let fences = before.match(/```/g);
	return (fences?.length ?? 0) % 2 === 1;
}
