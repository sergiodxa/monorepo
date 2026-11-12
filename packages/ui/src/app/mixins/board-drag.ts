/**
 * Pointer drag between a Board's columns: a press that travels past a few pixels lifts the
 * card under a ghost that follows the pointer, the column under it lights up, and the drop
 * moves the card there at once and posts the card's own move form. A form that names a position
 * field also places the card between the cards under the pointer, and sends the card it precedes.
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

/**
 * Attribute a card's move form names its column field with. A drop appends that field to the
 * form, after the form's own fields, and the next render of the form drops it again.
 */
export const BOARD_MOVE_FIELD_ATTRIBUTE = "data-board-move-field";

/**
 * Attribute a card's move form names its position field with. A move sends the value of the
 * card it lands before in that field, or an empty value when it lands last.
 */
export const BOARD_MOVE_POSITION_ATTRIBUTE = "data-board-move-position";

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
	/** The card it landed before, `null` when it landed last or the board places no positions. */
	readonly before: string | null;

	/**
	 * @param init The card, the two columns, and the card it landed before.
	 */
	constructor(init: { card: string; from: string; to: string; before?: string | null }) {
		super(MOVE_EVENT, { bubbles: true, cancelable: true });
		this.card = init.card;
		this.from = init.from;
		this.to = init.to;
		this.before = init.before ?? null;
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
	/** Where the card sat before the press, to put it back on a cancel. */
	origin: { parent: Node | null; next: Node | null };
	/** Whether the card's form takes a position, so the drag places the card as it goes. */
	positioned: boolean;
}

/** Options for {@link boardDrag}. */
export interface BoardDragOptions {
	/**
	 * What a keyboard move announces, with `{column}` where the column's title goes, such as
	 * "Moved to {column}". Without it a keyboard move is silent.
	 */
	moved?: string;
}

/**
 * Adds pointer and keyboard moves to the board around the host. A mouse or pen press on a
 * card that moves past {@link DRAG_THRESHOLD_PX} starts a drag, Escape cancels it, and a drop
 * on another column moves the card. Shift+ArrowLeft and Shift+ArrowRight move the card that
 * holds focus one column over, keeping its focus. Either way both columns' counts update and
 * the card's move form posts the column's value. A touch press scrolls the board as usual.
 *
 * @example <span hidden mix={[boardDrag({ moved: "Moved to {column}" })]} />
 */
export const boardDrag: MixinFactory<HTMLElement, [options?: BoardDragOptions]> = createMixin<
	HTMLElement,
	[options?: BoardDragOptions]
>((handle) => {
	let controller: AbortController | undefined;
	let options: BoardDragOptions = {};

	/** Starts listening once the marker is in the page, replacing any earlier listeners. */
	function attach(event: { node: HTMLElement }): void {
		controller?.abort();
		controller = new AbortController();
		let marker = event.node;
		connect(findBoard, readOptions, controller.signal);

		/** The board around the marker, or `null` while the marker is detached. */
		function findBoard(): HTMLElement | null {
			return marker.closest<HTMLElement>('[data-slot="board"]');
		}
	}

	/** Stops listening, ending a drag in progress. */
	function detach(): void {
		controller?.abort();
		controller = undefined;
	}

	/** The latest options, read at each keyboard move. */
	function readOptions(): BoardDragOptions {
		return options;
	}

	handle.addEventListener("insert", attach);
	handle.addEventListener("remove", detach);

	return (next) => {
		options = next ?? {};
	};
});

/**
 * Listens for presses on one board until `signal` aborts. The board is looked up from the
 * marker on each press, so a marker inserted before its board is attached still finds it.
 *
 * @param findBoard Returns the board's root, or `null` while the marker is detached.
 * @param readOptions Returns the mixin's latest options.
 * @param signal Ends every listener, a drag in progress included.
 */
