/**
 * Client island: the keys a reader works their queue with, registered in the page's one
 * shortcut registry so the `?` sheet lists them, and the live region that says what a key
 * just did.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { KeyboardIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { flex, items, shrink } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { Button, Keyboard } from "@sdxc/ui";
import { shortcutRegistry } from "@sdxc/ui/app";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import { Announcer } from "@sdxc/ui/behaviors";
import { clientEntry, ref } from "remix/component";

import routes from "~/routes/web";

/** The `id` the sheet listing every key answers to, which its button names. */
export const SHORTCUTS_PANEL_ID = "keyboard-shortcuts";

/**
 * A post's row, marked so a page at any depth of frame is read the same way. Document
 * order is the one property that survives a list held in nested frames, so every movement
 * is a fresh query over this and an index into the answer.
 */
export const POST_ROW = "li[data-post]";

/**
 * The attribute a row wears so {@link POST_ROW} selects it, spelled here and written onto
 * the row by the list that draws it.
 */
export const POST_ROW_ATTRIBUTE = "data-post";

/** The link a row's title is, which is what opening a post presses. */
const POST_TITLE = "a[data-post-title]";

/**
 * A row's own forms, told apart by where each one posts. The read form names the post and
 * ends in the verb, and the save form does the same, so the row's two decisions are found
 * without either control carrying a marker for this.
 */
const READ_FORM = 'form[action$="/read"]';
const SAVE_FORM = 'form[action$="/save"]';

/**
 * The field a row's read form submits its next state under. It asks for `true` while the
 * post is unread, since pressing the form then reads it, and the form rewrites it as the mark
 * flips, so it says the row's state as of the last press.
 */
const UNREAD_FIELD = `${READ_FORM} input[name="read"][value="true"]`;

/** The sidebar's own navigation lists, whose links `J` and `K` walk in document order. */
const SIDEBAR_NAV_LINK = "nav a[href]";

/** The control that is the page the reader is standing on, which `J` and `K` count from. */
const CURRENT_LINK = '[aria-current="page"]';

/**
 * The palette's own key. The palette arrives with the sidebar's feeds and registers it then,
 * under the same label, so the sheet lists it once whether or not that frame has landed.
 */
const PALETTE_KEY = "mod+k";

/**
 * How long a message stands in the live region before the next one replaces it. Long
 * enough for a screen reader to reach it, short enough that a reader ticking their way
 * down a queue hears each move rather than the first of them.
 */
const ANNOUNCE_HOLD_MS = 1200;

/** Edge of the glyph the button wears, which is the size every other mark in the chrome is. */
const ICON_SIZE = 16;

export namespace Shortcuts {
	/**
	 * What each key does, as the sheet lists it. Declared as a `type` to satisfy the
	 * serializable-props constraint a client entry's props are checked against.
	 */
	export type Keys = {
		nextPost: string;
		previousPost: string;
		nextUnread: string;
		openPost: string;
		markRead: string;
		savePost: string;
		checkFeeds: string;
		nextFeed: string;
		previousFeed: string;
		search: string;
		/** The ⌘K palette's own label, which the palette registers its key under. */
		goTo: string;
		help: string;
	};

	/** The sheet's headings. Declared as a `type` for the reason {@link Keys} is. */
	export type Groups = {
		reading: string;
		feeds: string;
		general: string;
		/** Where a key registered without a group lists. */
		other: string;
	};

	/** Declared as a `type` for the reason {@link Keys} is. */
	export type Copy = {
		/** Names the button the sheet opens from, and the sheet itself. */
		open: string;
		description: string;
		close: string;
		/** Joins two keys that do the same thing. */
		or: string;
		/** Said when `n` finds no unread post below the current one. */
		noUnread: string;
		groups: Groups;
		keys: Keys;
	};

	/** Declared as a `type` for the reason {@link Keys} is. */
	export type Props = {
		copy: Copy;
		/** The `id` of the sidebar's search box, which `/` puts the caret in. */
		searchFieldId: string;
		/** The `id` of the sidebar, whose navigation `J` and `K` walk. */
		sidebarId: string;
	};

	/** What a binding reaches for beyond the document, supplied by whoever installs it. */
	export interface Targets {
		searchFieldId: string;
		sidebarId: string;
		/** The labels and headings every key registers under. */
		copy: Pick<Copy, "keys" | "groups" | "noUnread">;
		/** Says what a key did, for a reader who cannot see it change. */
		announce(text: string): void;
	}
}

/** Every row on the page, in the order the reader reads them. */
function rows(): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>(POST_ROW));
}

/** The post the reader is on, which is the row holding focus and nothing else. */
function currentRow(): HTMLElement | null {
	let active = document.activeElement;
	return active instanceof Element ? active.closest<HTMLElement>(POST_ROW) : null;
}

