/**
 * Headless drag-and-drop session: owns the item being dragged, the drop
 * candidate currently under the pointer, and the position of the pending
 * drop computed against it, independent of pointer input and independent of
 * rendering. Backs list reordering, a file drop zone, and a drop indicator
 * alike, each reading the same instance instead of tracking drag state on
 * their own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypedEventTarget } from "remix/ui";

import { dispatchChange } from "../utils/dispatch-change";

/**
 * Types associated with {@link DragSession}: the dragged item, the drop
 * candidate it tracks, and the event it dispatches.
 */
export namespace DragSession {
	/**
	 * Position of a pending drop relative to its current target. `"before"`
	 * and `"after"` insert the dragged item next to the target, for
	 * reordering a list; `"on"` drops onto the target itself, for nesting an
	 * item inside it or accepting a drop onto a drop zone.
	 */
	export type Position = "before" | "after" | "on";

	/**
	 * Item that starts a drag session: a stable key identifying it, plus an
	 * optional consumer-defined payload carried for the life of the session
	 * and read back when the drop commits.
	 *
	 * @template TData Shape of the optional payload.
	 */
	export interface Source<TData = unknown> {
		/** Stable identifier for the dragged item. */
		key: string;
		/** Consumer-defined payload carried for the life of the session. */
		data?: TData;
	}

	/**
	 * Drop candidate currently under the pointer: the target's key and the
	 * position computed against it.
	 */
	export interface Target {
		/** Stable identifier for the candidate drop target. */
		key: string;
		/** Position of the pending drop relative to this target. */
		position: Position;
	}

	/**
	 * Snapshot returned when a drag session ends in a committed drop.
	 *
	 * @template TData Shape of the source's optional payload.
	 */
	export interface DropDetail<TData = unknown> {
		/** Item that was dragged. */
		source: Source<TData>;
		/** Target the item was dropped on. */
		target: Target;
	}

	/** Events dispatched by {@link DragSession} as its state changes. */
	export interface EventMap {
		/** Dispatched after the drag source, the current target, or its position changes. */
		change: Event;
	}
}

/**
 * Owns one drag-and-drop interaction: the item being dragged, the drop
 * candidate currently under the pointer, and the position computed against
 * it. Every mutating method dispatches a plain `"change"` event, so a
 * pointer- or keyboard-driven mixin can subscribe once and keep the reorder
 * list, drop zone, or drop indicator it drives in sync, without any of them
 * tracking drag state independently.
 *
 * @template TData Shape of the optional payload carried by the drag source.
 * @example
 * let session = new DragSession<{ index: number }>();
 * session.addEventListener("change", () => update());
 * session.start({ key: "row-1", data: { index: 0 } });
 * session.moveOver({ key: "row-3", position: "after" });
 * session.drop();
 */
export class DragSession<TData = unknown> extends TypedEventTarget<DragSession.EventMap> {
	#source: DragSession.Source<TData> | null = null;
	#target: DragSession.Target | null = null;

	/** Item currently being dragged, or `null` when no session is active. */
	get source(): DragSession.Source<TData> | null {
		return this.#source;
	}

	/**
	 * Drop candidate currently under the pointer, or `null` when the session
	 * isn't active or the pointer isn't over a valid target.
	 */
	get target(): DragSession.Target | null {
		return this.#target;
	}

	/** Whether a drag session is currently in progress. */
	get active(): boolean {
		return this.#source !== null;
	}

	/**
	 * Begins a drag session for the given item, implicitly ending any
	 * session already in progress first. Always dispatches `"change"`.
	 *
	 * @param source Item that begins the drag session.
	 */
	start(source: DragSession.Source<TData>): void {
		this.#source = source;
		this.#target = null;
		dispatchChange(this);
	}

	/**
	 * Records the drop candidate currently under the pointer. A no-op
	 * outside an active session and when the candidate's key and position
	 * are unchanged from the last call, so a drop indicator only repositions
	 * on actual movement.
	 *
	 * @param target Drop candidate under the pointer.
	 */
	moveOver(target: DragSession.Target): void {
		if (!this.active) return;
		if (this.#target?.key === target.key && this.#target?.position === target.position) return;

		this.#target = target;
		dispatchChange(this);
	}

	/**
	 * Clears the current drop candidate without ending the session, e.g.
	 * when the pointer moves off every valid target while still dragging. A
	 * no-op when there is no target currently set.
	 */
	clearTarget(): void {
		if (this.#target === null) return;

		this.#target = null;
		dispatchChange(this);
	}

	/**
	 * Commits a drop at the current target and ends the session. Returns
	 * `null` without dispatching anything when there is no active session or
	 * no current target to drop onto.
	 *
	 * @returns The dragged item and the target it was dropped on, or `null` when there was nothing to drop.
	 */
	drop(): DragSession.DropDetail<TData> | null {
		if (!this.#source || !this.#target) return null;

		let detail: DragSession.DropDetail<TData> = { source: this.#source, target: this.#target };
		this.#reset();
		return detail;
	}

	/**
	 * Ends the current session without committing a drop, e.g. on Escape or
	 * a pointer release outside every valid target. A no-op when no session
	 * is active.
	 */
	cancel(): void {
		if (!this.active) return;
		this.#reset();
	}

	/** Clears the source and target and dispatches the plain `"change"` event. */
	#reset(): void {
		this.#source = null;
		this.#target = null;
		dispatchChange(this);
	}
}
