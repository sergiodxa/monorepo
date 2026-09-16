/**
 * Client island: the keys a reader works their queue with, the panel that tells them those
 * keys exist, and the live region that says what a key just did.
 *
 * The current post is whatever row holds focus, so nothing here caches a selection: a page
 * arriving above the rows, one arriving below them and a row taken away are all answered by
 * asking the document again on the next keystroke. Every binding presses a control the
 * server already rendered, so no key introduces a request the app was not already making.
 *
 * It renders nothing on the server, which is what keeps a page with no script running
 * exactly as it was: the rows are reached by `Tab` and the pointer either way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { KeyboardIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flex, gap, grid, items, shrink } from "@sdxc/u/layout";
import { m, mbs } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Button, Keyboard, Modal, Text } from "@sdxc/ui";
import { Announcer } from "@sdxc/ui/behaviors";
import { clientEntry, ref } from "remix/ui";

import routes from "~/routes/web";

/** The `id` the panel listing every binding answers to, which its button names. */
export const SHORTCUTS_PANEL_ID = "keyboard-shortcuts";

/** Ties the panel to the heading naming it. */
const SHORTCUTS_TITLE_ID = "keyboard-shortcuts-title";

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

/** Where a reader is already typing, and so where a single letter is a letter. */
const TYPING = 'input, textarea, select, [contenteditable], [role="textbox"]';

/** The sidebar's own navigation lists, whose links `J` and `K` walk in document order. */
const SIDEBAR_NAV_LINK = 'nav[data-slot="nav"] a[href]';