/**
 * The row a reader is looking at, for a keystroke pressed with nothing focused — a page
 * just opened, or a row taken out from under them.
 *
 * @param direction - Which way the keystroke was moving.
 * @returns The row to select, or `null` on a page holding none.
 */
function rowInView(direction: 1 | -1): HTMLElement | null {
	let all = rows();
	if (all.length === 0) return null;

	if (direction === 1) {
		return all.find((row) => row.getBoundingClientRect().top >= 0) ?? (all.at(-1) as HTMLElement);
	}

	let above = all.filter((row) => row.getBoundingClientRect().bottom <= innerHeight);
	return above.at(-1) ?? (all[0] as HTMLElement);
}

/**
 * Focuses the row one step from the current one, and the row already on screen when there
 * is no current one. Focusing scrolls the row into view, which is the crossing the frames
 * below and above the rows are already watching for, so the keyboard pages the list through.
 *
 * @param direction - `1` for the next row, `-1` for the previous one.
 */
function moveRow(direction: 1 | -1): void {
	let current = currentRow();

	if (current === null) {
		rowInView(direction)?.focus();
		return;
	}

	let all = rows();
	let index = all.indexOf(current);

	if (index === -1) {
		rowInView(direction)?.focus();
		return;
	}

	all[index + direction]?.focus();
}

/**
 * Focuses the first unread row below the current one, or at or below the top of the screen
 * when nothing is focused, and says so out loud when the list holds none further down.
 *
 * @param announce - Says one line in the live region.
 * @param none - What it says when there is no unread post left below.
 */
function nextUnread(announce: (text: string) => void, none: string): void {
	let all = rows();
	let current = currentRow();
	let index = current === null ? -1 : all.indexOf(current);
	let start = index === -1 ? Math.max(0, all.indexOf(rowInView(1) as HTMLElement)) : index + 1;

	let unread = all.slice(start).find((row) => row.querySelector(UNREAD_FIELD) !== null);

	if (unread) unread.focus();
	else announce(none);
}

/**
 * Submits one of the focused row's forms, which runs the submit handler that control
 * already carries: the mark flips first, the request goes out under the header asking for
 * the outcome alone, and a refusal puts the mark back.
 *
 * @param selector - Which of the row's forms to press.
 */
function submitRowForm(selector: string): void {
	currentRow()?.querySelector<HTMLFormElement>(selector)?.requestSubmit();
}

/**
 * Opens the focused post, by clicking the title the row already carries. The mark at the
 * head of that row has hooked the same click, so opening a post reads it through the path
 * a pointer takes; a row whose feed published no address has no link and nothing happens.
 */
function openPost(): void {
	currentRow()?.querySelector<HTMLAnchorElement>(POST_TITLE)?.click();
}

/**
 * Walks the sidebar's own links, which is one step through the places a reader reads from.
 * The link marked as the page being read is where the step counts from, and a page the
 * sidebar names none of starts the walk at either end of the list.
 *
 * @param sidebarId - The `id` of the sidebar holding the links.
 * @param direction - `1` for the next place, `-1` for the previous one.
 */
function moveFeed(sidebarId: string, direction: 1 | -1): void {
	let sidebar = document.getElementById(sidebarId);
	if (!sidebar) return;

	let links = Array.from(sidebar.querySelectorAll<HTMLAnchorElement>(SIDEBAR_NAV_LINK));
	if (links.length === 0) return;

	let index = links.findIndex((link) => link.matches(CURRENT_LINK));

	if (index === -1) {
		(direction === 1 ? links[0] : links.at(-1))?.click();
		return;
	}

	links[index + direction]?.click();
}

/** Puts the caret in the sidebar's search box, wherever the reader is on the page. */
function focusSearch(searchFieldId: string): void {
	document.getElementById(searchFieldId)?.focus();
}

/** Asks every followed feed for what it has published, through the header's own form. */
function checkFeeds(): void {
	document
		.querySelector<HTMLFormElement>(`form[action="${routes.feeds.refreshAll.href()}"]`)
		?.requestSubmit();
}

/**
 * Registers every key in the page's shortcut registry, which quiets them while a field is
 * typed in or a dialog is open. Each presses a control the document holds and resolves no
 * frame by name, where a typo or a race would reach for the whole page.
 *
 * @param targets - What the keys reach for beyond the document, and what they list as.
 * @param signal - Takes the keys out of the registry when the island goes.
 */
