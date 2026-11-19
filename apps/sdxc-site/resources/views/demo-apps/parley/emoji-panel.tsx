/**
 * Parley's one emoji picker, shared by the composer and every message: a page-level island
 * that opens the picker beside whichever button asked, inserts a pick at the composer's caret
 * or adds it as a reaction in place, makes reactions answer at once, and handles quick reactions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmojiEntry } from "@sdxc/emoji";
import type { EmojiPickEvent } from "@sdxc/emoji/ui";
import type { EntryComponent, Handle } from "remix/component";

import { isCustomEmoji, preferredName } from "@sdxc/emoji";
import { EMOJI_PICK_EVENT, EmojiPicker, emojiPicker } from "@sdxc/emoji/ui";
import { raw } from "@sdxc/u/general";
import { ReactionAddEvent, reactionSync } from "@sdxc/ui/chat";
import { clientEntry, ref } from "remix/component";

import { CATALOG, customEmoji, emojiLabel } from "~/resources/views/demo-apps/parley/emoji";

/** The id of the shared picker's popover. */
export const EMOJI_PANEL_ID = "parley-emoji";

/** The categories in the order the picker lists them, Fernhill's own first. */
const CATEGORIES = [
	{ id: "custom", label: "Fernhill", glyph: "🌿" },
	{ id: "smileys-emotion", label: "Smileys", glyph: "😀" },
	{ id: "people-body", label: "People", glyph: "👋" },
	{ id: "animals-nature", label: "Nature", glyph: "🐈" },
	{ id: "food-drink", label: "Food", glyph: "🍅" },
	{ id: "travel-places", label: "Travel", glyph: "🚲" },
	{ id: "activities", label: "Activities", glyph: "🎉" },
	{ id: "objects", label: "Objects", glyph: "💡" },
	{ id: "symbols", label: "Symbols", glyph: "✅" },
	{ id: "flags", label: "Flags", glyph: "🏁" },
] as const;

/** The key a pick posts and inserts as: the character, or a custom's `:shortcode:`. */
export function emojiKey(entry: EmojiEntry): string {
	return isCustomEmoji(entry) ? `:${preferredName(entry)}:` : entry.emoji;
}

namespace EmojiGrid {
	export interface Props {
		/**
		 * Makes every cell a submit button with this field name and the emoji's key, for the
		 * reaction page a visitor without script reaches.
		 */
		submit?: string;
	}
}

/**
 * The picker's contents: search, a tab per category and every emoji in Parley's catalog,
 * Fernhill's customs first. Search and the tabs work once the `emojiPicker()` mixin runs; without
 * it every cell shows.
 */
export function EmojiGrid(handle: Handle<EmojiGrid.Props>) {
	return () => {
		let { submit } = handle.props;
		return (
			<>
				<EmojiPicker.Search
					aria-label="Search emoji"
					placeholder="Search emoji"
					mix={[raw({ "@media (scripting: none)": { display: "none" } })]}
				/>
				<EmojiPicker.Categories aria-label="Emoji categories">
					{CATEGORIES.map((category) => (
						<EmojiPicker.CategoryTab category={category.id} label={category.label}>
							{category.glyph}
						</EmojiPicker.CategoryTab>
					))}
				</EmojiPicker.Categories>
				<EmojiPicker.Viewport>
					{CATEGORIES.map((category) => (
						<EmojiPicker.Category id={category.id} label={category.label}>
							{CATALOG.filter((entry) => entry.category === category.id).map((entry) =>
								submit === undefined ? (
									<EmojiPicker.Cell entry={entry} />
								) : (
									<EmojiPicker.Cell
										entry={entry}
										type="submit"
										name={submit}
										value={emojiKey(entry)}
									/>
								),
							)}
						</EmojiPicker.Category>
					))}
				</EmojiPicker.Viewport>
				<EmojiPicker.Empty>No emoji match</EmojiPicker.Empty>
				<EmojiPicker.Status />
			</>
		);
	};
}

/** What the open picker does with a pick: write into a field, or react to a message. */
type Mode = { kind: "insert"; field: string } | { kind: "react"; message: string };

/** The reaction row of a message, by the id its line carries. */
function barOf(message: string): Element | null {
	return document.querySelector(`[data-message="${CSS.escape(message)}"] [data-slot=reaction-bar]`);
}

/** Opens the panel beside `opener`, above it when there is room, kept inside the window. */
function place(panel: HTMLElement, opener: Element): void {
	let rect = opener.getBoundingClientRect();
	let width = Math.min(352, window.innerWidth - 16);
	let height = Math.min(400, window.innerHeight - 16);
	let left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
	let top = rect.top - height - 6 >= 8 ? rect.top - height - 6 : rect.bottom + 6;
	panel.style.left = `${left}px`;
	panel.style.top = `${Math.min(top, window.innerHeight - height - 8)}px`;
	panel.style.inlineSize = `${width}px`;
	panel.style.maxBlockSize = `${height}px`;
}

