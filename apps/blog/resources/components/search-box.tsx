/**
 * Client island: the search dialog's box, which turns typing into live results by reloading
 * the frame it is rendered in from the frame URL for the text and kind tab so far. Without
 * script it is the `q` field of a `GET` form to `/search`, submitted by Enter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { pi } from "@sdxc/u/size";
import { Spinner } from "@sdxc/ui";
import { spin } from "@sdxc/ui/animations";
import { clientEntry, on } from "remix/component";

import { QuietSearchInput, QuietSearchRow } from "~/resources/components/quiet-search-input";
import { watchSearchDialog } from "~/resources/components/search-keys";

/** How long typing must pause before the results follow it. */
export const SEARCH_DEBOUNCE_MS = 200;

/**
 * How long after a keystroke the spinner waits before it shows. Results that arrive within
 * it (the debounce plus a quick answer) swap in with no spinner flashing first.
 */
export const SPINNER_DELAY_MS = 350;

/**
 * How long arrows must pause on a tab before its results load, so pressing through several
 * tabs loads only the one the reader stops on.
 */
export const TAB_DEBOUNCE_MS = 150;

/** How long the panel takes to grow or shrink to the new results. */
const RESIZE_MS = 160;

/** The results region the box marks busy while newer results are on their way. */
export const SEARCH_RESULTS_ID = "site-search-results";

/** The attribute naming the kind a tab link narrows to, empty for "All". */
export const SEARCH_KIND_ATTRIBUTE = "data-search-kind";

/** The listbox of result rows the box's combobox controls. */
export const SEARCH_LISTBOX_ID = "site-search-options";

/** The id of the result row at `index`, which `aria-activedescendant` names. */
export function searchOptionId(index: number): string {
	return `${SEARCH_LISTBOX_ID}-${index}`;
}

/** Every result row on screen, in order. */
function options(): Array<HTMLElement> {
	let listbox = document.getElementById(SEARCH_LISTBOX_ID);
	return listbox ? Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]')) : [];
}

/** Follows the link a result row holds, as a click on it would. */
function follow(option: HTMLElement | undefined): void {
	option?.querySelector<HTMLAnchorElement>("a[href]")?.click();
}

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type SearchBoxProps = {
	/** The input's id. */
	id: string;
	/** The text the frame was rendered for, which an unedited box starts from. */
	query: string;
	/** The frame endpoint without a query, so the route owns its own address. */
	frameSrc: string;
	/** The dialog whose closing resets the box. */
	dialogId: string;
	/** How many result rows the frame rendered under the box. */
	optionCount: number;
	/** The kind the rows are narrowed to, empty for "All". */
	kind: string;
	/** Every tab's kind in order, "All" first as empty; empty while no tabs show. */
	kinds: Array<string>;
};

/**
 * The frame URL for a box's text and kind tab: the bare endpoint for a blank box, so clearing
 * the box returns the frame to the address it renders blank from, whatever tab was open.
 */
export function searchFrameSrc(frameSrc: string, text: string, kind = ""): string {
	let query = text.trim();
	if (query === "") return frameSrc;
	let params = new URLSearchParams({ q: query });
	if (kind !== "") params.set("kind", kind);
	return `${frameSrc}?${params}`;
}

/** Marks the results region busy, or clears the mark. */
function markBusy(busy: boolean): void {
	let results = document.getElementById(SEARCH_RESULTS_ID);
	if (busy) results?.setAttribute("aria-busy", "true");
	else results?.removeAttribute("aria-busy");
}

/**
 * Animates `dialog` from the height it had before new results landed to the one it has now.
 * The panel is anchored at its top, so it grows and shrinks downward only.
 */
