/**
 * Why JS: dragging an item between or within lists, and moving one from the keyboard, need pointer
 * and key listeners. No-JS baseline: each item's own move form, or a menu inside it, still moves it
 * with a plain post, and the lists stay readable markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { prefersReducedMotion } from "../utils/prefers-reduced-motion.js";

/** Attribute on the element holding every list the mixin moves items between. */
export const SORTABLE_ATTRIBUTE = "data-sortable";

/** Attribute a list carries its value on, which a move sends in the item's form. */
export const SORTABLE_LIST_ATTRIBUTE = "data-sortable-list";

/** Attribute on the element inside a list that holds its items; the list itself without one. */
export const SORTABLE_ITEMS_ATTRIBUTE = "data-sortable-items";

/** Attribute an item carries its value on, unique across the lists. */
export const SORTABLE_ITEM_ATTRIBUTE = "data-sortable-item";

/** Attribute an item's move form names its item with, so a move finds the form to post. */
export const SORTABLE_FORM_ATTRIBUTE = "data-sortable-form";

/**
 * Attribute a move form names its list field with. A move appends that field after the form's
 * own, with the list's value, and the next render of the form drops it again.
 */
export const SORTABLE_FIELD_ATTRIBUTE = "data-sortable-field";

/**
 * Attribute a move form names its position field with. A move sends the value of the item it
 * lands before in that field, or an empty value when it lands last. A form without one moves
 * its item only between lists, to the top.
 */
export const SORTABLE_POSITION_ATTRIBUTE = "data-sortable-position";

/** Attribute on a list's count, which a move between lists keeps current until the page answers. */
export const SORTABLE_COUNT_ATTRIBUTE = "data-sortable-count";

/** Attribute on a list's title, which a keyboard move announces. */
export const SORTABLE_TITLE_ATTRIBUTE = "data-sortable-title";

/** Attribute on the live region a keyboard move is announced through. */
export const SORTABLE_STATUS_ATTRIBUTE = "data-sortable-status";

/** Attribute on the element that scrolls while the pointer rests near its edge mid-drag. */
export const SORTABLE_SCROLLER_ATTRIBUTE = "data-sortable-scroller";

/** Attribute set on the root for as long as a drag lasts. */
export const SORTABLE_ACTIVE_ATTRIBUTE = "data-sortable-active";

/** Attribute set on the item being dragged, for as long as the drag lasts. */
export const SORTABLE_DRAGGING_ATTRIBUTE = "data-sortable-dragging";

/** Attribute set on another list while the dragged item would land in it. */
export const SORTABLE_TARGET_ATTRIBUTE = "data-sortable-target";

/** Attribute on the copy of the item that follows the pointer. */
export const SORTABLE_GHOST_ATTRIBUTE = "data-sortable-ghost";

/** How far a press travels before it becomes a drag, so a plain click still opens the item. */
const DRAG_THRESHOLD_PX = 5;

/** How close to the scroller's edge the pointer comes before it scrolls toward it. */
const EDGE_PX = 48;

/** Elements a press on starts nothing from, so an item's own controls keep working. */
const INTERACTIVE = "button, input, select, textarea, summary, label, [popover], [contenteditable]";

/** DOM event type {@link SortableMoveEvent} is dispatched under. */
const MOVE_EVENT = "ui:sortable-move" as const;

declare global {
	interface HTMLElementEventMap {
		[MOVE_EVENT]: SortableMoveEvent;
	}
}

/**
 * Dispatched on an item once it is dropped or moved by key, before its move form posts;
 * `preventDefault()` keeps the item in place and the form from posting, for a consumer that
 * saves the move itself.
 */
export class SortableMoveEvent extends Event {
	/** The moved item's value. */
	readonly item: string;
	/** The list it left. */
	readonly from: string;
	/** The list it landed in, the same as `from` for a move within a list. */
	readonly to: string;
	/** The item it landed before, `null` when it landed last or its form takes no position. */
	readonly before: string | null;

	/**
	 * @param init The item, the two lists, and the item it landed before.
	 */
	constructor(init: { item: string; from: string; to: string; before?: string | null }) {
		super(MOVE_EVENT, { bubbles: true, cancelable: true });
		this.item = init.item;
		this.from = init.from;
		this.to = init.to;
		this.before = init.before ?? null;
	}
}

