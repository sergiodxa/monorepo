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

/** How long the results card takes to grow or shrink to new results. */
const RESIZE_MS = 180;

/** How long a newly arrived result row takes to fade in. */
const ROW_ENTER_MS = 180;

/** How far apart newly arrived rows start, so they read top to bottom. */
const ROW_STAGGER_MS = 25;

/** The curve the results settle on, decelerating into place. */
const SETTLE_EASING = "cubic-bezier(0, 0, 0.2, 1)";

/** The attribute the results region carries while it is drawn as a card. */
export const SEARCH_CARD_ATTRIBUTE = "data-search-card";

/**
 * The attribute the dialog carries once the reader follows one of its links, which lifts its
 * surfaces toward the reader while the next page loads.
 */
export const SEARCH_FOLLOW_ATTRIBUTE = "data-search-follow";

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

/** The listbox of quick links the combobox controls while the box is empty. */
export const SEARCH_QUICK_LINKS_ID = "site-search-links";

/** The id of the quick link at `index`, which `aria-activedescendant` names. */
export function searchQuickLinkId(index: number): string {
	return `${SEARCH_QUICK_LINKS_ID}-${index}`;
}

/** Every row of the listbox `id` on screen, in order. */
function optionsOf(id: string): Array<HTMLElement> {
	let listbox = document.getElementById(id);
	return listbox ? Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]')) : [];
}