function resize(dialog: HTMLDialogElement | null, from: number): void {
	if (dialog === null || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	let to = dialog.offsetHeight;
	if (to === from) return;
	dialog.animate(
		[
			{ height: `${from}px`, overflow: "hidden" },
			{ height: `${to}px`, overflow: "hidden" },
		],
		{ duration: RESIZE_MS, easing: "ease-out" },
	);
}

/**
 * The dialog's box, a combobox over the result rows; typing reloads the frame once it pauses,
 * arrows choose a row with focus kept in the box, and closing the dialog restores the page's
 * own state. Being the island every page hydrates, it also attaches the dialog's page keys
 * and turns a click on a kind tab into reloading the results for that kind.
 */
export const SearchBox = clientEntry(
	import.meta.url,
	function SearchBox(handle: Handle<SearchBoxProps>) {
		let debounce: ReturnType<typeof setTimeout> | undefined;
		let spinnerDelay: ReturnType<typeof setTimeout> | undefined;
		let spinning = false;
		/** Whether typing has moved past the results on screen. */
		let pending = false;
		/** The chosen row's index, or `-1` while the box itself is the choice. */
		let selected = -1;
		/** Counts keystrokes, so a reload only settles the state when no newer one is pending. */
		let latest = 0;
		/** The tab marked ahead of its results, or `null` once the frame shows the tab it marks. */
		let markedKind: string | null = null;
		/** What the page rendered the box with, which closing the dialog returns it to. */
		let initialQuery = handle.props.query;
		let initialSrc = searchFrameSrc(handle.props.frameSrc, initialQuery);

		handle.signal.addEventListener("abort", () => {
			clearTimeout(debounce);
			clearTimeout(spinnerDelay);
		});

		handle.queueTask(() => {
			watchSearchDialog(handle.signal);
			let dialog = document.getElementById(handle.props.dialogId);
			dialog?.addEventListener("close", reset, { signal: handle.signal });
			dialog?.addEventListener("click", openTab, { signal: handle.signal });
		});

		/** Marks a search pending: busy at once, and the spinner after its delay. */
		function begin(): void {
			pending = true;
			markBusy(true);
			clearTimeout(spinnerDelay);
			spinnerDelay = setTimeout(() => {
				spinning = true;
				void handle.update();
			}, SPINNER_DELAY_MS);
		}

		/** Clears the pending marks once the newest results are showing. */
		function settle(): void {
			pending = false;
			markedKind = null;
			markBusy(false);
			clearTimeout(spinnerDelay);
			if (!spinning) return;
			spinning = false;
			void handle.update();
		}

		/** Chooses the row at `index`, or the box itself for `-1`, keeping focus in the box. */
		function choose(index: number): void {
			selected = index;
			let rows = options();
			rows.forEach((row, at) => row.setAttribute("aria-selected", at === index ? "true" : "false"));
			rows[index]?.scrollIntoView?.({ block: "nearest" });
			void handle.update();
		}

		/**
		 * Points the frame at `src` and reloads it, unless it already shows it. The new rows
		 * start unchosen, or with the first one chosen when `chooseFirst` asks, so arrows that
		 * switched tabs keep switching them.
		 */
		async function load(
			src: string,
			dialog: HTMLDialogElement | null,
			keystroke: number,
			chooseFirst = false,
		) {
			if (src === handle.frame.src) return settle();

			let from = dialog?.offsetHeight ?? 0;
			handle.frame.src = src;
			await handle.frame.reload().catch(() => undefined);

			if (keystroke !== latest) return markBusy(true);
			settle();
			choose(chooseFirst && options().length > 0 ? 0 : -1);
			resize(dialog, from);
		}

		/** The tab the reader is on: the one marked ahead of its results, else the frame's. */
		function currentKind(): string {
			return markedKind ?? handle.props.kind;
		}

		/**
		 * Marks `kind`'s tab current at once and loads its results after `delay`, so the tab
		 * follows every press while the results load only for the tab the reader stops on.
		 */
		function switchTab(kind: string, chooseFirst: boolean, delay: number): void {
			let box = document.getElementById(handle.props.id);
			if (!(box instanceof HTMLInputElement)) return;
			markedKind = kind;
			for (let tab of document.querySelectorAll(`[${SEARCH_KIND_ATTRIBUTE}]`)) {
				if (tab.getAttribute(SEARCH_KIND_ATTRIBUTE) === kind) {
					tab.setAttribute("aria-current", "true");
					tab.scrollIntoView?.({ block: "nearest", inline: "nearest" });
				} else tab.removeAttribute("aria-current");
			}
			clearTimeout(debounce);
			let keystroke = ++latest;
			begin();
			let text = box.value;
			debounce = setTimeout(() => {
				void load(
					searchFrameSrc(handle.props.frameSrc, text, kind),
					box.closest("dialog"),
					keystroke,
					chooseFirst,
				);
			}, delay);
		}

		/**
		 * Turns a plain click on a kind tab into switching tabs in place; a modified or middle
		 * click still opens the tab's `/search` page as the link it is.
		 */
		function openTab(event: MouseEvent): void {
			let tab = event.target instanceof Element ? event.target.closest("a") : null;
			let kind = tab?.getAttribute(SEARCH_KIND_ATTRIBUTE);
			if (kind === null || kind === undefined) return;
			if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
				return;
			}
			event.preventDefault();
			switchTab(kind, false, 0);
			document.getElementById(handle.props.id)?.focus();
		}

		/**
		 * Returns the box and the frame to how the page rendered them, so the dialog reopens on
		 * the page's own query (blank on every page but `/search`) with nothing pending.
		 */
		function reset(): void {
			clearTimeout(debounce);
			let keystroke = ++latest;
			let box = document.getElementById(handle.props.id);
			if (box instanceof HTMLInputElement) box.value = initialQuery;
			choose(-1);
			void load(initialSrc, null, keystroke);
		}

		/**
		 * Moves the choice through the rows: down from the box to the first row and around from
		 * the last, up from the first back to the box. While a row is chosen, left and right
		 * switch kind tabs, around from either end; with none chosen they move the caret. Enter
		 * follows the chosen row, or the only row when nothing is chosen; otherwise it submits
		 * the form to `/search`.
		 */
		function navigate(event: KeyboardEvent): void {
			let rows = options();
			let { kinds } = handle.props;

			if (
				(event.key === "ArrowRight" || event.key === "ArrowLeft") &&
				selected >= 0 &&
				kinds.length > 1
			) {
				event.preventDefault();
				let step = event.key === "ArrowRight" ? 1 : -1;
				let at = Math.max(0, kinds.indexOf(currentKind()));
				switchTab(kinds[(at + step + kinds.length) % kinds.length] ?? "", true, TAB_DEBOUNCE_MS);
			} else if (event.key === "ArrowDown" && rows.length > 0) {
				event.preventDefault();
				choose(selected + 1 >= rows.length ? 0 : selected + 1);
			} else if (event.key === "ArrowUp" && selected >= 0) {
				event.preventDefault();
				choose(selected - 1);
			} else if (event.key === "Enter" && selected >= 0 && rows[selected]) {
				event.preventDefault();
				follow(rows[selected]);
			} else if (event.key === "Enter" && !pending && rows.length === 1) {
				event.preventDefault();
				follow(rows[0]);
			}
		}

		return () => (
			<QuietSearchRow
				mix={[pi(5)]}
				lead={
					spinning ? (
						<Spinner size="sm" color="neutral" aria-label="Searching" mix={[spin()]} />
					) : undefined
				}
			>
				<QuietSearchInput
					type="search"
					id={handle.props.id}
					name="q"
					defaultValue={handle.props.query}
					// oxlint-disable-next-line jsx-a11y/no-redundant-roles -- A search input's implicit role is searchbox; the combobox role is what lets aria-activedescendant point into the result rows.
					role="combobox"
					list={undefined}
					aria-autocomplete="list"
					aria-controls={SEARCH_LISTBOX_ID}
					aria-expanded={handle.props.optionCount > 0 ? "true" : "false"}
					aria-activedescendant={selected >= 0 ? searchOptionId(selected) : undefined}
					aria-label="Search articles, tutorials and the glossary"
					placeholder="Search articles, tutorials and the glossary"
					autocomplete="off"
					enterkeyhint="search"
					autofocus
					mix={[
						on<HTMLInputElement, "keydown">("keydown", navigate),
						on<HTMLInputElement, "input">("input", (event) => {
							let box = event.currentTarget;
							let text = box.value;
							let keystroke = ++latest;

							clearTimeout(debounce);
							begin();
							debounce = setTimeout(() => {
								void load(
									searchFrameSrc(handle.props.frameSrc, text, currentKind()),
									box.closest("dialog"),
									keystroke,
								);
							}, SEARCH_DEBOUNCE_MS);
						}),
					]}
				/>
			</QuietSearchRow>
		);
	},
);