/** Options for {@link sortable}. */
export interface SortableOptions {
	/**
	 * What a keyboard move announces, with `{list}` where the list's title goes, such as
	 * "Moved to {list}". Without it a keyboard move is silent.
	 */
	moved?: string;
}

/** One press in progress: where it started and, once it travels, the ghost following it. */
interface Press {
	root: HTMLElement;
	item: HTMLElement;
	from: HTMLElement;
	pointerId: number;
	x: number;
	y: number;
	offsetX: number;
	offsetY: number;
	ghost?: HTMLElement;
	target?: HTMLElement | null;
	/** Where the item sat before the press, to put it back on a cancel. */
	origin: { parent: Node | null; next: Node | null };
	/** Whether the item lands where the pointer is, so the drag places it as it goes. */
	positioned: boolean;
}

/**
 * Moves items within and between the lists inside the nearest {@link SORTABLE_ATTRIBUTE} root.
 * A mouse or pen press on an item that travels past a few pixels lifts it under a ghost, places
 * it between the items under the pointer, and posts its move form on release; Escape puts it
 * back. Shift+ArrowUp/Down move the focused item past its neighbour, and Shift+ArrowLeft/Right to
 * the top of the list on either side. A touch press scrolls as usual.
 *
 * @example <span hidden mix={[sortable({ moved: "Moved to {list}" })]} />
 */
export const sortable: MixinFactory<HTMLElement, [options?: SortableOptions]> = createMixin<
	HTMLElement,
	[options?: SortableOptions]
>((handle) => {
	let controller: AbortController | undefined;
	let options: SortableOptions = {};

	/** Starts listening once the marker is in the page, replacing any earlier listeners. */
	function attach(event: { node: HTMLElement }): void {
		controller?.abort();
		controller = new AbortController();
		let marker = event.node;
		connect(findRoot, readOptions, controller.signal);

		/** The root around the marker, or `null` while the marker is detached. */
		function findRoot(): HTMLElement | null {
			return marker.closest<HTMLElement>(`[${SORTABLE_ATTRIBUTE}]`);
		}
	}

	/** Stops listening, ending a drag in progress. */
	function detach(): void {
		controller?.abort();
		controller = undefined;
	}

	/** The latest options, read at each keyboard move. */
	function readOptions(): SortableOptions {
		return options;
	}

	handle.addEventListener("insert", attach);
	handle.addEventListener("remove", detach);

	return (next) => {
		options = next ?? {};
	};
});

/**
 * Listens for presses and keys on one root until `signal` aborts. The root is looked up from the
 * marker on each event, so a marker inserted before its root is attached still finds it.
 *
 * @param findRoot Returns the root, or `null` while the marker is detached.
 * @param readOptions Returns the mixin's latest options.
 * @param signal Ends every listener, a drag in progress included.
 */
