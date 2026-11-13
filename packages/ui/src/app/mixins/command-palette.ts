/**
 * The browser half of the command palette: filters commands by title and keywords, ranks a
 * finder page's paths, moves the active row, opens pages, fills Recent, and binds the toggle
 * key and every page's and command's own key. Why JS: filtering, active-descendant movement,
 * page stacks and finder ranking need script. No-JS baseline: a trigger opens the dialog and
 * every command works.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { isApplePlatform, shortcutGlyphs, shortcutRegistry } from "../behaviors/shortcuts.js";
import { fuzzyFilter, fuzzySegments } from "../utils/fuzzy-path.js";

/** How many recent commands the palette offers before anything is typed. */
export const PALETTE_RECENT_LIMIT = 5;

/** Marks each row with its command's id, which `recent` and the remembered list name. */
export const PALETTE_ITEM_ATTRIBUTE = "data-palette-item";

/** Marks the link or button a row presses. */
export const PALETTE_CONTROL_ATTRIBUTE = "data-palette-control";

/** Names the page a row's control opens instead of acting. */
export const PALETTE_GOTO_ATTRIBUTE = "data-palette-goto";

/** Marks a page of commands with its id. */
export const PALETTE_PAGE_ATTRIBUTE = "data-palette-page";

/** Marks a page's shortcut, the combo that opens the palette straight on that page. */
export const PALETTE_PAGE_SHORTCUT_ATTRIBUTE = "data-palette-page-shortcut";

/** Marks a finder and carries its paths, one per line. */
export const PALETTE_FINDER_ATTRIBUTE = "data-palette-finder";

/** Marks the `<template>` holding the row a finder clones per result. */
export const PALETTE_FINDER_ROW_ATTRIBUTE = "data-palette-finder-row";

/** Marks the container a finder lists its results in. */
export const PALETTE_FINDER_RESULTS_ATTRIBUTE = "data-palette-finder-results";

/** Marks the span in a finder row that holds the path and its bolded matches. */
export const PALETTE_FINDER_PATH_ATTRIBUTE = "data-palette-finder-path";

/** Marks a row the island copied into the Recent group. */
export const PALETTE_CLONE_ATTRIBUTE = "data-palette-clone";

/** Marks a shortcut hint with the combo it prints, so the island reprints it per platform. */
export const PALETTE_HINT_ATTRIBUTE = "data-shortcut-hint";

/**
 * Types for {@link paletteController}.
 */
export namespace PaletteController {
	/** Plain data only, since the options cross into the browser with the palette's island. */
	export type Options = {
		/** The combo that toggles the palette. */
		shortcut: string;
		/** The help-sheet label of that combo. */
		open: string;
		/** The announced result count, with `{count}` replaced. */
		results: string;
		/** Ids of commands the server offers under Recent. */
		recent: string[];
		/** The `localStorage` key commands run from the palette are remembered under. */
		remember?: string;
	};
}

/**
 * Lower-cases text and strips its accents, so "cafe" finds "Café" and "Équipe" finds "equipe".
 *
 * @param value Text to fold.
 * @returns The folded text.
 */
export function foldSearchText(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim();
}

/** The page a row or group sits on, `null` for the root list. */
function pageOf(element: Element): string | null {
	return (
		element.closest(`[${PALETTE_PAGE_ATTRIBUTE}]`)?.getAttribute(PALETTE_PAGE_ATTRIBUTE) ?? null
	);
}

/** One finder page, read once from its markup. */
interface Finder {
	page: string;
	paths: string[];
	href: string;
	limit: number;
	row: Element;
	results: HTMLElement;
}

/** Reads every finder in `list`; one missing its row template or results container is skipped. */
function readFinders(list: HTMLElement): Map<string, Finder> {
	let finders = new Map<string, Finder>();
	for (let element of list.querySelectorAll<HTMLElement>(`[${PALETTE_FINDER_ATTRIBUTE}]`)) {
		let page = pageOf(element);
		let template = element.querySelector<HTMLTemplateElement>(
			`template[${PALETTE_FINDER_ROW_ATTRIBUTE}]`,
		);
		let row = template?.content.firstElementChild ?? template?.firstElementChild ?? null;
		let results = element.querySelector<HTMLElement>(`[${PALETTE_FINDER_RESULTS_ATTRIBUTE}]`);
		if (page === null || row === null || results === null) continue;
		finders.set(page, {
			page,
			paths: (element.getAttribute(PALETTE_FINDER_ATTRIBUTE) ?? "").split("\n").filter(Boolean),
			href: element.getAttribute("data-palette-finder-href") ?? "{path}",
			limit: Number(element.getAttribute("data-palette-finder-limit") ?? "50"),
			row,
			results,
		});
	}
	return finders;
}

