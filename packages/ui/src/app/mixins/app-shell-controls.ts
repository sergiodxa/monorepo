/**
 * Why JS: writing the collapse cookie, a ⌘B shortcut, closing the phone sheet when a link is
 * followed in place, re-marking the current row after a frame navigation and following a back
 * row on Esc have no HTML or CSS equivalent.
 * No-JS baseline: the checkbox still collapses the sidebar through CSS and the sheet opens and
 * closes through the Popover API; the collapse lasts until the next page load.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { matchesKeyCombo } from "../../utils/key-combo.js";
import { writeCookie } from "../../utils/write-cookie.js";

/** The shortcut that collapses and expands the sidebar, or opens the sheet on a phone. */
export const APP_SHELL_SHORTCUT = "mod+b";

/** Where the sidebar becomes a sheet when `sheetBelow` is omitted. */
const DEFAULT_SHEET_BELOW: AppShellSheetBelow = "48rem";

/** Where a ⌘B is the editor's bold and an Esc belongs to the field. */
const EDITING_SELECTOR = 'textarea, [contenteditable]:not([contenteditable="false"])';

/** The width under which an app shell's sidebar is a sheet behind the menu button. */
export type AppShellSheetBelow = "48rem" | "64rem";

/**
 * The media queries on either side of `sheetBelow`, docked from it and a sheet under it, which
 * the shell's styles, its toggle and these controls all read so they switch at the same width.
 *
 * @param sheetBelow The width under which the sidebar is a sheet.
 * @returns The docked and sheet media queries.
 * @example appShellQueries("64rem").docked // "(min-width: 64rem)"
 */
export function appShellQueries(sheetBelow: AppShellSheetBelow): {
	docked: string;
	sheet: string;
} {
	let rem = Number.parseFloat(sheetBelow);
	return { docked: `(min-width: ${rem}rem)`, sheet: `(max-width: ${rem - 0.0625}rem)` };
}

/** Options for {@link appShellControls}. */
export interface AppShellControlsOptions {
	/** The cookie the collapsed state is written to, as `"true"` or `"false"`. */
	cookieName: string;
	/** The path the cookie is sent under. @default "/" */
	cookiePath?: string;
	/** The sidebar element's id, which is also the sheet's popover. */
	sidebarId: string;
	/** @default "48rem" */
	sheetBelow?: AppShellSheetBelow;
}

/**
 * Wires the shell around the checkbox it is mixed onto until the checkbox leaves the page.
 * ⌘B (Ctrl+B elsewhere) flips the checkbox while the sidebar is docked and opens or closes the
 * sheet below `sheetBelow`; it stays the editor's bold inside a text area or rich editor.
 *
 * @example
 * <input type="checkbox" data-app-shell-collapse mix={[appShellControls({ cookieName, sidebarId })]} />
 */
export const appShellControls: MixinFactory<
	HTMLInputElement,
	[options: AppShellControlsOptions],
	ElementProps
> = createMixin<HTMLInputElement, [options: AppShellControlsOptions], ElementProps>((handle) => {
	let options: AppShellControlsOptions | undefined;
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		enhance(event.node, () => options, controller.signal);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});

	return (next) => {
		options = next;
	};
});

/** Attaches every listener the shell needs to `host`'s document until `signal` aborts. */
function enhance(
	host: HTMLInputElement,
	readOptions: () => AppShellControlsOptions | undefined,
	signal: AbortSignal,
) {
	let doc = host.ownerDocument;
	let sidebar = () => {
		let id = readOptions()?.sidebarId;
		return id ? doc.getElementById(id) : null;
	};

	host.addEventListener(
		"change",
		() => {
			let options = readOptions();
			if (options?.cookieName) {
				writeCookie(options.cookieName, host.checked, { path: options.cookiePath });
			}
		},
		{ signal },
	);

	doc.addEventListener(
		"keydown",
		(event) => {
			if (event.defaultPrevented || event.repeat) return;
			if (matchesKeyCombo(event, APP_SHELL_SHORTCUT)) {
				if (isEditing(event.target)) return;
				event.preventDefault();
				toggle(host, sidebar());
				return;
			}
			if (event.key === "Escape") followBackRow(event, sidebar());
		},
		{ signal },
	);

	doc.addEventListener(
		"click",
		(event) => {
			let target = event.target;
			let element = sidebar();
			if (!element || !(target instanceof Element)) return;
			if (!element.contains(target) || !target.closest("a[href]")) return;
			if (element.matches(":popover-open")) element.hidePopover();
		},
		{ signal },
	);

	doc.defaultView?.navigation?.addEventListener(
		"navigatesuccess",
		() => {
			let element = sidebar();
			if (element) markCurrentRow(element, doc.location.pathname);
		},
		{ signal },
	);

	let sheetBelow = readOptions()?.sheetBelow ?? DEFAULT_SHEET_BELOW;
	let docked = doc.defaultView?.matchMedia(appShellQueries(sheetBelow).docked);
	docked?.addEventListener(
		"change",
		() => {
			let element = sidebar();
			if (docked.matches && element?.matches(":popover-open")) element.hidePopover();
		},
		{ signal },
	);
}

/**
 * Marks the row whose link names `pathname` as the page shown and unmarks the one before it,
 * so a navigation that reloads only a frame beside the sidebar keeps its current row true.
 * With no row naming the address, the rows stay as the server drew them.
 */
function markCurrentRow(sidebar: HTMLElement, pathname: string) {
	let links = Array.from(
		sidebar.querySelectorAll<HTMLAnchorElement>('[data-slot="app-shell-item"] > a[href]'),
	);
	let match = links.find((link) => new URL(link.href).pathname === pathname);
	if (match === undefined) return;
	for (let link of links) {
		if (link === match) {
			link.setAttribute("aria-current", "page");
			link.setAttribute("data-current", "");
		} else if (link.getAttribute("aria-current") === "page") {
			link.removeAttribute("aria-current");
			link.removeAttribute("data-current");
		}
	}
}

/**
 * Flips the docked sidebar between column and rail through the checkbox, so the change event
 * writes the cookie; with the checkbox hidden (a phone), opens or closes the sheet instead.
 */
function toggle(host: HTMLInputElement, sidebar: HTMLElement | null) {
	if (host.closest("label")?.checkVisibility() ?? host.checkVisibility()) {
		host.click();
		return;
	}
	sidebar?.togglePopover();
}

/**
 * Follows the sidebar's back row on Esc, the way a swapped settings panel returns to the app.
 * Esc stays with whatever owns it first: an open dialog, menu or sheet, or a focused field.
 */
function followBackRow(event: KeyboardEvent, sidebar: HTMLElement | null) {
	if (!sidebar || isEditing(event.target)) return;
	let target = event.target;
	if (target instanceof Element && target.closest("input, select")) return;
	let doc = sidebar.ownerDocument;
	if (doc.querySelector(":popover-open, dialog[open]")) return;
	let back = sidebar.querySelector<HTMLAnchorElement>("a[data-app-shell-back]");
	if (!back) return;
	event.preventDefault();
	back.click();
}

/** Whether `target` is a text area or rich editor, where ⌘B and Esc belong to the text. */
function isEditing(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest(EDITING_SELECTOR) !== null;
}
