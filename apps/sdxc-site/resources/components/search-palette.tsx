/**
 * Client island: the site-wide palette, opened from the header, by ⌘K or by `/`. It searches
 * the guides and every package reference together over the index `/search.json` publishes,
 * so a reader and an agent get the same ranking, and lists the site's sections while empty.
 *
 * The index is fetched on first use, since it covers every heading on the site; until it
 * arrives the box spins, and the section links work with or without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { clientEntry, on } from "remix/component";
import { BlocksIcon, BookOpenIcon, PackageIcon, PaintbrushIcon, SearchIcon } from "sdxc/icons";
import { visuallyHidden } from "sdxc/u/a11y";
import { bg, border, fg, outlineStyle } from "sdxc/u/color";
import { rounded, transitionBehavior, transition, visibility } from "sdxc/u/effects";
import { listStyle, raw } from "sdxc/u/general";
import {
	appearance,
	gap,
	grid,
	gridTemplate,
	hidden,
	inlineFlex,
	items,
	shrink,
} from "sdxc/u/layout";
import { overflow, overflowY } from "sdxc/u/overflow";
import { dark, light, startingStyle } from "sdxc/u/responsive";
import { bs, is, m, maxBs, maxIs, minBs, minIs, p, pb, pi } from "sdxc/u/size";
import { hover, when } from "sdxc/u/state";
import { text, textDecoration, truncate, weight } from "sdxc/u/typography";
import { Button, Dialog, Highlight, Keyboard, Spinner } from "sdxc/ui";
import { spin } from "sdxc/ui/animations";
import { keyComboGlyphs } from "sdxc/ui/utils";

import type { SearchDocument } from "~/app/services/search-query";

import { highlightSegments, rankDocuments } from "~/app/services/search-query";
import { watchSearchDialog } from "~/resources/components/search-keys";
import {
	SEARCH_EXIT_MS,
	SEARCH_FOLLOW_ATTRIBUTE,
	searchSurface,
	searchSurfaceMotion,
} from "~/resources/components/search-surface";

/** The dialog id the header button, the shortcuts and any other trigger all name. */
export const SEARCH_DIALOG_ID = "site-search";

/** The palette's search box. */
const INPUT_ID = "site-search-q";

/** The listbox of results the box's combobox controls while it holds text. */
const RESULTS_ID = "site-search-options";

/** The listbox of section links the box's combobox controls while it is empty. */
const LINKS_ID = "site-search-links";

/** How many results the list shows, which is as many as fit without becoming a page. */
const RESULT_LIMIT = 20;

/** How long the results card takes to grow or shrink to new results. */
const RESIZE_MS = 180;

/** How long a newly listed row takes to fade in. */
const ROW_ENTER_MS = 180;

/** How far apart newly listed rows start, so they read top to bottom. */
const ROW_STAGGER_MS = 25;

/** The curve the results settle on, decelerating into place. */
const SETTLE_EASING = "cubic-bezier(0, 0, 0.2, 1)";

/** The icon each section link leads with, named so the props stay serializable. */
const LINK_ICONS = {
	guides: BookOpenIcon,
	packages: PackageIcon,
	utilities: PaintbrushIcon,
	components: BlocksIcon,
};

/** One section the palette offers before anything is typed. */
type SearchLink = {
	label: string;
	href: string;
	/** A few words on what the section holds, shown under its label. */
	description: string;
	icon: keyof typeof LINK_ICONS;
};

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type SearchPaletteProps = {
	/** Where the index is fetched from, so the route owns its own address. */
	indexHref: string;
	/** The sections listed under an empty box, and to a reader without script. */
	links: Array<SearchLink>;
	/** Whether the reader's keyboard carries the Apple modifier glyphs. */
	appleKeyboard: boolean;
};

/** Where the index stands: not asked for, on its way, in hand, or unreachable. */
type IndexState = "idle" | "loading" | "ready" | "failed";

/** The id of the option at `index` in the listbox `listbox`, which `aria-activedescendant` names. */
function optionId(listbox: string, index: number): string {
	return `${listbox}-${index}`;
}

/**
 * What the status line says. A count is announced but not shown, since the rows already
 * show it; a message that stands where rows would be is shown as well.
 */
function statusOf(state: IndexState, query: string, total: number): string {
	if (query.trim() === "") return state === "failed" ? "Search is unavailable right now." : "";
	if (state === "failed") return "The search index could not be loaded.";
	if (state !== "ready") return "Loading the index…";
	if (total === 0) return `Nothing matches “${query.trim()}”.`;
	return total === 1 ? "1 result" : `${total} results`;
}