/** The finder's link for `path`: its `{path}` placeholder filled with the URI-encoded segments. */
function finderHref(template: string, path: string): string {
	return template.replace("{path}", path.split("/").map(encodeURIComponent).join("/"));
}

/**
 * Lists the finder's best matches for `query`, cloning its row per result and marking the
 * matched characters, so each keystroke builds at most `limit` rows whatever the path count.
 */
function renderFinder(finder: Finder, query: string): void {
	let document = finder.results.ownerDocument;
	let rows = fuzzyFilter(query, finder.paths, finder.limit).map((match, index) => {
		let row = finder.row.cloneNode(true) as HTMLElement;
		let id = `${finder.page}-result-${index}`;
		row.id = id;
		row.hidden = false;
		row.setAttribute(PALETTE_ITEM_ATTRIBUTE, id);
		row.setAttribute("data-value", match.path);
		row.setAttribute("aria-selected", "false");
		row.querySelector("a")?.setAttribute("href", finderHref(finder.href, match.path));
		row.querySelector(`[${PALETTE_FINDER_PATH_ATTRIBUTE}]`)?.replaceChildren(
			...fuzzySegments(match.path, match.positions).map((segment) => {
				if (!segment.match) return document.createTextNode(segment.text);
				let mark = document.createElement("mark");
				mark.textContent = segment.text;
				return mark;
			}),
		);
		return row;
	});
	finder.results.replaceChildren(...rows);
}

/** Reads the remembered command ids, newest first, empty when storage is unavailable. */
function readRemembered(key: string | undefined): string[] {
	if (key === undefined) return [];
	try {
		let parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
		return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
	} catch {
		return [];
	}
}

/**
 * Puts `id` first in the remembered list, answering whether it was stored. Where storage is
 * refused the palette keeps working, offering only the recents the server passed.
 */
function remember(key: string | undefined, id: string): boolean {
	if (key === undefined) return false;
	try {
		let ids = [id, ...readRemembered(key).filter((other) => other !== id)].slice(
			0,
			PALETTE_RECENT_LIMIT,
		);
		localStorage.setItem(key, JSON.stringify(ids));
		return true;
	} catch {
		return false;
	}
}

/** Reprints every hint under `root` for a keyboard without the Apple glyphs. */
function reprintHints(root: Element): void {
	if (isApplePlatform()) return;
	for (let hint of root.querySelectorAll<HTMLElement>(`[${PALETTE_HINT_ATTRIBUTE}]`)) {
		let template = hint.querySelector("kbd");
		if (template === null) continue;
		let caps = shortcutGlyphs(hint.getAttribute(PALETTE_HINT_ATTRIBUTE) ?? "", false).map(
			(glyph) => {
				let cap = template.cloneNode() as HTMLElement;
				cap.textContent = glyph;
				return cap;
			},
		);
		hint.replaceChildren(...caps);
	}
}

/**
 * Wires a palette dialog: filtering, the active row, pages, recents, the toggle key and every
 * item's own key.
 */