export function watchKeys(targets: Shortcuts.Targets, signal: AbortSignal): void {
	let { keys, groups, noUnread } = targets.copy;
	let registry = shortcutRegistry(document);

	let bindings: [string, string, string, () => void][] = [
		["j", keys.nextPost, groups.reading, () => moveRow(1)],
		["k", keys.previousPost, groups.reading, () => moveRow(-1)],
		[
			"n",
			keys.nextUnread,
			groups.reading,
			() => nextUnread((text) => targets.announce(text), noUnread),
		],
		["o", keys.openPost, groups.reading, openPost],
		["m", keys.markRead, groups.reading, () => submitRowForm(READ_FORM)],
		["s", keys.savePost, groups.reading, () => submitRowForm(SAVE_FORM)],
		["J", keys.nextFeed, groups.feeds, () => moveFeed(targets.sidebarId, 1)],
		["K", keys.previousFeed, groups.feeds, () => moveFeed(targets.sidebarId, -1)],
		["r", keys.checkFeeds, groups.feeds, checkFeeds],
		["/", keys.search, groups.general, () => focusSearch(targets.searchFieldId)],
	];

	for (let [combo, label, group, run] of bindings) {
		registry.register({ keys: combo, label, group, run, signal });
	}
}

/**
 * Says a row's mark out loud as it changes. Marking read and keeping a post both rewrite
 * the name of a control the reader is not focused on — focus is on the row — and a name
 * that changes under nobody reaches nobody, so the new name is read into the live region.
 * A name written again unchanged, as every mark does when it hydrates, says nothing.
 *
 * @param announce - Says one line in the live region.
 * @param signal - Stops watching when the island goes.
 */
export function watchRowMarks(announce: (text: string) => void, signal: AbortSignal): void {
	let observer = new MutationObserver((records) => {
		for (let record of records) {
			let target = record.target;
			if (!(target instanceof Element)) continue;
			if (target.closest(POST_ROW) === null) continue;

			let label = target.getAttribute("aria-label");
			if (label !== null && label !== record.oldValue) announce(label);
		}
	});

	observer.observe(document.body, {
		subtree: true,
		attributes: true,
		attributeFilter: ["aria-label"],
		attributeOldValue: true,
	});

	signal.addEventListener("abort", () => observer.disconnect(), { once: true });
}

export const Shortcuts = clientEntry(
	import.meta.url,
	function Shortcuts(handle: Handle<Shortcuts.Props>) {
		/**
		 * Whether this is running in a browser. The keys, the button that advertises them and
		 * the sheet listing them are all worth nothing without one, so the server sends an
		 * empty host and the first mount fills it.
		 */
		let hasMounted = false;

		/**
		 * A message stands for as long as a screen reader needs to reach it and is then given
		 * up, so the next move is a change the region announces rather than the same words
		 * written again.
		 */
		let announcer = new Announcer({ hold: ANNOUNCE_HOLD_MS });

		let mount = ref((_node, signal) => {
			hasMounted = true;

			watchKeys(
				{
					searchFieldId: handle.props.searchFieldId,
					sidebarId: handle.props.sidebarId,
					copy: handle.props.copy,
					announce: (text) => announcer.announce(text),
				},
				signal,
			);

			watchRowMarks((text) => announcer.announce(text), signal);

			announcer.addEventListener("change", () => void handle.update(), { signal });

			void handle.update();
		});

		return () => {
			let { copy } = handle.props;

			if (!hasMounted) return <div mix={[mount]} />;

			return (
				<div mix={[mount, shrink(), flex(), items("center")]}>
					{/**
					 * Where a reader finds out there are shortcuts, and where they learn the key that
					 * opens the list of them: the hint on the button is the key it answers to.
					 */}
					<Button
						type="button"
						commandfor={SHORTCUTS_PANEL_ID}
						command="show-modal"
						color="neutral"
						variant="ghost"
						size="sm"
						aria-label={copy.open}
						title={copy.open}
					>
						<KeyboardIcon size={ICON_SIZE} />
						<Keyboard mix={[m(0)]}>?</Keyboard>
					</Button>

					{/**
					 * The sheet `?` opens, listing whatever the page's registry holds. The groups
					 * fix the order headings appear in; the palette's key is named up front since
					 * the palette registers it only once the sidebar's feeds arrive.
					 */}
					<KeyboardHelp
						id={SHORTCUTS_PANEL_ID}
						shortcut="?"
						labels={{
							title: copy.open,
							description: copy.description,
							close: copy.close,
							or: copy.or,
							open: copy.keys.help,
							general: copy.groups.general,
							other: copy.groups.other,
						}}
						groups={[
							{ title: copy.groups.reading, shortcuts: [] },
							{ title: copy.groups.feeds, shortcuts: [] },
							{
								title: copy.groups.general,
								shortcuts: [{ keys: PALETTE_KEY, label: copy.keys.goTo }],
							},
						]}
					/>

					{/**
					 * What a key just did, for a reader who cannot see the mark it moved. Polite, so
					 * it waits for whatever the reader is already hearing rather than cutting in.
					 */}
					<div role="status" aria-live="polite" mix={[visuallyHidden()]}>
						{announcer.current?.text ?? ""}
					</div>
				</div>
			);
		};
	},
);

export default Shortcuts;
