/**
 * Headless pointer-resize engine backing the `resizeHandle(axis)` mixin. Owns
 * the active pointer session for a resizable panel group and solves min/max
 * size constraints across every panel whenever the dragged boundary moves,
 * so the mixin only has to forward pointer coordinates and read back sizes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypedEventTarget } from "remix/ui";

const DEFAULT_PANEL_MIN_SIZE = 0;

const DEFAULT_PANEL_MAX_SIZE = 100;

/**
 * Types describing the panel group a `ResizeSession` operates over, and the
 * events it dispatches.
 */
export namespace ResizeSession {
	/**
	 * A panel as supplied to `start()`: its current size and, optionally, the
	 * size constraints the solver must respect. `size`, `min`, and `max` are
	 * all expressed as percentages of the panel group's main-axis size (0-100).
	 */
	export interface PanelInput {
		/** Stable identifier the consumer uses to map a resolved size back to its panel element. */
		id: string;
		/** Current size, as a percentage of the group's main-axis size. */
		size: number;
		/** Smallest percentage this panel may shrink to. Defaults to 0 when omitted. */
		min?: number;
		/** Largest percentage this panel may grow to. Defaults to 100 when omitted. */
		max?: number;
	}

	/**
	 * A panel's resolved state as read from an in-progress or finished session:
	 * `min` and `max` are always concrete, defaulted values.
	 */
	export interface Panel {
		/** Stable identifier, carried over unchanged from the matching `PanelInput`. */
		id: string;
		/** Current size, as a percentage of the group's main-axis size. */
		size: number;
		/** Smallest percentage this panel may shrink to. */
		min: number;
		/** Largest percentage this panel may grow to. */
		max: number;
	}

	/**
	 * Snapshot passed to `start()`: the panel group's layout and constraints at
	 * the moment a pointer session begins on one of its handles.
	 */
	export interface StartOptions {
		/** Index of the handle being dragged; it sits between `panels[handleIndex]` and `panels[handleIndex + 1]`. */
		handleIndex: number;
		/** Every panel in the group, in visual order along the resize axis. */
		panels: readonly PanelInput[];
		/** Pointer coordinate along the resize axis (`clientX` for a horizontal group, `clientY` for a vertical one) at pointer-down. */
		pointerPosition: number;
		/** Size, in pixels, of the panel group measured along the resize axis — used to convert pixel pointer deltas into percentage units. */
		groupSize: number;
	}

	/** Events a `ResizeSession` dispatches; read the `panels` getter for the state behind each one. */
	export interface Events {
		/** Dispatched whenever constraint solving produces new panel sizes, from a pointer move or a cancelled session reverting. */
		change: Event;
		/** Dispatched once a session concludes, whether by `end()` or `cancel()`. */
		end: Event;
	}
}

/**
 * Owns one resizable panel group's active pointer session. `move()` re-solves
 * every panel's size from the constraints captured at `start()`, cascading
 * into further panels so a drag only takes what the group can give up.
 */
export class ResizeSession extends TypedEventTarget<ResizeSession.Events> {
	#panels: ResizeSession.Panel[] = [];
	#startPanels: ResizeSession.Panel[] = [];
	#handleIndex = -1;
	#pointerStart = 0;
	#groupSize = 0;
	#active = false;

	/** Whether a pointer session is in progress between `start()` and `end()`. */
	get isActive(): boolean {
		return this.#active;
	}

	/**
	 * Index of the handle being dragged in the active session, or `null` when no session is active.
	 */
	get activeHandleIndex(): number | null {
		return this.#active ? this.#handleIndex : null;
	}

	/**
	 * Every panel's current resolved size and constraints, in group order.
	 * Returns a defensive copy on every read, so mutating the result never
	 * affects the session's own state.
	 */
	get panels(): readonly ResizeSession.Panel[] {
		return this.#panels.map((panel) => ({ ...panel }));
	}