function attach(dialog: HTMLDialogElement, props: PaletteController.Options, signal: AbortSignal) {
	let input = dialog.querySelector<HTMLInputElement>("[data-command-input]")!;
	let list = dialog.querySelector<HTMLElement>('[data-slot="list"]')!;
	let empty = dialog.querySelector<HTMLElement>("[data-command-empty]");
	let status = dialog.querySelector<HTMLElement>("[data-palette-status]");
	let back = dialog.querySelector<HTMLButtonElement>("[data-palette-back]");
	let recentGroup = dialog.querySelector<HTMLElement>("[data-palette-recent]");
	let recentItems = dialog.querySelector<HTMLElement>("[data-palette-recent-items]");
	let rootPlaceholder = input.placeholder;
	let stack: { page: string | null; query: string }[] = [];
	let current: string | null = null;
	let active: HTMLElement | null = null;
	let registry = shortcutRegistry(dialog.ownerDocument);
	let finders = readFinders(list);

	let items = () =>
		[...list.querySelectorAll<HTMLElement>(`[${PALETTE_ITEM_ATTRIBUTE}]`)].filter(
			(item) => item.closest("template") === null,
		);
	let visible = () => items().filter((item) => item.closest("[hidden]") === null);

	let setActive = (item: HTMLElement | null) => {
		active = item;
		for (let other of items()) other.setAttribute("aria-selected", String(other === item));
		input.setAttribute("aria-activedescendant", item?.id ?? "");
		item?.scrollIntoView({ block: "nearest" });
	};

	let apply = () => {
		let tokens = foldSearchText(input.value).split(/\s+/).filter(Boolean);
		let finder = current === null ? undefined : finders.get(current);
		if (finder !== undefined) renderFinder(finder, input.value);

		for (let child of list.children) {
			if (!(child instanceof HTMLElement) || child === recentGroup) continue;
			let page = child.getAttribute(PALETTE_PAGE_ATTRIBUTE);
			child.hidden = page === null ? current !== null : page !== current;
		}

		for (let item of items()) {
			if (item.hasAttribute(PALETTE_CLONE_ATTRIBUTE) || pageOf(item) !== current) continue;
			if (item.closest(`[${PALETTE_FINDER_ATTRIBUTE}]`) !== null) continue;
			let haystack = foldSearchText(
				`${item.getAttribute("data-value") ?? ""} ${item.getAttribute("data-keywords") ?? ""}`,
			);
			item.hidden = !tokens.every((token) => haystack.includes(token));
		}

		for (let group of list.querySelectorAll<HTMLElement>("[data-palette-group]")) {
			if (pageOf(group) !== current) continue;
			group.hidden = group.querySelector(`[${PALETTE_ITEM_ATTRIBUTE}]:not([hidden])`) === null;
		}

		if (recentGroup !== null) {
			recentGroup.hidden =
				current !== null || tokens.length > 0 || recentItems?.childElementCount === 0;
		}

		let shown = visible();
		if (empty !== null) {
			empty.hidden = shown.length > 0;
			let quoted = empty.querySelector("[data-palette-query]");
			if (quoted !== null) quoted.textContent = input.value;
		}
		if (status !== null)
			status.textContent = props.results.replace("{count}", String(shown.length));
		setActive(shown[0] ?? null);
	};

	let fillRecent = () => {
		if (recentItems === null) return;
		let ids = [...new Set([...props.recent, ...readRemembered(props.remember)])];
		let clones: HTMLElement[] = [];
		for (let id of ids) {
			if (clones.length === PALETTE_RECENT_LIMIT) break;
			let source = items().find(
				(item) =>
					item.getAttribute(PALETTE_ITEM_ATTRIBUTE) === id &&
					!item.hasAttribute(PALETTE_CLONE_ATTRIBUTE),
			);
			if (source === undefined || source.querySelector(`[${PALETTE_GOTO_ATTRIBUTE}]`) !== null)
				continue;
			let clone = source.cloneNode(true) as HTMLElement;
			clone.id = `${source.id}-recent`;
			clone.hidden = false;
			clone.setAttribute(PALETTE_CLONE_ATTRIBUTE, "");
			clones.push(clone);
		}
		recentItems.replaceChildren(...clones);
	};

	let showPage = (page: string | null, query: string) => {
		current = page;
		input.value = query;
		let element =
			page === null
				? null
				: list.querySelector(`[${PALETTE_PAGE_ATTRIBUTE}="${CSS.escape(page)}"]`);
		input.placeholder = element?.getAttribute("data-palette-placeholder") ?? rootPlaceholder;
		if (back !== null) {
			back.hidden = page === null;
			let crumb = back.querySelector("[data-palette-crumb]");
			if (crumb !== null) crumb.textContent = element?.getAttribute("data-palette-title") ?? "";
		}
		apply();
		input.focus();
	};

	let push = (page: string) => {
		stack.push({ page: current, query: input.value });
		showPage(page, "");
	};

	let pop = () => {
		let previous = stack.pop();
		if (previous !== undefined) showPage(previous.page, previous.query);
	};

	let reset = () => {
		stack = [];
		fillRecent();
		showPage(null, "");
	};

	/** Presses a row: a page opener opens its page; any other command runs and closes the palette. */
	let run = (item: HTMLElement) => {
		item.querySelector<HTMLElement>(`[${PALETTE_CONTROL_ATTRIBUTE}]`)?.click();
	};

	dialog.addEventListener(
		"click",
		(event) => {
			let target = event.target instanceof Element ? event.target : null;
			if (target?.closest("[data-palette-back]")) return pop();
			let control = target?.closest<HTMLElement>(`[${PALETTE_CONTROL_ATTRIBUTE}]`);
			if (control == null) return;
			let page = control.getAttribute(PALETTE_GOTO_ATTRIBUTE);
			if (page !== null) {
				if (!dialog.open) dialog.showModal();
				return push(page);
			}
			let id = control.closest(`[${PALETTE_ITEM_ATTRIBUTE}]`)?.getAttribute(PALETTE_ITEM_ATTRIBUTE);
			let isFinderRow = control.closest(`[${PALETTE_FINDER_ATTRIBUTE}]`) !== null;
			if (id != null && !isFinderRow) remember(props.remember, id);
			dialog.close();
		},
		{ signal },
	);

	dialog.addEventListener(
		"pointermove",
		(event) => {
			let item =
				event.target instanceof Element
					? event.target.closest<HTMLElement>(`[${PALETTE_ITEM_ATTRIBUTE}]`)
					: null;
			if (item !== null && item !== active) setActive(item);
		},
		{ signal },
	);

	dialog.addEventListener(
		"keydown",
		(event) => {
			let shown = visible();
			let index = active === null ? -1 : shown.indexOf(active);
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				if (shown.length === 0) return;
				let step = event.key === "ArrowDown" ? 1 : -1;
				setActive(shown[(index + step + shown.length) % shown.length] ?? null);
			} else if (event.key === "Enter" && event.target === input && active !== null) {
				event.preventDefault();
				run(active);
			} else if (event.key === "Backspace" && input.value === "" && stack.length > 0) {
				event.preventDefault();
				pop();
			}
		},
		{ signal },
	);

	input.addEventListener("input", apply, { signal });
	dialog.addEventListener("close", reset, { signal });

	registry.register({
		keys: props.shortcut,
		label: props.open,
		global: true,
		whileTyping: true,
		run: () => {
			if (dialog.open) dialog.close();
			else dialog.showModal();
			return true;
		},
		signal,
	});

	for (let page of list.querySelectorAll<HTMLElement>(`[${PALETTE_PAGE_SHORTCUT_ATTRIBUTE}]`)) {
		let id = page.getAttribute(PALETTE_PAGE_ATTRIBUTE);
		let keys = page.getAttribute(PALETTE_PAGE_SHORTCUT_ATTRIBUTE);
		if (id === null || keys === null || keys === "") continue;
		registry.register({
			keys,
			label: page.getAttribute("data-palette-title") ?? undefined,
			run: () => {
				if (!dialog.open) dialog.showModal();
				stack = [{ page: null, query: "" }];
				showPage(id, "");
				return true;
			},
			signal,
		});
	}

	for (let item of items()) {
		let keys = item.getAttribute("data-palette-shortcut");
		if (keys === null || item.hasAttribute(PALETTE_CLONE_ATTRIBUTE)) continue;
		let group =
			item.closest("[data-palette-group]")?.querySelector("[id]")?.textContent ?? undefined;
		registry.register({
			keys,
			label: item.getAttribute("data-value") ?? undefined,
			group,
			run: () => {
				run(item);
				return true;
			},
			signal,
		});
	}

	reprintHints(dialog);
	reprintHints(
		dialog.ownerDocument.querySelector(`[commandfor="${CSS.escape(dialog.id)}"]`) ?? dialog,
	);
	reset();
}

/**
 * Wires the palette `<dialog>` the host sits in, for as long as the host stays mounted.
 *
 * @param options The toggle key, the copy it announces with, and where recents come from.
 * @example <div hidden mix={[paletteController({ shortcut: "mod+k", open: "Open command menu", results: "{count} results", recent: [] })]} />
 */
export const paletteController: MixinFactory<HTMLElement, [options: PaletteController.Options]> =
	createMixin<HTMLElement, [options: PaletteController.Options]>((handle) => {
		let options: PaletteController.Options | undefined;

		handle.addEventListener("insert", (event) => {
			let dialog = event.node.closest("dialog");
			if (dialog !== null && options !== undefined) attach(dialog, options, handle.signal);
		});

		return (next) => {
			options = next;
		};
	});