/** Whether `link` leads into the document already showing, differing at most by its fragment. */
function samePage(link: HTMLAnchorElement): boolean {
	return (
		link.origin === location.origin &&
		link.pathname === location.pathname &&
		link.search === location.search
	);
}

/** Every option of the listbox `id` on screen, in order. */
function optionsOf(id: string): Array<HTMLElement> {
	let listbox = document.getElementById(id);
	return listbox ? Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]')) : [];
}

/** The link a row holds, which identifies it across searches. */
function rowHref(row: HTMLElement): string {
	return row.querySelector("a[href]")?.getAttribute("href") ?? "";
}

/** Rows a mixin gives the same rounded tint while hovered or chosen with the arrows. */
function optionTint() {
	return [
		rounded("1.25rem"),
		/** The panel is the lightest neutral in light mode, so a brand wash is what reads on it. */
		hover([light(bg("brand.bg-tint-hover")), dark(bg("neutral.bg-tint-hover"))]),
		when('&[aria-selected="true"]', [
			light(bg("brand.bg-tint-hover")),
			dark(bg("neutral.bg-tint-hover")),
		]),
	];
}

/**
 * Animates the results card from how it looked before a search into how it looks now: a
 * card that changed size grows or shrinks from its old height, and rows it did not list
 * before fade in from below, one after another.
 *
 * @param card The results card.
 * @param height The card's height before the search.
 * @param before The links of the rows it listed before.
 */
