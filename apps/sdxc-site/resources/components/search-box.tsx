/**
 * Client island: the search dialog's box, which turns typing into live results by reloading
 * the frame it is rendered in from the frame URL for the text and kind tab so far. Without
 * script it is the `q` field of a `GET` form to `/search`, submitted by Enter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { LiveFrameEvent } from "@sdxc/ui/mixins";
import type { Handle } from "remix/component";

import { pi } from "@sdxc/u/size";
import { Spinner } from "@sdxc/ui";
import { spin } from "@sdxc/ui/animations";
import {
	activeDescendantKeys,
	chooseOption,
	chosenOption,
	LIVE_FRAME_RELOAD_EVENT,
	liveFrame,
	prefetchOption,
} from "@sdxc/ui/mixins";
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
 * How a result's page loads ahead of the reader following it. Doc pages answer from the HTTP
 * cache for five minutes, so the runtime's frame prefetch warms what a result's navigation reads.
 */
const SEARCH_PREFETCH = "frame";

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

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type SearchBoxProps = {
	/** The input's id. */
	id: string;
	/** What the box searches, read out as its name and shown while it is empty. */
	label: string;
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
 * own state.
 */
export const SearchBox = clientEntry(
	import.meta.url,
	function SearchBox(handle: Handle<SearchBoxProps>) {
		let spinning = false;
		/** Whether the box is empty, which points the combobox at the quick links. */
		let blank = handle.props.query === "";
		/** The tab marked ahead of its results, or `null` once the frame shows the tab it marks. */
		let markedKind: string | null = null;
		/** The side the next rows slide in from: `1` or `-1` after a tab switch, `0` otherwise. */
		let direction = 0;
		/** Whether the next rows arrive with the first chosen, so arrows that switched tabs keep switching them. */
		let chooseFirst = false;
		/** The results as they stood when the reload under way began replacing them. */
		let before: ResultsSnapshot | undefined;
		/** What the page rendered the box with, which closing the dialog returns it to. */
		let initialQuery = handle.props.query;

		handle.queueTask(() => {
			watchSearchDialog(handle.signal);
			let dialog = document.getElementById(handle.props.dialogId);
			dialog?.addEventListener("close", reset, { signal: handle.signal });
			dialog?.addEventListener("click", onClick, { signal: handle.signal });
		});

		/** The box as the document holds it now. */
		function box(): HTMLInputElement | null {
			let element = document.getElementById(handle.props.id);
			return element instanceof HTMLInputElement ? element : null;
		}

		/** The tab the reader is on: the one marked ahead of its results, else the frame's. */
		function currentKind(): string {
			return markedKind ?? handle.props.kind;
		}

		/**
		 * Follows the frame's reload: the results are busy from the first keystroke, the spinner
		 * shows once the wait turns slow, and the newest rows animate in from how the old ones
		 * stood, starting unchosen or with the first chosen as a tab switch by arrow asked.
		 */
		function onLiveFrame(event: LiveFrameEvent): void {
			if (event.state === "pending") {
				markBusy(true);
			} else if (event.state === "slow") {
				spinning = true;
				void handle.update();
			} else if (event.state === "loading") {
				before = snapshot();
			} else {
				markBusy(false);
				markedKind = null;
				prefetchTopResult(event.currentTarget);
				if (before && event.currentTarget instanceof HTMLElement) {
					chooseOption(event.currentTarget, chooseFirst ? 0 : -1);
					animateResults(before, direction);
				}
				before = undefined;
				direction = 0;
				chooseFirst = false;
				if (!spinning) return;
				spinning = false;
				void handle.update();
			}
		}

		/**
		 * Starts loading the top result's page once fresh results settle in the open dialog,
		 * since that row is the one Enter most likely opens.
		 */
		function prefetchTopResult(input: EventTarget | null): void {
			if (blank || !(input instanceof HTMLElement)) return;
			if (!document.getElementById(handle.props.dialogId)?.hasAttribute("open")) return;
			prefetchOption(input, 0, SEARCH_PREFETCH);
		}

		/**
		 * Marks `kind`'s tab current and reloads its results at once. A newer reload cancels the
		 * one in flight before it renders, so quick presses end on the last tab pressed and never
		 * flash back to one passed on the way. The rows slide in from the side the tab sits on.
		 */
		function switchTab(kind: string, first: boolean): void {
			let { kinds } = handle.props;
			direction = Math.sign(kinds.indexOf(kind) - kinds.indexOf(currentKind()));
			chooseFirst = first;
			markedKind = kind;
			for (let tab of document.querySelectorAll(`[${SEARCH_KIND_ATTRIBUTE}]`)) {
				if (tab.getAttribute(SEARCH_KIND_ATTRIBUTE) === kind) {
					tab.setAttribute("aria-current", "true");
					tab.scrollIntoView?.({ block: "nearest", inline: "nearest" });
				} else tab.removeAttribute("aria-current");
			}
			box()?.dispatchEvent(new Event(LIVE_FRAME_RELOAD_EVENT));
		}

		/**
		 * Turns a plain click on a kind tab into switching tabs in place, and a plain click on any
		 * other link into following it: the dialog lifts toward the reader while the next page
		 * loads, or closes for a link into the page already showing.
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
				box()?.focus();
			} else if (samePage(link)) {
				dialog?.close();
			} else if (link.target === "" || link.target === "_self") {
				dialog?.setAttribute(SEARCH_FOLLOW_ATTRIBUTE, "");
			}
		}

		/**
		 * Returns the box and the frame to how the page rendered them, so the dialog reopens on
		 * the page's own query (blank on every page but `/search`) on the "All" tab.
		 */
		function reset(): void {
			document.getElementById(handle.props.dialogId)?.removeAttribute(SEARCH_FOLLOW_ATTRIBUTE);
			let input = box();
			if (!input) return;
			input.value = initialQuery;
			chooseOption(input, -1);
			if ((initialQuery === "") !== blank) {
				blank = initialQuery === "";
				void handle.update();
			}
			markedKind = "";
			input.dispatchEvent(new Event(LIVE_FRAME_RELOAD_EVENT));
		}

		/** While a row is chosen, left and right switch kind tabs, around from either end. */
		function switchTabByArrow(event: KeyboardEvent): void {
			let { kinds } = handle.props;
			if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
			if (kinds.length < 2 || !(event.currentTarget instanceof HTMLElement)) return;
			if (chosenOption(event.currentTarget) < 0) return;
			event.preventDefault();
			let step = event.key === "ArrowRight" ? 1 : -1;
			let at = Math.max(0, kinds.indexOf(currentKind()));
			switchTab(kinds[(at + step + kinds.length) % kinds.length] ?? "", true);
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
					aria-label={handle.props.label}
					placeholder={handle.props.label}
					autocomplete="off"
					enterkeyhint="search"
					autofocus
					mix={[
						liveFrame({
							src: (text) => searchFrameSrc(handle.props.frameSrc, text, currentKind()),
							debounce: SEARCH_DEBOUNCE_MS,
							slowAfter: SPINNER_DELAY_MS,
						}),
						activeDescendantKeys({ prefetch: SEARCH_PREFETCH }),
						on<HTMLInputElement, "keydown">("keydown", switchTabByArrow),
						on<HTMLInputElement, "ui:live-frame">("ui:live-frame", onLiveFrame),
						on<HTMLInputElement, "input">("input", (event) => {
							if ((event.currentTarget.value === "") === blank) return;
							chooseOption(event.currentTarget, -1);
							blank = !blank;
							void handle.update();
						}),
					]}
				/>
			</QuietSearchRow>
		);
	},
);
