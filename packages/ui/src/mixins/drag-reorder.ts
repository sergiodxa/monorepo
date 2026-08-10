/**
 * Pointer-driven reorder for a GridList or Tree row list: turns a pointer
 * press on a row's drag handle into a `DragSession`, tracks whichever row
 * the pointer currently sits over and the drop position computed against
 * it, mirrors that onto the hovered row as a `data-drop-position` attribute
 * its own drop-indicator styling reads, and dispatches `ui:reorder` once the
 * pointer releases over a valid target.
 *
 * Why JS: reordering rows by dragging one over another has no HTML
 * equivalent — the platform exposes no declarative way to turn a pointer
 * press/move/release gesture into a computed "before", "after", or "on"
 * relationship between two rows.
 * No-JS baseline: rows still render in server order and stay fully usable;
 * only the drag gesture is unavailable, so a list that needs to stay
 * reorderable without it keeps a server-rendered fallback (move-up/move-down
 * buttons submitting a form) alongside this mixin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { DragSession } from "../behaviors/drag-session";

/**
 * Attribute every reorderable row carries its stable identity on.
 * `dragReorder()` reads it to resolve which row the pointer is over and
 * writes {@link DRAG_REORDER_POSITION_ATTRIBUTE} and
 * {@link DRAG_REORDER_SOURCE_ATTRIBUTE} back onto the matching row; a
 * keyboard-navigation or selection mixin applied to the same rows shares
 * this attribute for its own row lookups.
 */
export const DRAG_REORDER_ROW_ATTRIBUTE = "data-key";

/**
 * Attribute a row's drag handle element carries. A pointer press only
 * starts a drag session when it originates on an element bearing this
 * attribute — never anywhere on the row — so a row's own interactive
 * content (an expand toggle, an inline action button) keeps its ordinary
 * pointer behavior untouched.
 */
export const DRAG_REORDER_HANDLE_ATTRIBUTE = "data-drag-handle";

/**
 * Attribute a row carries to opt into accepting an "on" drop — nesting the
 * dragged row inside it — on top of the "before"/"after" reorder positions
 * every row accepts. A Tree branch row carries it; a flat GridList row, or a
 * Tree leaf that can't hold children, omits it and only ever resolves to
 * "before"/"after".
 */
export const DRAG_REORDER_NESTABLE_ATTRIBUTE = "data-drop-nestable";

/**
 * Attribute `dragReorder()` writes on the row currently tracked as the drop
 * target, set to the current {@link DragSession.Position} ("before",
 * "after", or "on"). A row's own styles — or a drop-indicator part nested
 * inside it — read this attribute to render the pending drop in place.
 */
export const DRAG_REORDER_POSITION_ATTRIBUTE = "data-drop-position";

/**
 * Attribute `dragReorder()` sets on the row currently being dragged, for as
 * long as its session stays active, so its styles can fade or outline it
 * distinctly from the rest of the list.
 */
export const DRAG_REORDER_SOURCE_ATTRIBUTE = "data-drag-source";

/** DOM event type dispatched by {@link dragReorder} on its host once a drag session commits a drop. */
const REORDER_EVENT = "ui:reorder" as const;

declare global {
	interface HTMLElementEventMap {
		[REORDER_EVENT]: ReorderEvent;
	}
}

/**
 * Dispatched on a GridList or Tree's row-list host by {@link dragReorder}
 * once a drag session ends in a committed drop, carrying the dragged row's
 * key, the row it was dropped against, and the resolved position between
 * them — so a consumer can move the underlying data and re-render without
 * reading the `DragSession` instance itself.
 */
export class ReorderEvent extends Event {
	/** Key of the row that was dragged. */
	readonly sourceKey: string;
	/** Key of the row the dragged row was dropped against. */
	readonly targetKey: string;
	/** Position of the drop relative to the target row. */
	readonly position: DragSession.Position;

	/**
	 * @param init Settled source, target, and position the drop resolved to.
	 */
	constructor(init: { sourceKey: string; targetKey: string; position: DragSession.Position }) {
		super(REORDER_EVENT, { bubbles: true });
		this.sourceKey = init.sourceKey;
		this.targetKey = init.targetKey;
		this.position = init.position;
	}
}

/**
 * Finds the nearest reorderable row — identified by
 * {@link DRAG_REORDER_ROW_ATTRIBUTE} — containing `node`, scoped to rows
 * that fall inside `host` so a pointer that has strayed outside the list
 * entirely never resolves to a stale row from elsewhere on the page.
 *
 * @param host Row-list host the mixin is applied to.
 * @param node Candidate element to search upward from.
 * @returns The matched row, or `null` when `node` isn't inside a row of `host`.
 */
function findRow(host: HTMLElement, node: Element | null): HTMLElement | null {
	let row = node?.closest<HTMLElement>(`[${DRAG_REORDER_ROW_ATTRIBUTE}]`) ?? null;
	if (row === null || !host.contains(row)) return null;
	return row;
}

/**
 * Resolves the drop position a pointer at `clientY` implies against `row`:
 * a plain vertical midpoint split into "before"/"after" for a row that
 * doesn't carry {@link DRAG_REORDER_NESTABLE_ATTRIBUTE}, or a thirds split
 * adding a middle "on" band for a row that does.
 *
 * @param row Row currently under the pointer.
 * @param clientY Pointer's vertical viewport position.
 * @returns The resolved position of the pending drop relative to `row`.
 */