	/**
	 * Begins a pointer session on one handle of a panel group, capturing the
	 * panels' sizes and constraints as the baseline every subsequent `move()`
	 * in this session solves from.
	 *
	 * @param options Panel group snapshot and pointer-down position the session starts from.
	 * @throws {Error} When a session is already active; call `end()` or `cancel()` first.
	 * @throws {RangeError} When `panels` has fewer than two entries, or `handleIndex` has no adjacent panel pair.
	 */
	start(options: ResizeSession.StartOptions): void {
		if (this.#active) {
			throw new Error(
				"ResizeSession.start() was called while a session is already active; call end() or cancel() before starting another one.",
			);
		}

		let { handleIndex, panels, pointerPosition, groupSize } = options;

		if (panels.length < 2) {
			throw new RangeError(
				`ResizeSession requires at least two panels to resize between, received ${panels.length}.`,
			);
		}

		if (handleIndex < 0 || handleIndex > panels.length - 2) {
			throw new RangeError(
				`handleIndex ${handleIndex} has no adjacent panel pair in a group of ${panels.length} panels.`,
			);
		}

		this.#startPanels = panels.map((panel) => ({
			id: panel.id,
			size: panel.size,
			min: panel.min ?? DEFAULT_PANEL_MIN_SIZE,
			max: panel.max ?? DEFAULT_PANEL_MAX_SIZE,
		}));
		this.#panels = this.#startPanels.map((panel) => ({ ...panel }));
		this.#handleIndex = handleIndex;
		this.#pointerStart = pointerPosition;
		this.#groupSize = groupSize;
		this.#active = true;
	}

	/**
	 * Re-solves every panel's size for the current pointer position and
	 * dispatches `change`. A no-op when no session is active, so a mixin can
	 * forward every `pointermove` without guarding on `isActive` itself.
	 *
	 * @param pointerPosition Current pointer coordinate along the resize axis.
	 */
	move(pointerPosition: number): void {
		if (!this.#active) return;

		let pixelDelta = pointerPosition - this.#pointerStart;
		let sizeDelta = this.#groupSize > 0 ? (pixelDelta / this.#groupSize) * 100 : 0;

		this.#panels = this.#solve(sizeDelta);
		this.dispatchEvent(new Event("change"));
	}

	/**
	 * Concludes the active session, keeping the panels at their last solved
	 * sizes, and dispatches `end`. A no-op when no session is active.
	 */
	end(): void {
		if (!this.#active) return;
		this.#active = false;
		this.dispatchEvent(new Event("end"));
	}

	/**
	 * Aborts the active session, reverting every panel to the size it had when
	 * `start()` was called, then dispatches `change` (for the reverted sizes)
	 * followed by `end`. A no-op when no session is active.
	 */
	cancel(): void {
		if (!this.#active) return;
		this.#panels = this.#startPanels.map((panel) => ({ ...panel }));
		this.#active = false;
		this.dispatchEvent(new Event("change"));
		this.dispatchEvent(new Event("end"));
	}

	/**
	 * Solves fresh from the session's baseline each call, keeping repeated
	 * moves free of accumulated rounding drift. Growth is drawn from the
	 * nearest panels across the handle, clamped by headroom and donor supply.
	 */
	#solve(delta: number): ResizeSession.Panel[] {
		let panels = this.#startPanels.map((panel) => ({ ...panel }));
		if (delta === 0) return panels;

		let handleIndex = this.#handleIndex;
		let growing = delta > 0;
		let growIndex = growing ? handleIndex : handleIndex + 1;

		let donorIndices: number[] = [];
		if (growing) {
			for (let index = handleIndex + 1; index < panels.length; index++) donorIndices.push(index);
		} else {
			for (let index = handleIndex; index >= 0; index--) donorIndices.push(index);
		}

		let growPanel = panels[growIndex];
		if (!growPanel) return panels;

		let growHeadroom = Math.max(growPanel.max - growPanel.size, 0);
		let totalDonorAvailable = donorIndices.reduce((sum, index) => {
			let panel = panels[index];
			return panel ? sum + Math.max(panel.size - panel.min, 0) : sum;
		}, 0);

		let applied = Math.min(Math.abs(delta), growHeadroom, totalDonorAvailable);
		growPanel.size += applied;

		let remaining = applied;
		for (let i = 0; i < donorIndices.length && remaining > 0; i++) {
			let donorIndex = donorIndices[i];
			let panel = donorIndex === undefined ? undefined : panels[donorIndex];
			if (!panel) continue;

			let available = Math.max(panel.size - panel.min, 0);
			let take = Math.min(available, remaining);
			panel.size -= take;
			remaining -= take;
		}

		return panels;
	}
}
