/**
 * Client island: the site-wide palette, opened from the header on every page or by ⌘K
 * anywhere. It searches the guides and all sixty package references together, over the
 * same index `/search.json` publishes, so the answer a reader gets and the answer an agent
 * gets are ranked identically.
 *
 * The index is fetched on the first use rather than rendered into every page: it covers
 * every heading on the site, which is far more than a page that may never be searched from
 * should carry. Until it arrives the palette says so, and it holds the two browsable
 * listings as links, which is what a reader without script gets too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { SearchIcon } from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, p, width } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, textDecoration, truncate, weight } from "@sdxc/u/typography";
import { Button, Command, Keyboard } from "@sdxc/ui";
import { FilterModel } from "@sdxc/ui/behaviors";
import { commandKeys, hotkey } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/ui";

import type { SearchDocument } from "~/app/services/search-query";

import { rankDocuments } from "~/app/services/search-query";
import { shortcutKeys } from "~/app/services/shortcut-keys";

/** The dialog id the header button, the shortcut and any other trigger all name. */
export const SEARCH_DIALOG_ID = "site-search";

/** How many results the list shows, which is as many as fit without becoming a page. */
const RESULT_LIMIT = 20;

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type SearchPaletteProps = {
	/** Where the index is fetched from, so the route owns its own address. */
	indexHref: string;
	/** The two listings offered before a query, and to a reader without script. */
	fallbacks: Array<{ label: string; href: string }>;
	/** Whether the reader's keyboard carries the Apple modifier glyphs. */
	appleKeyboard: boolean;
};

/** The id a result carries, which is what the keyboard mixin activates by. */
function resultId(index: number): string {
	return `search-result-${index}`;
}

/**
 * The shortcut, where there is a document to listen on. `hotkey` binds a `keydown`
 * listener as it is set up, and the palette renders on the server first, where a
 * shortcut has nothing to open anyway.
 */
function shortcut() {
	return typeof document === "undefined" ? [] : [hotkey("mod+k")];
}

/** What stands where the results would be, which says why there are none. */
function emptyMessage(state: "idle" | "loading" | "ready" | "failed", query: string): string {
	if (state === "failed") return "The search index could not be loaded. These still work:";
	if (state === "loading") return "Loading the index…";
	if (state === "ready" && query !== "") return "Nothing matches that.";
	return "Type to search, or start from one of these:";
}

/** Searches every guide and package reference, and follows the chosen result. */
export const SearchPalette = clientEntry(
	"/resources/components/search-palette.tsx#SearchPalette",
	function SearchPalette(handle: Handle<SearchPaletteProps>) {
		let model = new FilterModel();

		let documents: SearchDocument[] | null = null;
		let results: SearchDocument[] = [];
		let query = "";
		let state: "idle" | "loading" | "ready" | "failed" = "idle";

		/** Re-renders the list, then tells the keyboard model which rows are on screen. */
		async function show(): Promise<void> {
			results = documents === null ? [] : rankDocuments(documents, query, RESULT_LIMIT);

			await handle.update();

			model.setOptions(
				results.map((document, index) => ({ id: resultId(index), value: document.title })),
			);
		}

		/** Fetches the index once, on whichever of the two openings comes first. */
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

		return () => (
			<>
				<Button
					type="button"
					color="neutral"
					variant="outline"
					size="sm"
					commandfor={SEARCH_DIALOG_ID}
					command="show-modal"
					mix={[
						on<HTMLButtonElement, "click">("click", () => {
							void load();
						}),
					]}
				>
					<SearchIcon size={16} aria-hidden="true" />
					Search
					<Keyboard mix={[fg("inherit")]}>
						{shortcutKeys("mod+k", handle.props.appleKeyboard).join("")}
					</Keyboard>
				</Button>

				<dialog
					id={SEARCH_DIALOG_ID}
					aria-label="Search the documentation"
					mix={[
						...shortcut(),
						border("none"),
						p(0),
						rounded("lg"),
						width("min(90vw, 36rem)"),
						when("&::backdrop", bg("oklch(0.2 0.01 250 / 0.5)")),
						on<HTMLDialogElement, "click">("click", (event) => {
							if (event.target === event.currentTarget) event.currentTarget.close();
						}),
						/* ⌘K opens the dialog without the button, so the fetch starts on focus too. */
						on<HTMLDialogElement, "focusin">("focusin", () => {
							void load();
						}),
					]}
				>
					<Command
						aria-label="Search the documentation"
						mix={[
							commandKeys(model),
							on<HTMLElement, "input">("input", (event) => {
								if (!(event.target instanceof HTMLInputElement)) return;
								query = event.target.value;
								void load();
								void show();
							}),
						]}
					>
						<Command.Input
							type="search"
							aria-label="Search the documentation"
							placeholder="Search guides and packages"
						/>

						{results.length > 0 ? (
							<Command.List>
								{results.map((document, index) => (
									<Command.Item key={document.href} id={resultId(index)} value={document.title}>
										{/* The row itself carries the hover and active states, so the link is a
										    full-bleed target over them rather than a second box to highlight. */}
										<a
											href={document.href}
											mix={[
												vstack({ gap: 0.5 }),
												is("100%"),
												fg("inherit"),
												textDecoration("none"),
											]}
										>
											<span mix={[text("sm"), weight("medium"), truncate()]}>{document.title}</span>
											<span mix={[text("xs"), fg("neutral"), truncate()]}>
												{document.summary ?? `${document.page} · ${document.section}`}
											</span>
										</a>
									</Command.Item>
								))}
							</Command.List>
						) : null}

						{results.length === 0 ? (
							<div mix={[vstack({ gap: 2 }), p(3, 3, 4, 3)]}>
								<p mix={[text("sm"), fg("neutral")]}>{emptyMessage(state, query)}</p>

								<div mix={[hstack({ gap: 4, align: "center" }), font("sans"), text("sm")]}>
									{handle.props.fallbacks.map((fallback) => (
										<a key={fallback.href} href={fallback.href} mix={[fg("brand")]}>
											{fallback.label}
										</a>
									))}
								</div>
							</div>
						) : null}
					</Command>
				</dialog>
			</>
		);
	},
);

export default SearchPalette;
