/**
 * Pointer-driven reorder for a GridList or Tree row list: turns a pointer
 * press on a row's drag handle into a drag session, tracks the row under
 * the pointer and the computed drop position, and dispatches `ui:reorder`
 * once the pointer releases over a valid target.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { DragSession } from "../behaviors/drag-session";

/**
 * Attribute every reorderable row carries its stable identity on, read by
 * {@link dragReorder} to resolve the row under the pointer and shared by
 * other mixins on the same rows for their own row lookups.
 */
export const DRAG_REORDER_ROW_ATTRIBUTE = "data-rmx-key";

/**
 * Attribute a row's drag handle element carries; a drag session only
 * starts from a pointer press that originates on this attribute, so a
 * row's other interactive content keeps its ordinary pointer behavior.
 */
export const DRAG_REORDER_HANDLE_ATTRIBUTE = "data-drag-handle";

/**
 * Attribute a row carries to accept an "on" drop nesting the dragged row
 * inside it, on top of the "before"/"after" positions every row accepts;
 * a Tree branch row carries it, other rows resolve only to those two.
 */
export const DRAG_REORDER_NESTABLE_ATTRIBUTE = "data-drop-nestable";

/**
 * Attribute {@link dragReorder} writes on the row tracked as the drop
 * target, set to the current {@link DragSession.Position}, for a row's
 * own styles or a nested drop-indicator part to render the pending drop.
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
 * Dispatched on a row-list host by {@link dragReorder} once a drag session
 * commits a drop, carrying the dragged row's key, the target row's key,
 * and the resolved position, so a consumer can move data and re-render.
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
 * Finds the nearest reorderable row containing `node`, scoped to rows
 * inside `host` so a pointer that strays outside the list only ever
 * resolves against rows that belong to it.
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
 * a vertical midpoint split into "before"/"after", or, when `row` carries
 * {@link DRAG_REORDER_NESTABLE_ATTRIBUTE}, a thirds split adding "on".
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
 * Adds pointer-driven reorder to a row-list host: a press on a
 * {@link DRAG_REORDER_HANDLE_ATTRIBUTE} element starts `session` on its
 * row, and releasing over a valid target dispatches {@link ReorderEvent}.
 *
 * @param session Drag session already constructed by the consumer, shared
 * with any drop zone or drop indicator observing the same drag.
 * @example
 * let session = new DragSession();
 * <ul mix={[dragReorder(session)]} on={{ "ui:reorder": (event) => moveRow(event.sourceKey, event.targetKey, event.position) }}>
 *   {rows.map((row) => (
 *     <li key={row.id} data-rmx-key={row.id}>
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