/** Whether `link` leads into the document already showing, differing at most by its fragment. */
function samePage(link: HTMLAnchorElement): boolean {
	return (
		link.origin === location.origin &&
		link.pathname === location.pathname &&
		link.search === location.search
	);
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

/** What the results looked like before a reload: the card's height, 0 with no card, and its rows. */
interface ResultsSnapshot {
	height: number;
	rows: Set<string>;
}

/** The results card's height and the links of its rows, as they stand now. */
function snapshot(): ResultsSnapshot {
	let card = document.getElementById(SEARCH_RESULTS_ID);
	return {
		height: card?.hasAttribute(SEARCH_CARD_ATTRIBUTE) ? card.offsetHeight : 0,
		rows: new Set(optionsOf(SEARCH_LISTBOX_ID).map(rowHref)),
	};
}

/** The link a result row holds, which identifies it across reloads. */
function rowHref(row: HTMLElement): string {
	return row.querySelector("a[href]")?.getAttribute("href") ?? "";
}

/**
 * Animates the results from how they looked `before` a reload into how they look now: a card
 * that just appeared settles in, one that changed size grows or shrinks from its old height,
 * and new rows fade in from below; after a tab switch every row slides in from `direction`.
 *
 * @param before The results as they stood when the reload started.
 * @param direction `1` or `-1` for a tab to the right or left, `0` for a refined search.
 */
function animateResults(before: ResultsSnapshot, direction: number): void {
	if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	let card = document.getElementById(SEARCH_RESULTS_ID);
	if (!card?.hasAttribute(SEARCH_CARD_ATTRIBUTE)) return;

	let to = card.offsetHeight;
	if (before.height === 0) {
		card.animate(
			[
				{ opacity: 0, translate: "0 -0.5rem", scale: "0.98" },
				{ opacity: 1, translate: "0 0", scale: "1" },
			],
			{ duration: RESIZE_MS, easing: SETTLE_EASING },
		);
	} else if (to !== before.height) {
		card.animate(
			[
				{ height: `${before.height}px`, overflow: "hidden" },
				{ height: `${to}px`, overflow: "hidden" },
			],
			{ duration: RESIZE_MS, easing: SETTLE_EASING },
		);
	}

	let rows = optionsOf(SEARCH_LISTBOX_ID);
	let moving = direction === 0 ? rows.filter((row) => !before.rows.has(rowHref(row))) : rows;
	let from = direction === 0 ? "0 0.25rem" : `${direction}rem 0`;
	moving.forEach((row, index) => {
		row.animate(
			[
				{ opacity: 0, translate: from },
				{ opacity: 1, translate: "0 0" },
			],
			{
				duration: ROW_ENTER_MS,
				delay: index * ROW_STAGGER_MS,
				easing: SETTLE_EASING,
				fill: "backwards",
			},
		);
	});
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
		/** The chosen row's id, which `aria-activedescendant` names. */
		let activeId: string | undefined;
		/** Whether the box is empty, which points the combobox at the quick links. */
		let blank = handle.props.query === "";
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
			dialog?.addEventListener("click", onClick, { signal: handle.signal });
			window.addEventListener("pageshow", restore, { signal: handle.signal });
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

		/** The rows the arrows move through: the quick links while the box is empty, else the results. */
		function options(): Array<HTMLElement> {
			return optionsOf(blank ? SEARCH_QUICK_LINKS_ID : SEARCH_LISTBOX_ID);
		}

		/** Chooses the row at `index`, or the box itself for `-1`, keeping focus in the box. */
		function choose(index: number): void {
			selected = index;
			let rows = options();
			activeId = rows[index]?.id;
			rows.forEach((row, at) => row.setAttribute("aria-selected", at === index ? "true" : "false"));
			rows[index]?.scrollIntoView?.({ block: "nearest" });
			void handle.update();
		}

		/**
		 * Points the frame at `src` and reloads it, unless it already shows it. The new rows
		 * start unchosen, or with the first one chosen when `chooseFirst` asks, so arrows that
		 * switched tabs keep switching them.
		 */
		async function load(src: string, keystroke: number, chooseFirst = false, direction = 0) {
			if (src === handle.frame.src) return settle();

			let before = snapshot();
			handle.frame.src = src;
			await handle.frame.reload().catch(() => undefined);

			if (keystroke !== latest) return markBusy(true);
			settle();
			choose(chooseFirst && options().length > 0 ? 0 : -1);
			animateResults(before, direction);
		}

		/** The tab the reader is on: the one marked ahead of its results, else the frame's. */
		function currentKind(): string {
			return markedKind ?? handle.props.kind;
		}

		/**
		 * Marks `kind`'s tab current and starts loading its results at once. A newer reload
		 * cancels the one in flight before it renders, so quick presses end on the last tab
		 * pressed and never flash back to one passed on the way. The rows slide in from the
		 * side the tab sits on, relative to the tab the reader left.
		 */
		function switchTab(kind: string, chooseFirst: boolean): void {
			let box = document.getElementById(handle.props.id);
			if (!(box instanceof HTMLInputElement)) return;
			let { kinds } = handle.props;
			let direction = Math.sign(kinds.indexOf(kind) - kinds.indexOf(currentKind()));
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
			void load(
				searchFrameSrc(handle.props.frameSrc, box.value, kind),
				keystroke,
				chooseFirst,
				direction,
			);
		}

		/**
		 * Turns a plain click on a kind tab into switching tabs in place, and a plain click on any
		 * other link into following it: the dialog lifts toward the reader while the next page
		 * loads, or closes for a link into the page already showing. A modified or middle click
		 * still opens the link as it is.
		 */
		function onClick(event: MouseEvent): void {
			let link = event.target instanceof Element ? event.target.closest("a[href]") : null;
			if (!(link instanceof HTMLAnchorElement) || event.defaultPrevented) return;
			if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
				return;
			}

			let kind = link.getAttribute(SEARCH_KIND_ATTRIBUTE);
			let dialog = link.closest("dialog");
			if (kind !== null) {
				event.preventDefault();
				switchTab(kind, false);
				document.getElementById(handle.props.id)?.focus();
			} else if (samePage(link)) {
				dialog?.close();
			} else if (link.target === "" || link.target === "_self") {
				dialog?.setAttribute(SEARCH_FOLLOW_ATTRIBUTE, "");
			}
		}

		/**
		 * Closes a dialog the back/forward cache restored mid-follow, so returning to the page
		 * shows the page itself instead of a dialog whose surfaces already lifted away.
		 */
		function restore(event: PageTransitionEvent): void {
			let dialog = document.getElementById(handle.props.dialogId);
			if (!event.persisted || !(dialog instanceof HTMLDialogElement)) return;
			if (dialog.hasAttribute(SEARCH_FOLLOW_ATTRIBUTE)) dialog.close();
		}

		/**
		 * Returns the box and the frame to how the page rendered them, so the dialog reopens on
		 * the page's own query (blank on every page but `/search`) with nothing pending.
		 */
		function reset(): void {
			document.getElementById(handle.props.dialogId)?.removeAttribute(SEARCH_FOLLOW_ATTRIBUTE);
			clearTimeout(debounce);
			let keystroke = ++latest;
			let box = document.getElementById(handle.props.id);
			if (box instanceof HTMLInputElement) box.value = initialQuery;
			blank = initialQuery === "";
			choose(-1);
			void load(initialSrc, keystroke);
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
				switchTab(kinds[(at + step + kinds.length) % kinds.length] ?? "", true);
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
					aria-controls={blank ? SEARCH_QUICK_LINKS_ID : SEARCH_LISTBOX_ID}
					aria-expanded={blank || handle.props.optionCount > 0 ? "true" : "false"}
					aria-activedescendant={selected >= 0 ? activeId : undefined}
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
							if ((text === "") !== blank) {
								choose(-1);
								blank = text === "";
							}

							clearTimeout(debounce);
							begin();
							debounce = setTimeout(() => {
								void load(searchFrameSrc(handle.props.frameSrc, text, currentKind()), keystroke);
							}, SEARCH_DEBOUNCE_MS);
						}),
					]}
				/>
			</QuietSearchRow>
		);
	},
);