function animateResults(card: HTMLElement, height: number, before: Set<string>): void {
	if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	let to = card.offsetHeight;
	if (height > 0 && to !== height) {
		card.animate(
			[
				{ height: `${height}px`, overflow: "hidden" },
				{ height: `${to}px`, overflow: "hidden" },
			],
			{ duration: RESIZE_MS, easing: SETTLE_EASING },
		);
	}

	let fresh = optionsOf(RESULTS_ID).filter((row) => !before.has(rowHref(row)));
	fresh.forEach((row, index) => {
		row.animate(
			[
				{ opacity: 0, translate: "0 0.25rem" },
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
 * Searches every guide and package reference as the reader types. The box is a combobox:
 * arrows choose a row with focus kept in the box, Enter follows the chosen row (the best
 * match until the arrows move), and closing the dialog empties it for the next opening.
 */
export const SearchPalette = clientEntry(
	import.meta.url,
	function SearchPalette(handle: Handle<SearchPaletteProps>) {
		let documents: SearchDocument[] | null = null;
		let results: SearchDocument[] = [];
		let query = "";
		let state: IndexState = "idle";
		/** The chosen row's index, or `-1` while the box itself is the choice. */
		let selected = -1;

		handle.queueTask(() => {
			let dialog = document.getElementById(SEARCH_DIALOG_ID);
			if (!(dialog instanceof HTMLDialogElement)) return;
			watchSearchDialog(dialog, handle.signal);
			dialog.addEventListener("close", reset, { signal: handle.signal });
			dialog.addEventListener("click", onClick, { signal: handle.signal });
			/** ⌘K and `/` open the dialog without the button, so the fetch starts on focus too. */
			dialog.addEventListener("focusin", () => void load(), { signal: handle.signal });
		});

		/** The listbox the arrows move through: the section links while the box is empty. */
		function activeListbox(): string {
			return query.trim() === "" ? LINKS_ID : RESULTS_ID;
		}

		/** Re-ranks the index for the query, then lists the result with the best one chosen. */
		async function show(): Promise<void> {
			let card = document.getElementById(RESULTS_ID)?.parentElement;
			let height = card?.offsetHeight ?? 0;
			let before = new Set(optionsOf(RESULTS_ID).map(rowHref));

			results =
				documents === null || query.trim() === ""
					? []
					: rankDocuments(documents, query, RESULT_LIMIT);
			selected = results.length > 0 ? 0 : -1;
			await handle.update();

			let after = document.getElementById(RESULTS_ID)?.parentElement;
			if (after) animateResults(after, card === after ? height : 0, before);
			scrollChosenIntoView();
		}

		/** Fetches the index once, on whichever opening comes first. */
		async function load(): Promise<void> {
			if (state !== "idle") return;
			state = "loading";
			await handle.update();

			try {
				let response = await fetch(handle.props.indexHref, {
					headers: { accept: "application/json" },
				});
				if (!response.ok) throw new Error(`The search index answered ${response.status}`);

				let body = (await response.json()) as { documents?: SearchDocument[] };
				documents = body.documents ?? [];
				state = "ready";
			} catch {
				state = "failed";
			}

			await show();
		}

		/** Keeps the chosen row in view as the arrows move past the card's edge. */
		function scrollChosenIntoView(): void {
			if (selected < 0) return;
			document
				.getElementById(optionId(activeListbox(), selected))
				?.scrollIntoView?.({ block: "nearest" });
		}

		/** Empties the box, so the dialog reopens on the section links with nothing chosen. */
		function reset(): void {
			document.getElementById(SEARCH_DIALOG_ID)?.removeAttribute(SEARCH_FOLLOW_ATTRIBUTE);
			let box = document.getElementById(INPUT_ID);
			if (box instanceof HTMLInputElement) box.value = "";
			query = "";
			results = [];
			selected = -1;
			void handle.update();
		}

		/**
		 * Turns a plain click on a link into leaving through it: the dialog closes for a link
		 * into the page already showing, and lifts toward the reader while any other loads. A
		 * modified or middle click opens the link as it is and leaves the palette open.
		 */
		function onClick(event: MouseEvent): void {
			let link = event.target instanceof Element ? event.target.closest("a[href]") : null;
			if (!(link instanceof HTMLAnchorElement) || event.defaultPrevented) return;
			if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
				return;
			}

			let dialog = link.closest("dialog");
			if (samePage(link)) dialog?.close();
			else if (link.target === "" || link.target === "_self") {
				dialog?.setAttribute(SEARCH_FOLLOW_ATTRIBUTE, "");
			}
		}

		/**
		 * Moves the choice through the rows: down from the box to the first row and around
		 * from the last, up from the first back to the box. Enter follows the chosen row.
		 */
		function navigate(event: KeyboardEvent): void {
			let rows = optionsOf(activeListbox());

			if (event.key === "ArrowDown" && rows.length > 0) {
				event.preventDefault();
				selected = selected + 1 >= rows.length ? 0 : selected + 1;
			} else if (event.key === "ArrowUp" && selected >= 0) {
				event.preventDefault();
				selected -= 1;
			} else if (event.key === "Enter" && rows[selected]) {
				event.preventDefault();
				rows[selected]?.querySelector<HTMLAnchorElement>("a[href]")?.click();
				return;
			} else return;

			void handle.update().then(scrollChosenIntoView);
		}

		return () => {
			let blank = query.trim() === "";
			let listbox = activeListbox();
			let status = statusOf(state, query, results.length);
			let showLinks = blank || state === "failed";

			return (
				<>
					<Button
						type="button"
						color="neutral"
						variant="outline"
						size="sm"
						commandfor={SEARCH_DIALOG_ID}
						command="show-modal"
						aria-keyshortcuts="Meta+K Control+K /"
						mix={[
							on<HTMLButtonElement, "click">("click", () => {
								void load();
							}),
						]}
					>
						<SearchIcon size={16} aria-hidden="true" />
						Search
						<Keyboard mix={[fg("inherit")]}>
							{keyComboGlyphs("mod+k", handle.props.appleKeyboard).join("")}
						</Keyboard>
					</Button>

					<Dialog
						id={SEARCH_DIALOG_ID}
						aria-label="Search the documentation"
						closedby="any"
						mix={[
							p(0),
							gap(2),
							bg("transparent"),
							rounded("none"),
							overflow("visible"),
							raw({ boxShadow: "none" }),
							transitionBehavior("allow-discrete"),
							transition("display, overlay", { duration: SEARCH_EXIT_MS }),
							light(when("&::backdrop", bg("rgb(0 0 0 / 0.12)"))),
							is("min(40rem, 100% - 2rem)"),
							maxIs("none"),
							maxBs("calc(100dvh - min(12vh, 6rem) - 1rem)"),
							raw({ marginBlock: "min(12vh, 6rem) auto" }),
						]}
					>
						<search mix={[searchSurface(), searchSurfaceMotion(), rounded("full"), shrink(0)]}>
							<div
								mix={[
									grid(),
									gridTemplate({ columns: "auto minmax(0, 1fr)" }),
									items("center"),
									gap(3),
									pi(5),
									fg("neutral.muted"),
									text("xl"),
								]}
							>
								<span mix={[inlineFlex(), items("center"), is(6), bs(6)]}>
									{state === "loading" && !blank ? (
										<Spinner size="sm" color="neutral" aria-label="Loading" mix={[spin()]} />
									) : (
										<SearchIcon size="1em" aria-hidden="true" mix={[shrink(0)]} />
									)}
								</span>
								<input
									type="search"
									id={INPUT_ID}
									// oxlint-disable-next-line jsx-a11y/no-redundant-roles -- A search input's implicit role is searchbox; the combobox role is what lets aria-activedescendant point into the rows.
									role="combobox"
									list={undefined}
									aria-autocomplete="list"
									aria-controls={listbox}
									aria-expanded={showLinks || results.length > 0 ? "true" : "false"}
									aria-activedescendant={selected >= 0 ? optionId(listbox, selected) : undefined}
									aria-label="Search guides and packages"
									placeholder="Search guides and packages"
									autocomplete="off"
									spellcheck={false}
									enterkeyhint="go"
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
										on<HTMLInputElement, "keydown">("keydown", navigate),
										on<HTMLInputElement, "input">("input", (event) => {
											query = event.currentTarget.value;
											void load();
											void show();
										}),
									]}
								/>
							</div>
						</search>

						{showLinks ? (
							<ul
								id={LINKS_ID}
								// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- HTML allows a list to take the listbox role, which keeps the section links a list of links without script.
								role="listbox"
								aria-label="Go to"
								mix={[
									searchSurface(),
									rounded("1.75rem"),
									m(0),
									p(2),
									listStyle("none"),
									grid(),
									gap(1),
									searchSurfaceMotion(blank ? 300 : 0),
									startingStyle(when(":is(dialog[open]) &", visibility("hidden"))),
								]}
							>
								{state === "failed" ? (
									<li role="presentation" mix={[pi(3), pb(2), text("sm"), fg("neutral.muted")]}>
										{status}
									</li>
								) : null}
								{handle.props.links.map((link, index) => {
									let LinkIcon = LINK_ICONS[link.icon];
									return (
										<li
											key={link.href}
											id={optionId(LINKS_ID, index)}
											// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- Each item is an option of the listbox above, which the box's aria-activedescendant points at.
											role="option"
											aria-selected={blank && selected === index ? "true" : "false"}
											mix={optionTint()}
										>
											<a
												href={link.href}
												mix={[
													grid(),
													gridTemplate({ columns: "1.5rem minmax(0, 1fr)" }),
													items("center"),
													gap(3),
													p(3),
													fg("neutral.emphasis"),
													textDecoration("none"),
												]}
											>
												<LinkIcon size="1.25rem" aria-hidden="true" mix={[fg("brand")]} />
												<span mix={[grid(), minIs(0)]}>
													<span mix={[text("base"), weight("medium")]}>{link.label}</span>
													<span mix={[text("sm"), fg("neutral.muted"), truncate()]}>
														{link.description}
													</span>
												</span>
											</a>
										</li>
									);
								})}
							</ul>
						) : (
							<div
								mix={[
									searchSurface(),
									searchSurfaceMotion(40),
									rounded("1.75rem"),
									minBs(0),
									overflowY("auto"),
									grid(),
									gap(2),
									p(2),
								]}
							>
								<p
									role="status"
									mix={
										results.length > 0
											? [visuallyHidden()]
											: [m(0), pi(3), pb(2), text("sm"), fg("neutral.muted")]
									}
								>
									{status}
								</p>
								<ol
									id={RESULTS_ID}
									// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- HTML allows an ordered list to take the listbox role, which keeps the rows a list of links.
									role="listbox"
									aria-label="Top matches"
									mix={[m(0), p(0), listStyle("none"), grid(), gap(1)]}
								>
									{results.map((document, index) => (
										<li
											key={document.href}
											id={optionId(RESULTS_ID, index)}
											// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- Each row is an option of the listbox above, which the box's aria-activedescendant points at.
											role="option"
											aria-selected={selected === index ? "true" : "false"}
											mix={optionTint()}
										>
											<a
												href={document.href}
												mix={[
													grid(),
													gap(0.5),
													p(3),
													fg("neutral.emphasis"),
													textDecoration("none"),
												]}
											>
												<span mix={[text("base"), weight("medium"), truncate()]}>
													<Highlight segments={highlightSegments(document.title, query)} />
												</span>
												<span mix={[text("sm"), fg("neutral.muted"), truncate()]}>
													<Highlight
														segments={highlightSegments(
															document.summary ?? `${document.page} · ${document.section}`,
															query,
														)}
														color="neutral"
													/>
												</span>
											</a>
										</li>
									))}
								</ol>
							</div>
						)}
					</Dialog>
				</>
			);
		};
	},
);

export default SearchPalette;