function connect(
	findBoard: () => HTMLElement | null,
	readOptions: () => BoardDragOptions,
	signal: AbortSignal,
): void {
	let press: (Press & { board: HTMLElement }) | undefined;

	/**
	 * Ends the press: clears every drag mark, then saves the move when the card was dropped
	 * somewhere new, or puts a placed card back where it started.
	 */
	function end(drop: boolean): void {
		if (!press) return;
		let { board, card, from, ghost, target, origin, positioned } = press;
		press = undefined;
		ghost?.remove();
		card.removeAttribute(BOARD_DRAGGING_ATTRIBUTE);
		board.removeAttribute("data-board-active");
		for (let column of board.querySelectorAll(`[${BOARD_DROP_TARGET_ATTRIBUTE}]`)) {
			column.removeAttribute(BOARD_DROP_TARGET_ATTRIBUTE);
		}
		if (!ghost) return;
		suppressNextClick(card);
		if (!positioned) {
			if (drop && target && target !== from) move(card, from, target, firstCard(target, card));
			return;
		}
		let to = card.closest<HTMLElement>(`[${BOARD_COLUMN_ATTRIBUTE}]`);
		let moved = card.parentNode !== origin.parent || card.nextSibling !== origin.next;
		if (drop && to && moved) {
			move(card, from, to, nextCard(card));
			return;
		}
		origin.parent?.insertBefore(card, origin.next);
	}

	/** Records a mouse or pen press on a card, outside the card's own controls. */
	function onPointerDown(event: PointerEvent): void {
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
			origin: { parent: card.parentNode, next: card.nextSibling },
			positioned: moveForm(card)?.hasAttribute(BOARD_MOVE_POSITION_ATTRIBUTE) ?? false,
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			offsetX: event.clientX - rect.left,
			offsetY: event.clientY - rect.top,
		};
	}

	/** Lifts the card past the threshold, then carries the ghost and rings the column under it. */
	function onPointerMove(event: PointerEvent): void {
		if (!press || event.pointerId !== press.pointerId) return;
		if (!press.ghost) {
			let distance = Math.hypot(event.clientX - press.x, event.clientY - press.y);
			if (distance < DRAG_THRESHOLD_PX) return;
			press.ghost = lift(press.card);
			press.card.setAttribute(BOARD_DRAGGING_ATTRIBUTE, "");
			press.board.setAttribute("data-board-active", "");
		}
		event.preventDefault();
		let tilt = prefersReducedMotion() ? "" : " rotate(1.5deg)";
		press.ghost.style.transform = `translate(${event.clientX - press.offsetX}px, ${event.clientY - press.offsetY}px)${tilt}`;
		let under = document.elementFromPoint(event.clientX, event.clientY);
		let target = under?.closest<HTMLElement>(`[${BOARD_COLUMN_ATTRIBUTE}]`) ?? null;
		if (target && !press.board.contains(target)) target = null;
		if (target !== press.target) {
			press.target?.removeAttribute(BOARD_DROP_TARGET_ATTRIBUTE);
			if (target && target !== press.from) target.setAttribute(BOARD_DROP_TARGET_ATTRIBUTE, "");
			press.target = target;
		}
		if (press.positioned && target) place(press.card, target, event.clientY);
		scrollNearEdge(press.board, event.clientX);
	}

	/** Drops the card where the pointer let go. */
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

	/**
	 * Moves the focused card on Shift+Arrow: left and right to the top of the next column over,
	 * and, on a board that places positions, up and down past its neighbour in the column.
	 */
	function onMoveKey(event: KeyboardEvent): void {
		if (!event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
		if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
		let board = findBoard();
		let focused = document.activeElement;
		let card = focused?.closest<HTMLElement>(`[${BOARD_CARD_ATTRIBUTE}]`);
		let from = card?.closest<HTMLElement>(`[${BOARD_COLUMN_ATTRIBUTE}]`);
		if (!board || !card || !from || !board.contains(card)) return;
		if (focused?.matches("input, textarea, select, [contenteditable]")) return;
		let target = keyTarget(board, card, from, event.key);
		if (!target) return;
		event.preventDefault();
		move(card, from, target.column, target.before);
		if (focused instanceof HTMLElement) focused.focus({ preventScroll: false });
		announce(board, target.column, readOptions().moved);
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
	card.addEventListener("click", swallow, { capture: true, once: true });
	setTimeout(release, 0);

	/** Keeps the click from following the card's link. */
	function swallow(event: Event): void {
		event.preventDefault();
		event.stopPropagation();
	}

	/** Lets later clicks through once the release's own click has passed. */
	function release(): void {
		card.removeEventListener("click", swallow, { capture: true });
	}
}

/**
 * Puts the card in the target column before `before` (last when `null`) at once, bumps both
 * counts when it changed column, then posts the card's move form with the column's value and,
 * when the form takes one, the position, unless a listener prevented the move event.
 */
function move(
	card: HTMLElement,
	from: HTMLElement,
	to: HTMLElement,
	before: HTMLElement | null,
): void {
	let form = moveForm(card);
	let positioned = form?.hasAttribute(BOARD_MOVE_POSITION_ATTRIBUTE) ?? false;
	let event = new BoardMoveEvent({
		card: card.getAttribute(BOARD_CARD_ATTRIBUTE) ?? "",
		from: from.getAttribute(BOARD_COLUMN_ATTRIBUTE) ?? "",
		to: to.getAttribute(BOARD_COLUMN_ATTRIBUTE) ?? "",
		before: positioned ? (before?.getAttribute(BOARD_CARD_ATTRIBUTE) ?? null) : null,
	});
	if (!card.dispatchEvent(event)) return;

	to.querySelector('[data-slot="board-cards"]')?.insertBefore(card, before);
	if (from !== to) {
		bumpCount(from, -1);
		bumpCount(to, 1);
	}
	if (!prefersReducedMotion()) {
		card.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
	}

	let name = form?.getAttribute(BOARD_MOVE_FIELD_ATTRIBUTE);
	if (!form || !name) return;
	form.appendChild(hiddenInput(name, event.to));
	let position = form.getAttribute(BOARD_MOVE_POSITION_ATTRIBUTE);
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

/** The card's own move form, when it has one. */
function moveForm(card: HTMLElement): HTMLFormElement | null {
	let value = card.getAttribute(BOARD_CARD_ATTRIBUTE) ?? "";
	return document.querySelector<HTMLFormElement>(
		`form[${BOARD_MOVE_FORM_ATTRIBUTE}="${CSS.escape(value)}"]`,
	);
}

/** The cards of a column, in order, leaving `except` out. */
function cardsOf(column: HTMLElement, except?: HTMLElement): HTMLElement[] {
	return [
		...column.querySelectorAll<HTMLElement>(
			`[data-slot="board-cards"] > [${BOARD_CARD_ATTRIBUTE}]`,
		),
	].filter((card) => card !== except);
}

/** The column's first card other than `except`, before which a card lands at the top. */
function firstCard(column: HTMLElement, except: HTMLElement): HTMLElement | null {
	return cardsOf(column, except)[0] ?? null;
}

/** The card right after `card` in its column, or `null` when it is last. */
function nextCard(card: HTMLElement): HTMLElement | null {
	let next = card.nextElementSibling;
	while (next && !next.hasAttribute(BOARD_CARD_ATTRIBUTE)) next = next.nextElementSibling;
	return next instanceof HTMLElement ? next : null;
}

/** Moves the dragged card into `column` before the first card whose middle is below `y`. */
function place(card: HTMLElement, column: HTMLElement, y: number): void {
	let list = column.querySelector('[data-slot="board-cards"]');
	if (!list) return;
	let before =
		cardsOf(column, card).find((other) => {
			let rect = other.getBoundingClientRect();
			return y < rect.top + rect.height / 2;
		}) ?? null;
	if (card.parentNode === list && nextCard(card) === before) return;
	list.insertBefore(card, before);
}

/**
 * Where a Shift+Arrow key sends a card: the top of the column to either side, or past its
 * neighbour above or below when its form takes a position.
 */
function keyTarget(
	board: HTMLElement,
	card: HTMLElement,
	from: HTMLElement,
	key: string,
): { column: HTMLElement; before: HTMLElement | null } | null {
	if (key === "ArrowLeft" || key === "ArrowRight") {
		let columns = [...board.querySelectorAll<HTMLElement>(`[${BOARD_COLUMN_ATTRIBUTE}]`)];
		let column = columns[columns.indexOf(from) + (key === "ArrowLeft" ? -1 : 1)];
		return column ? { column, before: firstCard(column, card) } : null;
	}
	if (!moveForm(card)?.hasAttribute(BOARD_MOVE_POSITION_ATTRIBUTE)) return null;
	let cards = cardsOf(from);
	let index = cards.indexOf(card);
	if (key === "ArrowUp") {
		return index > 0 ? { column: from, before: cards[index - 1]! } : null;
	}
	if (index === cards.length - 1) return null;
	return { column: from, before: cards[index + 2] ?? null };
}

/** Says where a keyboard move put the card, through the board's own live region. */
function announce(board: HTMLElement, column: HTMLElement, template: string | undefined): void {
	let region = board.querySelector('[data-slot="board-status"]');
	if (!region || template === undefined) return;
	let title = column.querySelector("h3")?.textContent ?? "";
	region.textContent = template.replace("{column}", title);
}

/** Adds `delta` to a column's count, when the column shows one. */
function bumpCount(column: HTMLElement, delta: number): void {
	let count = column.querySelector('[data-slot="board-count"]');
	let value = Number(count?.textContent);
	if (count && Number.isFinite(value)) count.textContent = String(Math.max(0, value + delta));
}