function connect(
	findRoot: () => HTMLElement | null,
	readOptions: () => SortableOptions,
	signal: AbortSignal,
): void {
	let press: Press | undefined;

	/**
	 * Ends the press: clears every drag mark and puts a placed item back where it started, then
	 * moves it to where it was dropped, so a listener that prevents the move leaves it in place.
	 */
	function end(drop: boolean): void {
		if (!press) return;
		let { root, item, from, ghost, target, origin, positioned } = press;
		press = undefined;
		ghost?.remove();
		item.removeAttribute(SORTABLE_DRAGGING_ATTRIBUTE);
		root.removeAttribute(SORTABLE_ACTIVE_ATTRIBUTE);
		for (let list of root.querySelectorAll(`[${SORTABLE_TARGET_ATTRIBUTE}]`)) {
			list.removeAttribute(SORTABLE_TARGET_ATTRIBUTE);
		}
		if (!ghost) return;
		suppressNextClick(item);
		if (!positioned) {
			if (drop && target && target !== from) move(item, from, target, firstItem(target, item));
			return;
		}
		let to = item.closest<HTMLElement>(`[${SORTABLE_LIST_ATTRIBUTE}]`);
		let moved = item.parentNode !== origin.parent || item.nextSibling !== origin.next;
		let before = nextItem(item);
		origin.parent?.insertBefore(item, origin.next);
		if (drop && to && moved) move(item, from, to, before);
	}

	/** Records a mouse or pen press on an item, outside the item's own controls. */
	function onPointerDown(event: PointerEvent): void {
		if (event.button !== 0 || event.pointerType === "touch") return;
		let root = findRoot();
		if (!root) return;
		let origin = event.target instanceof Element ? event.target : null;
		if (!origin || origin.closest(INTERACTIVE)) return;
		let item = origin.closest<HTMLElement>(`[${SORTABLE_ITEM_ATTRIBUTE}]`);
		let from = item?.closest<HTMLElement>(`[${SORTABLE_LIST_ATTRIBUTE}]`);
		if (!item || !from || !root.contains(item)) return;
		let rect = item.getBoundingClientRect();
		press = {
			root,
			item,
			from,
			origin: { parent: item.parentNode, next: item.nextSibling },
			positioned: takesPosition(item),
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			offsetX: event.clientX - rect.left,
			offsetY: event.clientY - rect.top,
		};
	}

	/** Lifts the item past the threshold, then carries the ghost and places the item under it. */
	function onPointerMove(event: PointerEvent): void {
		if (!press || event.pointerId !== press.pointerId) return;
		if (!press.ghost) {
			let distance = Math.hypot(event.clientX - press.x, event.clientY - press.y);
			if (distance < DRAG_THRESHOLD_PX) return;
			press.ghost = lift(press.item);
			press.item.setAttribute(SORTABLE_DRAGGING_ATTRIBUTE, "");
			press.root.setAttribute(SORTABLE_ACTIVE_ATTRIBUTE, "");
		}
		event.preventDefault();
		let tilt = prefersReducedMotion() ? "" : " rotate(1.5deg)";
		press.ghost.style.transform = `translate(${event.clientX - press.offsetX}px, ${event.clientY - press.offsetY}px)${tilt}`;
		let under = document.elementFromPoint(event.clientX, event.clientY);
		let target = under?.closest<HTMLElement>(`[${SORTABLE_LIST_ATTRIBUTE}]`) ?? null;
		if (target && !press.root.contains(target)) target = null;
		if (target !== press.target) {
			press.target?.removeAttribute(SORTABLE_TARGET_ATTRIBUTE);
			if (target && target !== press.from) target.setAttribute(SORTABLE_TARGET_ATTRIBUTE, "");
			press.target = target;
		}
		if (press.positioned && target) place(press.item, target, event.clientY);
		scrollNearEdge(press.root, event.clientX, event.clientY);
	}

	/** Drops the item where the pointer let go. */
	function onPointerUp(): void {
		end(true);
	}

	/** Puts everything back when the pointer is taken away or the listeners end. */
	function cancel(): void {
		end(false);
	}

	/** Cancels a drag on Escape, before anything else on the page reads the key. */
	function onKeyDown(event: KeyboardEvent): void {
		if (event.key !== "Escape" || !press?.ghost) return;
		event.preventDefault();
		event.stopPropagation();
		end(false);
	}

	/** Moves the focused item on Shift+Arrow, keeping its focus, and announces where it went. */
	function onMoveKey(event: KeyboardEvent): void {
		if (!event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
		if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
		let root = findRoot();
		let focused = document.activeElement;
		let item = focused?.closest<HTMLElement>(`[${SORTABLE_ITEM_ATTRIBUTE}]`);
		let from = item?.closest<HTMLElement>(`[${SORTABLE_LIST_ATTRIBUTE}]`);
		if (!root || !item || !from || !root.contains(item)) return;
		if (focused?.matches("input, textarea, select, [contenteditable]")) return;
		let target = keyTarget(root, item, from, event.key);
		if (!target) return;
		event.preventDefault();
		move(item, from, target.list, target.before);
		if (focused instanceof HTMLElement) focused.focus({ preventScroll: false });
		announce(root, target.list, readOptions().moved);
	}

	document.addEventListener("pointerdown", onPointerDown, { signal });
	document.addEventListener("pointermove", onPointerMove, { signal });
	document.addEventListener("pointerup", onPointerUp, { signal });
	document.addEventListener("pointercancel", cancel, { signal });
	document.addEventListener("keydown", onKeyDown, { signal, capture: true });
	document.addEventListener("keydown", onMoveKey, { signal });
	signal.addEventListener("abort", cancel);
}

/**
 * Draws the ghost: a copy of the item fixed to the viewport at the item's size, which the
 * pointer carries, with ids dropped so the page keeps one element per id.
 */
function lift(item: HTMLElement): HTMLElement {
	let rect = item.getBoundingClientRect();
	let ghost = item.cloneNode(true) as HTMLElement;
	ghost.removeAttribute(SORTABLE_ITEM_ATTRIBUTE);
	for (let node of [ghost, ...ghost.querySelectorAll("[id]")]) node.removeAttribute("id");
	ghost.setAttribute("aria-hidden", "true");
	ghost.setAttribute(SORTABLE_GHOST_ATTRIBUTE, "");
	Object.assign(ghost.style, {
		position: "fixed",
		insetBlockStart: "0",
		insetInlineStart: "0",
		inlineSize: `${rect.width}px`,
		margin: "0",
		pointerEvents: "none",
		zIndex: "1000",
		listStyle: "none",
		boxShadow: "var(--ui-shadow-xl, 0 12px 28px rgb(0 0 0 / 0.18))",
	});
	document.body.appendChild(ghost);
	return ghost;
}

/** Scrolls the root's scroller toward whichever of its edges the pointer rests near. */
function scrollNearEdge(root: HTMLElement, x: number, y: number): void {
	let scroller = root.querySelector<HTMLElement>(`[${SORTABLE_SCROLLER_ATTRIBUTE}]`) ?? root;
	let rect = scroller.getBoundingClientRect();
	if (x < rect.left + EDGE_PX) scroller.scrollLeft -= 12;
	else if (x > rect.right - EDGE_PX) scroller.scrollLeft += 12;
	if (y < rect.top + EDGE_PX) scroller.scrollTop -= 12;
	else if (y > rect.bottom - EDGE_PX) scroller.scrollTop += 12;
}

/** Swallows the click a drag's release fires on an item that is a link. */
function suppressNextClick(item: HTMLElement): void {
	item.addEventListener("click", swallow, { capture: true, once: true });
	setTimeout(release, 0);

	/** Keeps the click from following the item's link. */
	function swallow(event: Event): void {
		event.preventDefault();
		event.stopPropagation();
	}

	/** Lets later clicks through once the release's own click has passed. */
	function release(): void {
		item.removeEventListener("click", swallow, { capture: true });
	}
}

/**
 * Puts the item in the target list before `before` (last when `null`) at once, bumps both counts
 * when it changed list, then posts the item's move form with the list's value and, when the form
 * takes one, the position, unless a listener prevented the move event.
 */
function move(
	item: HTMLElement,
	from: HTMLElement,
	to: HTMLElement,
	before: HTMLElement | null,
): void {
	let form = moveForm(item);
	let event = new SortableMoveEvent({
		item: item.getAttribute(SORTABLE_ITEM_ATTRIBUTE) ?? "",
		from: from.getAttribute(SORTABLE_LIST_ATTRIBUTE) ?? "",
		to: to.getAttribute(SORTABLE_LIST_ATTRIBUTE) ?? "",
		before: takesPosition(item) ? (before?.getAttribute(SORTABLE_ITEM_ATTRIBUTE) ?? null) : null,
	});
	if (!item.dispatchEvent(event)) return;

	itemsOf(to).insertBefore(item, before);
	if (from !== to) {
		bumpCount(from, -1);
		bumpCount(to, 1);
	}
	if (!prefersReducedMotion()) {
		item.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
	}

	let name = form?.getAttribute(SORTABLE_FIELD_ATTRIBUTE);
	if (!form || !name) return;
	form.appendChild(hiddenInput(name, event.to));
	let position = form.getAttribute(SORTABLE_POSITION_ATTRIBUTE);
	if (position) form.appendChild(hiddenInput(position, event.before ?? ""));
	form.requestSubmit();
}

/** A hidden field, appended after the form's own so a reader of the post takes its value last. */
function hiddenInput(name: string, value: string): HTMLInputElement {
	let input = document.createElement("input");
	input.type = "hidden";
	input.name = name;
	input.value = value;
	return input;
}

/** The item's own move form, when it has one. */
function moveForm(item: HTMLElement): HTMLFormElement | null {
	let value = item.getAttribute(SORTABLE_ITEM_ATTRIBUTE) ?? "";
	return document.querySelector<HTMLFormElement>(
		`form[${SORTABLE_FORM_ATTRIBUTE}="${CSS.escape(value)}"]`,
	);
}

/** Whether the item can land anywhere: it has no move form, or its form takes a position. */
function takesPosition(item: HTMLElement): boolean {
	let form = moveForm(item);
	return !form || form.hasAttribute(SORTABLE_POSITION_ATTRIBUTE);
}

/** The element a list's items live in. */
function itemsOf(list: HTMLElement): HTMLElement {
	return list.querySelector<HTMLElement>(`[${SORTABLE_ITEMS_ATTRIBUTE}]`) ?? list;
}

/** The items of a list, in order, leaving `except` out. */
function itemsIn(list: HTMLElement, except?: HTMLElement): HTMLElement[] {
	return [...itemsOf(list).children].filter(
		(child): child is HTMLElement =>
			child instanceof HTMLElement &&
			child.hasAttribute(SORTABLE_ITEM_ATTRIBUTE) &&
			child !== except,
	);
}

/** The list's first item other than `except`, before which an item lands at the top. */
function firstItem(list: HTMLElement, except: HTMLElement): HTMLElement | null {
	return itemsIn(list, except)[0] ?? null;
}

/** The item right after `item` in its list, or `null` when it is last. */
function nextItem(item: HTMLElement): HTMLElement | null {
	let next = item.nextElementSibling;
	while (next && !next.hasAttribute(SORTABLE_ITEM_ATTRIBUTE)) next = next.nextElementSibling;
	return next instanceof HTMLElement ? next : null;
}

/** Moves the dragged item into `list` before the first item whose middle is below `y`. */
function place(item: HTMLElement, list: HTMLElement, y: number): void {
	let container = itemsOf(list);
	let before =
		itemsIn(list, item).find((other) => {
			let rect = other.getBoundingClientRect();
			return y < rect.top + rect.height / 2;
		}) ?? null;
	if (item.parentNode === container && nextItem(item) === before) return;
	container.insertBefore(item, before);
}

/**
 * Where a Shift+Arrow key sends an item: the top of the list to either side, or past its
 * neighbour above or below when it can land anywhere.
 */
function keyTarget(
	root: HTMLElement,
	item: HTMLElement,
	from: HTMLElement,
	key: string,
): { list: HTMLElement; before: HTMLElement | null } | null {
	if (key === "ArrowLeft" || key === "ArrowRight") {
		let lists = [...root.querySelectorAll<HTMLElement>(`[${SORTABLE_LIST_ATTRIBUTE}]`)];
		let list = lists[lists.indexOf(from) + (key === "ArrowLeft" ? -1 : 1)];
		return list ? { list, before: firstItem(list, item) } : null;
	}
	if (!takesPosition(item)) return null;
	let items = itemsIn(from);
	let index = items.indexOf(item);
	if (key === "ArrowUp") {
		return index > 0 ? { list: from, before: items[index - 1]! } : null;
	}
	if (index === items.length - 1) return null;
	return { list: from, before: items[index + 2] ?? null };
}

/** Says where a keyboard move put the item, through the root's own live region. */
function announce(root: HTMLElement, list: HTMLElement, template: string | undefined): void {
	let region = root.querySelector(`[${SORTABLE_STATUS_ATTRIBUTE}]`);
	if (!region || template === undefined) return;
	let title = list.querySelector(`[${SORTABLE_TITLE_ATTRIBUTE}]`)?.textContent ?? "";
	region.textContent = template.replace("{list}", title);
}

/** Adds `delta` to a list's count, when the list shows one. */
function bumpCount(list: HTMLElement, delta: number): void {
	let count = list.querySelector(`[${SORTABLE_COUNT_ATTRIBUTE}]`);
	let value = Number(count?.textContent);
	if (count && Number.isFinite(value)) count.textContent = String(Math.max(0, value + delta));
}
