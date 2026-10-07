/**
 * Client island: the search dialog's box, the top row of the panel, which turns typing into
 * live results by reloading the frame it is rendered in from the frame URL for the text so
 * far. Without script it is the `q` field of a `GET` form to `/search`, submitted by Enter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { SearchIcon } from "@sdxc/icons";
import { bg, border, fg, outlineStyle } from "@sdxc/u/color";
import { opacity } from "@sdxc/u/effects";
import {
	appearance,
	gap,
	grid,
	gridTemplate,
	hidden,
	inlineFlex,
	items,
	shrink,
} from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, m, minIs, p, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";
import { Button, Spinner } from "@sdxc/ui";
import { spin } from "@sdxc/ui/animations";
import { clientEntry, on } from "remix/component";

/** How long typing must pause before the results follow it. */
export const SEARCH_DEBOUNCE_MS = 200;

/**
 * How long after a keystroke the spinner waits before it shows. Results that arrive within
 * it (the debounce plus a quick answer) swap in with no spinner flashing first.
 */
export const SPINNER_DELAY_MS = 350;

/** How long the panel takes to grow or shrink to the new results. */
const RESIZE_MS = 160;

/** The results region the box marks busy while newer results are on their way. */
export const SEARCH_RESULTS_ID = "site-search-results";

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type SearchBoxProps = {
	/** The input's id. */
	id: string;
	/** The text the frame was rendered for, which an unedited box starts from. */
	query: string;
	/** The frame endpoint without a query, so the route owns its own address. */
	frameSrc: string;
	/** The dialog the Cancel button closes. */
	dialogId: string;
};

/**
 * The frame URL for a box's text: the bare endpoint for a blank box, so clearing the box
 * returns the frame to the address it renders blank from.
 */
export function searchFrameSrc(frameSrc: string, text: string): string {
	let query = text.trim();
	if (query === "") return frameSrc;
	return `${frameSrc}?${new URLSearchParams({ q: query })}`;
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
 * The dialog's box. A keystroke marks the results busy and, once typing pauses, reloads the
 * enclosing frame from the URL for the text; the runtime aborts a reload still in flight
 * when the next one starts, so only the newest text's results land, and a failed request
 * leaves the previous ones showing. The box keeps its element across reloads, so focus,
 * caret and typed text survive each one. A spinner replaces the magnifier while a search
 * outlasts {@link SPINNER_DELAY_MS}.
 */
export const SearchBox = clientEntry(
	"/resources/components/search-box.tsx#SearchBox",
	function SearchBox(handle: Handle<SearchBoxProps>) {
		let debounce: ReturnType<typeof setTimeout> | undefined;
		let spinnerDelay: ReturnType<typeof setTimeout> | undefined;
		let spinning = false;
		/** Counts keystrokes, so a reload only settles the state when no newer one is pending. */
		let latest = 0;

		handle.signal.addEventListener("abort", () => {
			clearTimeout(debounce);
			clearTimeout(spinnerDelay);
		});

		/** Marks a search pending: busy at once, and the spinner after its delay. */
		function begin(): void {
			markBusy(true);
			clearTimeout(spinnerDelay);
			spinnerDelay = setTimeout(() => {
				spinning = true;
				void handle.update();
			}, SPINNER_DELAY_MS);
		}

		/** Clears the pending marks once the newest results are showing. */
		function settle(): void {
			markBusy(false);
			clearTimeout(spinnerDelay);
			if (!spinning) return;
			spinning = false;
			void handle.update();
		}

		/** Points the frame at the text's results, unless it already shows them. */
		async function follow(box: HTMLInputElement, text: string, keystroke: number) {
			let src = searchFrameSrc(handle.props.frameSrc, text);
			if (src === handle.frame.src) return settle();

			let dialog = box.closest("dialog");
			let from = dialog?.offsetHeight ?? 0;
			handle.frame.src = src;
			await handle.frame.reload().catch(() => undefined);

			if (keystroke !== latest) return markBusy(true);
			settle();
			resize(dialog, from);
		}

		return () => (
			<div
				mix={[
					grid(),
					gridTemplate({ columns: "auto minmax(0, 1fr) auto" }),
					items("center"),
					gap(3),
					pi(4),
					fg("neutral.muted"),
					text("xl"),
				]}
			>
				<span mix={[inlineFlex(), items("center"), is(6), bs(6)]}>
					{spinning ? (
						<Spinner size="sm" color="neutral" aria-label="Searching" mix={[spin()]} />
					) : (
						<SearchIcon size="1em" mix={[shrink(0)]} />
					)}
				</span>
				<input
					type="search"
					id={handle.props.id}
					name="q"
					defaultValue={handle.props.query}
					aria-label="Search articles, tutorials and the glossary"
					placeholder="Search articles, tutorials and the glossary"
					autocomplete="off"
					enterkeyhint="search"
					autofocus
					mix={[
						minIs(0),
						bs(14),
						m(0),
						p(0),
						border("none"),
						bg("transparent"),
						fg("neutral.emphasis"),
						text("xl"),
						outlineStyle("none"),
						appearance("none"),
						when("&::placeholder", fg("neutral.muted")),
						when("&::-webkit-search-decoration", [appearance("none"), hidden()]),
						on<HTMLInputElement, "input">("input", (event) => {
							let box = event.currentTarget;
							let text = box.value;
							let keystroke = ++latest;

							clearTimeout(debounce);
							begin();
							debounce = setTimeout(() => void follow(box, text, keystroke), SEARCH_DEBOUNCE_MS);
						}),
					]}
				/>
				<Button
					type="button"
					variant="ghost"
					color="brand"
					size="sm"
					commandfor={handle.props.dialogId}
					command="close"
					mix={[
						hidden(),
						media("(hover: none), (max-width: 40rem)", inlineFlex()),
						text("base"),
						/** A press dims the label in place, as a text button does on a phone. */
						when("&:active", [bg("transparent"), opacity(60)]),
					]}
				>
					Cancel
				</Button>
			</div>
		);
	},
);
