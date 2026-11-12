/**
 * Pointer drag between a Board's columns: a press that travels past a few pixels lifts the
 * card under a ghost that follows the pointer, the column under it lights up, and the drop
 * moves the card there at once and posts the card's own move form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { prefersReducedMotion } from "../../utils/prefers-reduced-motion.js";

/** Attribute a column carries its value on, which a drop writes into the card's move form. */
export const BOARD_COLUMN_ATTRIBUTE = "data-board-column";

/** Attribute a card carries its value on. */
export const BOARD_CARD_ATTRIBUTE = "data-board-card";

/** Attribute a card's move form names its card with, so a drop finds the form to post. */
export const BOARD_MOVE_FORM_ATTRIBUTE = "data-board-move";

/** Attribute set on the card being dragged, for as long as the drag lasts. */
export const BOARD_DRAGGING_ATTRIBUTE = "data-board-dragging";

/** Attribute set on the column the dragged card would land in. */
export const BOARD_DROP_TARGET_ATTRIBUTE = "data-board-drop-target";

/** How far a press travels before it becomes a drag, so a plain click still opens the card. */
const DRAG_THRESHOLD_PX = 5;

/** How close to the board's edge the pointer comes before the board scrolls toward it. */
const EDGE_PX = 48;

/** Elements a press on starts nothing from, so a card's own controls keep working. */
const INTERACTIVE = "button, input, select, textarea, summary, label, [popover], [contenteditable]";

/** DOM event type {@link BoardMoveEvent} is dispatched under. */
const MOVE_EVENT = "ui:board-move" as const;

declare global {
	interface HTMLElementEventMap {
		[MOVE_EVENT]: BoardMoveEvent;
	}
}

/**
 * Dispatched on a card once it is dropped on another column, before its move form posts;
 * `preventDefault()` keeps the form from posting, for a consumer that saves the move itself.
 */
export class BoardMoveEvent extends Event {
	/** The dropped card's value. */
	readonly card: string;
	/** The column it left. */
	readonly from: string;
	/** The column it landed in. */
	readonly to: string;

	/**
	 * @param init The card and the two columns.
	 */
	constructor(init: { card: string; from: string; to: string }) {
		super(MOVE_EVENT, { bubbles: true, cancelable: true });
		this.card = init.card;
		this.from = init.from;
		this.to = init.to;
	}
}

/** One press in progress: where it started and, once it travels, the ghost following it. */
interface Press {
	card: HTMLElement;
	from: HTMLElement;
	pointerId: number;
	x: number;
	y: number;
	offsetX: number;
	offsetY: number;
	ghost?: HTMLElement;
	target?: HTMLElement | null;
}

/**
 * Adds pointer drag to the board around the host: a mouse or pen press on a card that moves
 * past {@link DRAG_THRESHOLD_PX} starts a drag, Escape cancels it, and a drop on another
 * column moves the card, bumps both columns' counts and posts the card's move form with the
 * column's value. A touch press scrolls the board as usual; the card's own menu moves it there.
 *
 * @example <span hidden mix={[boardDrag()]} />
 */
export const boardDrag: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		let marker = event.node;
		connect(() => marker.closest<HTMLElement>('[data-slot="board"]'), controller.signal);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});

/**
 * Listens for presses on one board until `signal` aborts. The board is looked up from the
 * marker on each press, so a marker inserted before its board is attached still finds it.
 *
 * @param findBoard Returns the board's root, or `null` while the marker is detached.
 * @param signal Ends every listener, a drag in progress included.
 */