/** The control that is the page the reader is standing on, which `J` and `K` count from. */
const CURRENT_LINK = '[aria-current="page"]';

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
	 * Declared as a `type` to satisfy the serializable-props constraint a client entry's
	 * props are checked against.
	 */
	export type Keys = {
		nextPost: string;
		previousPost: string;
		openPost: string;
		markRead: string;
		savePost: string;
		checkFeeds: string;
		nextFeed: string;
		previousFeed: string;
		search: string;
		help: string;
	};

	/**
	 * Declared as a `type` for the reason {@link Keys} is.
	 */
	export type Copy = {
		/** Names the button the panel opens from, and the panel itself. */
		open: string;
		description: string;
		close: string;
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
		/** Presses the control that opens the panel listing every binding. */
		openPanel(): void;
		/** Says what a control now carries, for a reader who cannot see it change. */
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
 * just opened, or a row taken out from under them. Moving down takes the first row whose
 * top edge has reached the viewport, and moving up the last row that ends inside it, so
 * the first press selects what is already on screen rather than walking back to row one.
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
 * below and above the rows are already watching for, so the keyboard pages the list
 * through the same mechanism the scroll wheel does.
 *
 * At either end it leaves focus where it is: advancing when a page lands would move focus
 * some hundreds of milliseconds after the keystroke, which is the page running away from a
 * reader who is listening to it.
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
 * Submits one of the focused row's forms, which runs the submit handler that control
 * already carries: the mark flips first, the request goes out under the header asking for
 * the outcome alone, and a refusal puts the mark back. Where the island never hydrated it
 * is a plain browser submission of the same form to the same route.
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
 * Presses the control that opens the panel listing every binding.
 *
 * The button rather than the panel: the button carries the invoker the platform opens the
 * dialog with, so the key and the pointer go through one control, and the browser's own
 * focus restoration hands the reader back the row they were on when the panel closes.
 */
export function pressShortcutsButton(): void {
	document.querySelector<HTMLButtonElement>(`button[commandfor="${SHORTCUTS_PANEL_ID}"]`)?.click();
}

/**
 * Whether the keystroke belongs to somebody else. A chord the browser or the operating
 * system owns, a key already handled nearer the event, a composition in progress, a field
 * being typed in, and a dialog other than the panel itself all stand this down.
 *
 * Shift is not among them: it is how a keyboard produces `J` and `?` at all, and the
 * character it produced is what the bindings read.
 *
 * @param event - The keystroke as it reached the document.
 * @returns Whether the bindings should stand down.
 */
function isSpokenFor(event: KeyboardEvent): boolean {
	if (event.defaultPrevented) return true;
	if (event.ctrlKey || event.altKey || event.metaKey) return true;
	if (event.isComposing) return true;

	let target = event.target;
	if (!(target instanceof Element)) return false;

	if (target.closest(TYPING) !== null) return true;

	let dialog = target.closest("dialog");
	return dialog !== null && dialog.id !== SHORTCUTS_PANEL_ID;
}

/**
 * Runs the binding a keystroke names, if any. Every one of them presses a control the
 * document already holds, so nothing here resolves a frame by name or navigates: a typo or
 * a race in a frame's name would otherwise reach for the whole page.
 *
 * @param event - The keystroke as it reached the document.
 * @param targets - What the bindings reach for beyond the document.
 */
export function runBinding(event: KeyboardEvent, targets: Shortcuts.Targets): void {
	if (isSpokenFor(event)) return;

	switch (event.key) {
		case "j":
			moveRow(1);
			break;
		case "k":
			moveRow(-1);
			break;
		case "o":
			openPost();
			break;
		case "m":
			submitRowForm(READ_FORM);
			break;
		case "s":
			submitRowForm(SAVE_FORM);
			break;
		case "r":
			checkFeeds();
			break;
		case "J":
			moveFeed(targets.sidebarId, 1);
			break;
		case "K":
			moveFeed(targets.sidebarId, -1);
			break;
		case "/":
			focusSearch(targets.searchFieldId);
			break;
		case "?":
			targets.openPanel();
			break;
		default:
			return;
	}

	event.preventDefault();
}

/**
 * Binds every key on the document, in the bubble phase, so anything nearer the event that
 * handled the keystroke first has already stopped it.
 *
 * @param targets - What the bindings reach for beyond the document.
 * @param signal - Takes the bindings off the document when the island goes.
 */
export function watchKeys(targets: Shortcuts.Targets, signal: AbortSignal): void {
	document.addEventListener("keydown", (event) => runBinding(event, targets), { signal });
}

/**
 * Says a row's mark out loud as it changes. Marking read and keeping a post both rewrite
 * the name of a control the reader is not focused on — focus is on the row — and a name
 * that changes under nobody reaches nobody, so the new name is read into the live region
 * instead. The optimistic flip, the rollback and the refusal all arrive here, because each
 * of them is the control saying what it now carries.
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
			if (label !== null) announce(label);
		}
	});

	observer.observe(document.body, {
		subtree: true,
		attributes: true,
		attributeFilter: ["aria-label"],
	});

	signal.addEventListener("abort", () => observer.disconnect(), { once: true });
}

/** One binding as the panel prints it: the character to press and what pressing it does. */
function ShortcutRow(handle: Handle<{ keyName: string; label: string }>) {
	return () => (
		<>
			<Text mix={[text("sm"), fg("neutral")]}>{handle.props.label}</Text>
			<Keyboard mix={[m(0), weight("medium")]}>{handle.props.keyName}</Keyboard>
		</>
	);
}

export const Shortcuts = clientEntry(
	"/resources/components/shortcuts.tsx#Shortcuts",
	function Shortcuts(handle: Handle<Shortcuts.Props>) {
		/**
		 * Whether this is running in a browser. The bindings and the button that advertises
		 * them are both worth nothing without one, so the server sends an empty host and the
		 * first mount fills it.
		 */
		let hasMounted = false;

		let announcer = new Announcer();

		let mount = ref((_node, signal) => {
			hasMounted = true;

			watchKeys(
				{
					searchFieldId: handle.props.searchFieldId,
					sidebarId: handle.props.sidebarId,
					openPanel: pressShortcutsButton,
					announce: (text) => announcer.announce(text),
				},
				signal,
			);

			watchRowMarks((text) => announcer.announce(text), signal);

			/**
			 * A message stands for as long as a screen reader needs to reach it and is then
			 * given up, so the next move is a change the region announces rather than the same
			 * words written again.
			 */
			announcer.addEventListener(
				"change",
				() => {
					void handle.update();
					if (announcer.current) setTimeout(() => announcer.next(), ANNOUNCE_HOLD_MS);
				},
				{ signal },
			);

			void handle.update();
		});

		return () => {
			let { copy } = handle.props;

			if (!hasMounted) return <div mix={[mount]} />;

			let bindings: [string, string][] = [
				["j", copy.keys.nextPost],
				["k", copy.keys.previousPost],
				["o", copy.keys.openPost],
				["m", copy.keys.markRead],
				["s", copy.keys.savePost],
				["r", copy.keys.checkFeeds],
				["J", copy.keys.nextFeed],
				["K", copy.keys.previousFeed],
				["/", copy.keys.search],
				["?", copy.keys.help],
			];

			return (
				<div mix={[mount, shrink(), flex(), items("center")]}>
					{/**
					 * Where a reader finds out there are shortcuts, and where they learn the key that
					 * opens the list of them: the hint on the button is the binding it answers to.
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
					 * A native `<dialog>` opened modally, chosen for what closing it does: Escape
					 * dismisses it and the browser puts focus back on exactly the element that had
					 * it, which here is the row the reader was on.
					 */}
					<Modal id={SHORTCUTS_PANEL_ID} aria-labelledby={SHORTCUTS_TITLE_ID}>
						<Modal.Close commandfor={SHORTCUTS_PANEL_ID} aria-label={copy.close} />

						<Modal.Header>
							<Modal.Title id={SHORTCUTS_TITLE_ID}>{copy.open}</Modal.Title>
							<Modal.Description>{copy.description}</Modal.Description>
						</Modal.Header>

						{/**
						 * Two columns, so every key lands on one vertical line and the list is read
						 * down that line rather than across ten rows of ragged hints.
						 */}
						<div
							mix={[
								mbs(3),
								grid(),
								gap(2, 4),
								items("center"),
								raw({ gridTemplateColumns: "1fr auto" }),
							]}
						>
							{bindings.map(([keyName, label]) => (
								<ShortcutRow key={keyName} keyName={keyName} label={label} />
							))}
						</div>
					</Modal>

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
