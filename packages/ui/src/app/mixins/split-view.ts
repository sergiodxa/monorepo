/**
 * Why JS: a split view remembers its panes' widths and collapsed panes in a cookie, resizes
 * from the keyboard, steps through the list with j/k while the list keeps its scroll, and
 * closes its sidebar sheet on navigation; HTML has no declarative wiring for any of these.
 * No-JS baseline: panes render at their remembered layout and every item is a link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { iife } from "@sdxc/iife";
import { createElement, createMixin, on } from "remix/component";

import type { SplitViewPane } from "../utils/split-view-layout.js";

import { isClaimedKeystroke } from "../../mixins/keymap.js";
import { matchesKeyCombo } from "../../utils/key-combo.js";
import { writeCookie } from "../../utils/write-cookie.js";
import { ResizeSession } from "../behaviors/resize-session.js";
import { serializeSplitViewLayout } from "../utils/split-view-layout.js";

import { ResizableLayoutChangeEvent } from "./resize-handle.js";

/**
 * Where a split view's j/k answer: `"page"` anywhere in the document, `"view"` only while
 * focus is inside the view, for a view shown on a page whose own keys come first.
 */
export type SplitViewKeyScope = "page" | "view";

/** Attribute an app puts on each list link j/k steps through, in list order. */
export const SPLIT_VIEW_ITEM_ATTRIBUTE = "data-split-view-item";

/** The custom property each resizable pane's share is stored in. */
const SIZE_PROPERTY = "--ui-resizable-panel-size";

/** How far one arrow press moves a divider, as a percentage of the view. */
const KEY_STEP = 2;

/** Container width, in rem, from which the sidebar is a pane rather than a sheet. */
const WIDE_REM = 64;

/** The split view a node belongs to. */
function rootOf(node: Element): HTMLElement | null {
	return node.closest<HTMLElement>("[data-split-view]");
}

/** The pane element named `pane` in `root`. */
function paneOf(root: HTMLElement, pane: SplitViewPane): HTMLElement | null {
	return root.querySelector<HTMLElement>(`[data-resizable-group] > [data-pane="${pane}"]`);
}

/** Panes `root` has collapsed, read off its `data-collapsed` tokens. */
function collapsedPanes(root: HTMLElement): SplitViewPane[] {
	return (root.dataset.collapsed ?? "").split(" ").filter(Boolean) as SplitViewPane[];
}

/** A pane's stored share, or `undefined` while it still sits at its default width. */
function storedSize(root: HTMLElement, pane: SplitViewPane): number | undefined {
	let raw = paneOf(root, pane)?.style.getPropertyValue(SIZE_PROPERTY).trim() ?? "";
	let value = Number.parseFloat(raw);
	return Number.isFinite(value) ? value : undefined;
}

/** Writes the view's current layout to the cookie its root names. */
function persist(root: HTMLElement): void {
	let cookie = root.dataset.cookie;
	if (!cookie) return;
	let value = serializeSplitViewLayout({
		sidebar: storedSize(root, "sidebar"),
		list: storedSize(root, "list"),
		collapsed: collapsedPanes(root),
	});
	writeCookie(cookie, encodeURIComponent(value), { path: root.dataset.cookiePath });
}

/**
 * Collapses or restores `pane` and remembers it. The list and the detail never both
 * collapse: collapsing one brings the other back, so the view always shows a record.
 *
 * @param root The split view.
 * @param pane The pane to change.
 * @param collapsed Whether it ends collapsed.
 */
export function setSplitViewCollapsed(
	root: HTMLElement,
	pane: SplitViewPane,
	collapsed: boolean,
): void {
	let panes = collapsedPanes(root).filter((name) => name !== pane);
	if (collapsed) {
		panes.push(pane);
		if (pane !== "sidebar") panes = panes.filter((name) => name === pane || name === "sidebar");
	}
	root.dataset.collapsed = panes.join(" ");
	for (let toggle of root.ownerDocument.querySelectorAll(`[data-split-view-toggle="${root.id}"]`)) {
		let name = toggle.getAttribute("data-pane") as SplitViewPane;
		toggle.setAttribute("aria-expanded", String(!panes.includes(name)));
	}
	persist(root);
}

/**
 * Writes every expanded pane's measured share onto it, so a session starts from what the
 * reader sees; a collapsed pane keeps the share it will expand back to.
 *
 * @returns The collapsed panes' stored shares, to put back once the session settles.
 */
function seedSizes(group: HTMLElement, root: HTMLElement): Map<HTMLElement, string> {
	let width = group.getBoundingClientRect().width;
	let collapsed = collapsedPanes(root);
	let kept = new Map<HTMLElement, string>();
	for (let panel of group.querySelectorAll<HTMLElement>(":scope > [data-resizable-panel]")) {
		if (collapsed.includes(panel.dataset.pane as SplitViewPane)) {
			kept.set(panel, panel.style.getPropertyValue(SIZE_PROPERTY));
			continue;
		}
		let share = (panel.getBoundingClientRect().width / width) * 100;
		panel.style.setProperty(SIZE_PROPERTY, `${Math.round(share * 100) / 100}%`);
	}
	return kept;
}