function connect(findBoard: () => HTMLElement | null, signal: AbortSignal): void {
	let press: (Press & { board: HTMLElement }) | undefined;

	let end = (drop: boolean) => {
		if (!press) return;
		let { board, card, from, ghost, target } = press;
		press = undefined;
		ghost?.remove();
		card.removeAttribute(BOARD_DRAGGING_ATTRIBUTE);
		board.removeAttribute("data-board-active");
		for (let column of board.querySelectorAll(`[${BOARD_DROP_TARGET_ATTRIBUTE}]`)) {
			column.removeAttribute(BOARD_DROP_TARGET_ATTRIBUTE);
		}
		if (!ghost) return;
		suppressNextClick(card);
		if (drop && target && target !== from) move(card, from, target);
	};

	document.addEventListener(
		"pointerdown",
		(event) => {
			if (event.button !== 0 || event.pointerType === "touch") return;
			let board = findBoard();
			if (!board) return;
			let origin = event.target instanceof Element ? event.target : null;
			if (!origin || origin.closest(INTERACTIVE)) return;
			let card = origin.closest<HTMLElement>(`[${BOARD_CARD_ATTRIBUTE}]`);
			let from = card?.closest<HTMLElement>(`[${BOARD_COLUMN_ATTRIBUTE}]`);
			if (!card || !from || !board.contains(card)) return;
			let rect = card.getBoundingClientRect();
			press = {
				board,
				card,
				from,
				pointerId: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				offsetX: event.clientX - rect.left,
				offsetY: event.clientY - rect.top,
			};
		},
		{ signal },
	);

	document.addEventListener(
		"pointermove",
		(event) => {
			if (!press || event.pointerId !== press.pointerId) return;
			if (!press.ghost) {
				let distance = Math.hypot(event.clientX - press.x, event.clientY - press.y);
				if (distance < DRAG_THRESHOLD_PX) return;
				press.ghost = lift(press.card);
				press.card.setAttribute(BOARD_DRAGGING_ATTRIBUTE, "");
				press.board.setAttribute("data-board-active", "");
			}
			event.preventDefault();
			press.ghost.style.transform = `translate(${event.clientX - press.offsetX}px, ${event.clientY - press.offsetY}px)${prefersReducedMotion() ? "" : " rotate(1.5deg)"}`;
			let under = document.elementFromPoint(event.clientX, event.clientY);
			let target = under?.closest<HTMLElement>(`[${BOARD_COLUMN_ATTRIBUTE}]`) ?? null;
			if (target && !press.board.contains(target)) target = null;
			if (target !== press.target) {
				press.target?.removeAttribute(BOARD_DROP_TARGET_ATTRIBUTE);
				if (target && target !== press.from) target.setAttribute(BOARD_DROP_TARGET_ATTRIBUTE, "");
				press.target = target;
			}
			scrollNearEdge(press.board, event.clientX);
		},
		{ signal },
	);

	document.addEventListener("pointerup", () => end(true), { signal });
	document.addEventListener("pointercancel", () => end(false), { signal });
	document.addEventListener(
		"keydown",
		(event) => {
			if (event.key === "Escape" && press?.ghost) {
				event.preventDefault();
				event.stopPropagation();
				end(false);
			}
		},
		{ signal, capture: true },
	);
	signal.addEventListener("abort", () => end(false));
}

/**
 * Draws the ghost: a copy of the card fixed to the viewport at the card's size, which the
 * pointer carries, with ids dropped so the page keeps one element per id.
 */
function lift(card: HTMLElement): HTMLElement {
	let rect = card.getBoundingClientRect();
	let ghost = card.cloneNode(true) as HTMLElement;
	ghost.removeAttribute(BOARD_CARD_ATTRIBUTE);
	for (let node of [ghost, ...ghost.querySelectorAll("[id]")]) node.removeAttribute("id");
	ghost.setAttribute("aria-hidden", "true");
	ghost.setAttribute("data-board-ghost", "");
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

/** Scrolls the board sideways while the pointer rests near one of its edges. */
function scrollNearEdge(board: HTMLElement, x: number): void {
	let scroller = board.querySelector<HTMLElement>('[data-slot="board-columns"]');
	if (!scroller) return;
	let rect = scroller.getBoundingClientRect();
	if (x < rect.left + EDGE_PX) scroller.scrollLeft -= 12;
	else if (x > rect.right - EDGE_PX) scroller.scrollLeft += 12;
}

/** Swallows the click a drag's release fires on a card that is a link. */
function suppressNextClick(card: HTMLElement): void {
	let swallow = (event: Event) => {
		event.preventDefault();
		event.stopPropagation();
	};
	card.addEventListener("click", swallow, { capture: true, once: true });
	setTimeout(() => card.removeEventListener("click", swallow, { capture: true }), 0);
}

/**
 * Moves the card into the target column at once, bumps both counts, then posts the card's move
 * form with the target's value unless a listener prevented the move event.
 */
function move(card: HTMLElement, from: HTMLElement, to: HTMLElement): void {
	let value = card.getAttribute(BOARD_CARD_ATTRIBUTE) ?? "";
	let event = new BoardMoveEvent({
		card: value,
		from: from.getAttribute(BOARD_COLUMN_ATTRIBUTE) ?? "",
		to: to.getAttribute(BOARD_COLUMN_ATTRIBUTE) ?? "",
	});
	if (!card.dispatchEvent(event)) return;

	let cards = to.querySelector('[data-slot="board-cards"]');
	cards?.insertBefore(card, cards.firstChild);
	bumpCount(from, -1);
	bumpCount(to, 1);
	if (!prefersReducedMotion()) {
		card.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
	}

	let form = document.querySelector<HTMLFormElement>(
		`form[${BOARD_MOVE_FORM_ATTRIBUTE}="${CSS.escape(value)}"]`,
	);
	let input = form?.querySelector<HTMLInputElement>("input[data-board-move-input]");
	if (!form || !input) return;
	input.disabled = false;
	input.value = event.to;
	form.requestSubmit();
	input.disabled = true;
}

/** Adds `delta` to a column's count, when the column shows one. */
function bumpCount(column: HTMLElement, delta: number): void {
	let count = column.querySelector('[data-slot="board-count"]');
	let value = Number(count?.textContent);
	if (count && Number.isFinite(value)) count.textContent = String(Math.max(0, value + delta));
}