function resolveDropPosition(row: HTMLElement, clientY: number): DragSession.Position {
	let rect = row.getBoundingClientRect();
	let fraction = rect.height === 0 ? 0.5 : (clientY - rect.top) / rect.height;

	if (row.hasAttribute(DRAG_REORDER_NESTABLE_ATTRIBUTE)) {
		if (fraction < 1 / 3) return "before";
		if (fraction > 2 / 3) return "after";
		return "on";
	}

	return fraction < 0.5 ? "before" : "after";
}

/**
 * Adds pointer-driven reorder to a GridList or Tree's row-list host. A
 * pointer press on any element carrying {@link DRAG_REORDER_HANDLE_ATTRIBUTE}
 * starts `session` on the enclosing row (identified by
 * {@link DRAG_REORDER_ROW_ATTRIBUTE}); dragging over another row computes
 * "before", "after", or "on" from the pointer's position within it (see
 * {@link DRAG_REORDER_NESTABLE_ATTRIBUTE}) and records it on `session`;
 * releasing the pointer commits the drop and dispatches {@link ReorderEvent}
 * on the host. `Escape` or a `pointercancel` ends the session without
 * committing.
 *
 * Every `session` `"change"` re-scans the host's rows and mirrors the
 * current source and target onto them as
 * {@link DRAG_REORDER_SOURCE_ATTRIBUTE} and
 * {@link DRAG_REORDER_POSITION_ATTRIBUTE}, so a row's own styles — or a drop
 * indicator nested inside it — render purely from those attributes instead
 * of any component reading `session` directly.
 *
 * @param session Drag session already constructed by the consumer, shared
 * with any drop zone or drop indicator observing the same drag.
 * @example
 * let session = new DragSession();
 * <ul mix={[dragReorder(session)]} on={{ "ui:reorder": (event) => moveRow(event.sourceKey, event.targetKey, event.position) }}>
 *   {rows.map((row) => (
 *     <li key={row.id} data-key={row.id}>
 *       <button data-drag-handle aria-label={row.dragHandleLabel}>::</button>
 *       {row.label}
 *     </li>
 *   ))}
 * </ul>
 */
export const dragReorder = createMixin<HTMLElement, [session: DragSession]>((handle) => {
	let hostNode: HTMLElement | undefined;
	let boundSession: DragSession | undefined;
	let activePointerId: number | undefined;

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;
	});
	handle.addEventListener("remove", () => {
		hostNode = undefined;
	});

	/** Mirrors `session`'s current source and target onto the host's rows. */
	function syncRows(session: DragSession): void {
		if (!hostNode) return;

		let source = session.source;
		let target = session.target;
		let rows = hostNode.querySelectorAll<HTMLElement>(`[${DRAG_REORDER_ROW_ATTRIBUTE}]`);

		for (let row of rows) {
			let key = row.getAttribute(DRAG_REORDER_ROW_ATTRIBUTE);

			if (source !== null && key === source.key)
				row.setAttribute(DRAG_REORDER_SOURCE_ATTRIBUTE, "");
			else row.removeAttribute(DRAG_REORDER_SOURCE_ATTRIBUTE);

			if (target !== null && key === target.key) {
				row.setAttribute(DRAG_REORDER_POSITION_ATTRIBUTE, target.position);
			} else {
				row.removeAttribute(DRAG_REORDER_POSITION_ATTRIBUTE);
			}
		}
	}

	return (session) => {
		if (boundSession !== session) {
			boundSession = session;
			session.addEventListener("change", () => syncRows(session), { signal: handle.signal });
			handle.signal.addEventListener("abort", () => session.cancel());
		}

		return createElement(handle.element, {
			mix: [
				on<HTMLElement, "pointerdown">("pointerdown", (event) => {
					if (activePointerId !== undefined || !event.isPrimary || event.button !== 0) return;
					if (!hostNode || !(event.target instanceof Element)) return;

					let handleNode = event.target.closest(`[${DRAG_REORDER_HANDLE_ATTRIBUTE}]`);
					if (!handleNode || !hostNode.contains(handleNode)) return;

					let row = findRow(hostNode, handleNode);
					let key = row?.getAttribute(DRAG_REORDER_ROW_ATTRIBUTE) ?? null;
					if (row === null || key === null) return;

					activePointerId = event.pointerId;
					hostNode.setPointerCapture(event.pointerId);
					session.start({ key });
				}),
				on<HTMLElement, "pointermove">("pointermove", (event) => {
					if (!hostNode || !session.active || event.pointerId !== activePointerId) return;

					let hovered = document.elementFromPoint(event.clientX, event.clientY);
					let row = findRow(hostNode, hovered);
					let key = row?.getAttribute(DRAG_REORDER_ROW_ATTRIBUTE) ?? null;

					if (row === null || key === null || key === session.source?.key) {
						session.clearTarget();
						return;
					}

					session.moveOver({ key, position: resolveDropPosition(row, event.clientY) });
				}),
				on<HTMLElement, "pointerup">("pointerup", (event) => {
					if (event.pointerId !== activePointerId) return;
					activePointerId = undefined;

					let detail = session.drop();
					if (detail === null || !hostNode) return;

					hostNode.dispatchEvent(
						new ReorderEvent({
							sourceKey: detail.source.key,
							targetKey: detail.target.key,
							position: detail.target.position,
						}),
					);
				}),
				on<HTMLElement, "pointercancel">("pointercancel", (event) => {
					if (event.pointerId !== activePointerId) return;
					activePointerId = undefined;
					session.cancel();
				}),
				on<HTMLElement, "keydown">("keydown", (event) => {
					if (event.key !== "Escape" || !session.active) return;
					activePointerId = undefined;
					session.cancel();
				}),
			],
		});
	};
});