/** Puts back the shares {@link seedSizes} kept for collapsed panes. */
function restoreSizes(kept: Map<HTMLElement, string>): void {
	for (let [panel, value] of kept) {
		if (value === "") panel.style.removeProperty(SIZE_PROPERTY);
		else panel.style.setProperty(SIZE_PROPERTY, value);
	}
}

/**
 * Moves the divider by `percent` of the view through a one-step session, as a drag of
 * that distance would, then settles the layout the same way a released drag does.
 */
function nudge(handle: HTMLElement, group: HTMLElement, percent: number): void {
	let handles = [...group.querySelectorAll<HTMLElement>(":scope > [data-resizable-handle]")];
	let panels = [...group.querySelectorAll<HTMLElement>(":scope > [data-resizable-panel]")];
	let groupSize = group.getBoundingClientRect().width;
	let session = new ResizeSession();
	session.start({
		handleIndex: handles.indexOf(handle),
		groupSize,
		pointerPosition: 0,
		panels: panels.map((panel, index) => ({
			id: panel.id || String(index),
			size: Number.parseFloat(panel.style.getPropertyValue(SIZE_PROPERTY)) || 0,
			min: Number(panel.getAttribute("data-resizable-min") ?? 0),
			max: Number(panel.getAttribute("data-resizable-max") ?? 100),
		})),
	});
	session.move((percent / 100) * groupSize);
	session.end();
	session.panels.forEach((panel, index) =>
		panels[index]?.style.setProperty(SIZE_PROPERTY, `${Math.round(panel.size * 100) / 100}%`),
	);
	group.dispatchEvent(new ResizableLayoutChangeEvent(session.panels));
}

/**
 * The split view's part of a divider, beside `resizeHandle()`: measures the panes before a
 * drag starts, remembers the settled layout, moves the divider with ←/→, and collapses or
 * restores the pane before it with Enter. Put it before `resizeHandle()` in `mix`.
 *
 * @param pane The pane before the divider, which Enter collapses.
 * @returns A mixin descriptor for the divider.
 * @example <div data-resizable-handle mix={[splitViewHandle("list"), resizeHandle("horizontal", session)]} />
 */
export const splitViewHandle: MixinFactory<HTMLElement, [pane: SplitViewPane]> = createMixin<
	HTMLElement,
	[pane: SplitViewPane]
>((handle) => {
	let kept = new Map<HTMLElement, string>();

	handle.addEventListener("insert", (event) => {
		let group = event.node.parentElement;
		let root = rootOf(event.node);
		if (!group || !root) return;
		group.addEventListener(
			"ui:resizable-layout-change",
			() => {
				restoreSizes(kept);
				kept = new Map();
				persist(root);
			},
			{ signal: handle.signal },
		);
	});

	return (pane) =>
		createElement(handle.element, {
			mix: [
				on<HTMLElement, "pointerdown">("pointerdown", (event) => {
					let node = event.currentTarget;
					let root = rootOf(node);
					if (node.parentElement && root) kept = seedSizes(node.parentElement, root);
				}),
				on<HTMLElement, "keydown">("keydown", (event) => {
					let node = event.currentTarget;
					let group = node.parentElement;
					let root = rootOf(node);
					if (!group || !root) return;

					if (event.key === "Enter") {
						event.preventDefault();
						setSplitViewCollapsed(root, pane, !collapsedPanes(root).includes(pane));
						return;
					}
					let step = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP }[event.key];
					if (step === undefined) return;
					event.preventDefault();
					kept = seedSizes(group, root);
					nudge(node, group, step);
				}),
			],
		});
});

/**
 * Collapses or restores a pane from a button. For the sidebar below the wide breakpoint
 * the button's own `popovertarget` opens the sidebar as a sheet instead.
 *
 * @param viewId The split view's id.
 * @param pane The pane the button collapses.
 * @returns A mixin descriptor for the toggle button.
 * @example <button data-pane="sidebar" mix={[splitViewToggle("inbox", "sidebar")]} />
 */
export const splitViewToggle: MixinFactory<
	HTMLButtonElement,
	[viewId: string, pane: SplitViewPane]
> = createMixin<HTMLButtonElement, [viewId: string, pane: SplitViewPane]>(
	(handle) => (viewId, pane) =>
		createElement(handle.element, {
			mix: [
				on<HTMLButtonElement, "click">("click", (event) => {
					let root = event.currentTarget.ownerDocument.getElementById(viewId);
					if (!root) return;
					if (pane === "sidebar") {
						let rem = Number.parseFloat(
							getComputedStyle(root.ownerDocument.documentElement).fontSize,
						);
						if (root.getBoundingClientRect().width < WIDE_REM * rem) return;
					}
					event.preventDefault();
					setSplitViewCollapsed(root, pane, !collapsedPanes(root).includes(pane));
				}),
			],
		}),
);