/** Writes a pick at a field's caret, as typing it would. */
function insert(field: HTMLTextAreaElement, text: string): void {
	field.focus();
	let start = field.selectionStart ?? field.value.length;
	let end = field.selectionEnd ?? start;
	field.setRangeText(text, start, end, "end");
	field.dispatchEvent(new Event("input", { bubbles: true }));
}

/** The reaction a pick or a quick reaction adds, with the name and image its chip shows. */
function reaction(key: string, toggle: boolean): ReactionAddEvent {
	return new ReactionAddEvent({
		emoji: key,
		label: emojiLabel(key),
		image: customEmoji(key)?.src,
		toggle,
	});
}

/**
 * Renders the shared picker as a popover, filled the first time it opens so a page carries no
 * thousands of cells it may never show, and the host that makes reactions answer at once.
 */
export const ParleyEmoji: EntryComponent<Record<string, never>> = clientEntry(
	import.meta.url,
	function ParleyEmoji(handle) {
		let filled = false;
		let mode: Mode | undefined;
		let opener: HTMLElement | undefined;
		return () => (
			<>
				<span
					hidden
					mix={[
						reactionSync(),
						ref((_node: HTMLElement, signal) => {
							document.addEventListener(
								"click",
								(event) => {
									let target = event.target;
									if (!(target instanceof Element)) return;
									let trigger = target.closest<HTMLElement>(
										"[data-emoji-insert], [data-emoji-react]",
									);
									let panel = document.getElementById(EMOJI_PANEL_ID);
									if (trigger === null || panel === null) return;
									event.preventDefault();
									let field = trigger.dataset.emojiInsert;
									let message = trigger.dataset.emojiReact;
									mode =
										field === undefined
											? { kind: "react", message: message ?? "" }
											: { kind: "insert", field };
									if (panel.matches(":popover-open") && opener === trigger) {
										panel.hidePopover();
										return;
									}
									opener = trigger;
									place(panel, trigger);
									panel.showPopover();
									let focusSearch = () =>
										panel.querySelector<HTMLInputElement>("[data-emoji-search]")?.focus();
									if (filled) requestAnimationFrame(focusSearch);
									else {
										filled = true;
										void handle.update().then(focusSearch);
									}
								},
								{ capture: true, signal },
							);
							document.addEventListener(
								"submit",
								(event) => {
									let form = event.target;
									if (!(form instanceof HTMLFormElement) || !form.dataset.quickReact) return;
									let key =
										event.submitter instanceof HTMLButtonElement ? event.submitter.value : "";
									let bar = barOf(form.dataset.quickReact);
									if (key === "" || bar === null) return;
									event.preventDefault();
									event.stopImmediatePropagation();
									bar.dispatchEvent(reaction(key, true));
								},
								{ capture: true, signal },
							);
						}),
					]}
				/>
				<div
					id={EMOJI_PANEL_ID}
					popover="auto"
					aria-label="Emoji"
					mix={[
						raw({
							position: "fixed",
							inset: "auto",
							margin: "0",
							padding: "0",
							border: "none",
							background: "transparent",
							overflow: "visible",
							"& [data-emoji-picker]": {
								inlineSize: "100%",
								boxSizing: "border-box",
								maxBlockSize: "inherit",
								boxShadow: "0 12px 32px -12px oklch(0 0 0 / 0.35)",
							},
							"& [data-emoji-picker] > :is([data-emoji-viewport], div:has(> section))": {
								overflowY: "auto",
								minBlockSize: "0",
							},
						}),
						ref((node: HTMLElement, signal) => {
							node.addEventListener(
								EMOJI_PICK_EVENT,
								(event) => {
									let { detail } = event as EmojiPickEvent;
									let key = detail.kind === "unicode" ? detail.emoji : `:${detail.name}:`;
									let current = mode;
									node.hidePopover();
									if (current?.kind === "insert") {
										let field = document.getElementById(current.field);
										if (field instanceof HTMLTextAreaElement) insert(field, key);
										return;
									}
									if (current?.kind === "react")
										barOf(current.message)?.dispatchEvent(reaction(key, false));
									opener?.focus();
								},
								{ signal },
							);
						}),
					]}
				>
					{filled ? (
						<EmojiPicker mix={[emojiPicker(), raw({ maxBlockSize: "inherit" })]}>
							<EmojiGrid />
						</EmojiPicker>
					) : null}
				</div>
			</>
		);
	},
);