/** Session-storage key the list's scroll offset is kept under across full page loads. */
function scrollKey(list: HTMLElement): string {
	return `ui-split-view:${list.id}:${list.ownerDocument.location.pathname}`;
}

/**
 * A j/k press: the item it marked current ahead of its page, and the item and value the
 * page's markup had marked before the first press of a run.
 */
interface Step {
	to: HTMLAnchorElement;
	origin: { item: HTMLAnchorElement; value: string } | undefined;
}

/**
 * Marks the item `offset` away from the current one as current and follows it. The mark is
 * ahead of the page: the next render's markup takes it over, and when the navigation fails
 * the mark returns to the item the page's markup had marked.
 *
 * @param list The list pane.
 * @param offset How many items to move, negative for up.
 * @param last The previous press, whose mark may still be ahead of its page.
 * @param latest Whether `step` is still the latest press, read when its navigation fails.
 * @returns The press just made, or `undefined` when there was nowhere to go.
 */
function step(
	list: HTMLElement,
	offset: number,
	last: Step | undefined,
	latest: (step: Step) => boolean,
): Step | undefined {
	let items = [
		...list.querySelectorAll<HTMLAnchorElement>(`a[href][${SPLIT_VIEW_ITEM_ATTRIBUTE}]`),
	];
	if (items.length === 0) return undefined;
	let current = items.findIndex((item) => {
		let value = item.getAttribute("aria-current");
		return value !== null && value !== "false";
	});
	let next = items[current === -1 ? 0 : Math.min(Math.max(current + offset, 0), items.length - 1)];
	if (!next || next === items[current]) return undefined;

	let marked = items[current];
	let origin = iife(() => {
		if (last?.origin && last.to === marked) return last.origin;
		let value = marked?.getAttribute("aria-current");
		return marked && value ? { item: marked, value } : undefined;
	});
	let made: Step = { to: next, origin };
	marked?.removeAttribute("aria-current");
	next.setAttribute("aria-current", "page");
	next.scrollIntoView({ block: "nearest" });
	next.click();
	list.ownerDocument.defaultView?.navigation?.transition?.finished.then(
		() => {
			made.origin = undefined;
		},
		() => {
			if (!latest(made) || next.getAttribute("aria-current") !== "page") return;
			next.removeAttribute("aria-current");
			origin?.item.setAttribute("aria-current", origin.value);
		},
	);
	return made;
}

/**
 * Binds j/k to step through the list's items while the list keeps its scroll, keeps the
 * list's scroll offset across full page loads, and closes the sidebar sheet when one of
 * its links is followed.
 *
 * @param listId The list pane's id.
 * @param sidebarId The sidebar pane's id, when the view has one.
 * @param scope `"page"` answers j/k anywhere; `"view"` only while focus is inside the view.
 * @returns A mixin descriptor for the view's key marker.
 * @example <span hidden mix={[splitViewKeys("inbox-list", "inbox-sidebar", "page")]} />
 */
export const splitViewKeys: MixinFactory<
	HTMLElement,
	[listId: string, sidebarId: string | undefined, scope: SplitViewKeyScope]
> = createMixin<
	HTMLElement,
	[listId: string, sidebarId: string | undefined, scope: SplitViewKeyScope]
>((handle) => {
	let ids = { list: "", sidebar: "" };
	let current: SplitViewKeyScope = "page";
	let last: Step | undefined;

	handle.addEventListener("insert", (event) => {
		let document = event.node.ownerDocument;
		let list = document.getElementById(ids.list);
		if (!list) return;

		try {
			let saved = sessionStorage.getItem(scrollKey(list));
			if (saved !== null) list.scrollTop = Number(saved);
		} catch {}
		let save = () => {
			try {
				sessionStorage.setItem(scrollKey(list), String(list.scrollTop));
			} catch {}
		};
		list.addEventListener("scroll", save, { signal: handle.signal, passive: true });

		document.addEventListener(
			"keydown",
			(keystroke) => {
				if (isClaimedKeystroke(keystroke)) return;
				let target = keystroke.target instanceof Element ? keystroke.target : null;
				if (current === "view" && !(target && rootOf(target) === rootOf(list))) return;
				let offset = matchesKeyCombo(keystroke, "j") ? 1 : 0;
				if (matchesKeyCombo(keystroke, "k")) offset = -1;
				if (offset === 0) return;
				let made = step(list, offset, last, (press) => press === last);
				if (!made) return;
				last = made;
				keystroke.preventDefault();
			},
			{ signal: handle.signal },
		);

		let sidebar = ids.sidebar ? document.getElementById(ids.sidebar) : null;
		sidebar?.addEventListener(
			"click",
			(click) => {
				let target = click.target instanceof Element ? click.target : null;
				if (target?.closest("a[href]") && sidebar.matches(":popover-open")) sidebar.hidePopover();
			},
			{ signal: handle.signal },
		);
	});

	return (listId, sidebarId, scope) => {
		ids = { list: listId, sidebar: sidebarId ?? "" };
		current = scope;
	};
});
