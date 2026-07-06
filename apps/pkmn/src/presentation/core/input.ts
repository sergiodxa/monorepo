/**
 * Device-agnostic input layer for the presentation.
 *
 * Keyboard and gamepad both feed a single logical `Button` state so scenes read
 * intent (`isPressed(Button.A)`) instead of raw DOM or pad events. Each fixed
 * update calls `poll()` once to merge every source and compute press/release
 * edges, letting scenes distinguish a tap this frame from a held button. This
 * module is the only place in the app that listens to hardware input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { FIXED_STEP_MS } from "./loop";

/** Logical buttons every scene reads, independent of the physical device. */
export enum Button {
	Up,
	Down,
	Left,
	Right,
	A,
	B,
	Start,
	Select,
	L,
	R,
}

/** Maps `KeyboardEvent.code` values onto logical buttons. */
const KEY_BINDINGS: Record<string, Button> = {
	ArrowUp: Button.Up,
	ArrowDown: Button.Down,
	ArrowLeft: Button.Left,
	ArrowRight: Button.Right,
	KeyW: Button.Up,
	KeyS: Button.Down,
	KeyA: Button.Left,
	KeyD: Button.Right,
	KeyZ: Button.A,
	Enter: Button.A, // confirm / interact
	KeyX: Button.B,
	Escape: Button.B, // cancel / run
	ShiftLeft: Button.Select,
	KeyM: Button.Start,
};

/** Maps standard-gamepad button indices onto logical buttons. */
const PAD_BINDINGS: Record<number, Button> = {
	12: Button.Up,
	13: Button.Down,
	14: Button.Left,
	15: Button.Right,
	0: Button.A,
	1: Button.B,
	9: Button.Start,
	8: Button.Select,
	4: Button.L,
	5: Button.R,
};

/** Merges keyboard and gamepad state into one logical button model with edges. */
export class InputManager {
	/** Buttons currently held after the latest poll. */
	private held = new Set<Button>();

	/** Buttons that transitioned to held this poll, cleared every poll. */
	private pressed = new Set<Button>();

	/** Buttons that transitioned to released this poll, cleared every poll. */
	private released = new Set<Button>();

	/** Keyboard-only held state, updated by DOM listeners between polls. */
	private keyboardHeld = new Set<Button>();

	/** Per-button held duration in milliseconds, used by `isRepeating`. */
	private heldMs = new Map<Button, number>();

	/** Whether any input has been received, used to unlock audio on first gesture. */
	private sawInput = false;

	/** Attaches keyboard listeners to the given window. */
	attach(target: Window) {
		target.addEventListener("keydown", (event) => {
			let button = KEY_BINDINGS[event.code];
			if (button === undefined || event.repeat) return;
			event.preventDefault();
			this.keyboardHeld.add(button);
		});
		target.addEventListener("keyup", (event) => {
			let button = KEY_BINDINGS[event.code];
			if (button !== undefined) this.keyboardHeld.delete(button);
		});
		target.addEventListener("blur", () => this.keyboardHeld.clear());
	}

	/** Merges keyboard and gamepad state, computes edges, and advances hold timers. */
	poll() {
		let next = new Set(this.keyboardHeld);
		for (let pad of navigator.getGamepads?.() ?? []) {
			if (!pad) continue;
			for (let [index, button] of Object.entries(PAD_BINDINGS)) {
				if (pad.buttons[Number(index)]?.pressed) next.add(button);
			}
			if (pad.axes[0]! < -0.5) next.add(Button.Left);
			if (pad.axes[0]! > 0.5) next.add(Button.Right);
			if (pad.axes[1]! < -0.5) next.add(Button.Up);
			if (pad.axes[1]! > 0.5) next.add(Button.Down);
		}

		this.pressed.clear();
		this.released.clear();
		for (let button of next) if (!this.held.has(button)) this.pressed.add(button);
		for (let button of this.held) if (!next.has(button)) this.released.add(button);

		for (let button of next) {
			this.heldMs.set(
				button,
				(this.held.has(button) ? (this.heldMs.get(button) ?? 0) : 0) + FIXED_STEP_MS,
			);
		}
		for (let button of this.heldMs.keys()) if (!next.has(button)) this.heldMs.delete(button);

		this.held = next;
		if (this.pressed.size > 0) this.sawInput = true;
	}

	/** True while the button is down. */
	isHeld(button: Button): boolean {
		return this.held.has(button);
	}

	/** True only on the fixed step the button went down. */
	isPressed(button: Button): boolean {
		return this.pressed.has(button);
	}

	/** True only on the fixed step the button came up. */
	isReleased(button: Button): boolean {
		return this.released.has(button);
	}

	/** Menu-navigation helper: fires on press, then repeats after 250ms every 80ms. */
	isRepeating(button: Button): boolean {
		if (this.isPressed(button)) return true;
		let ms = this.heldMs.get(button);
		if (ms === undefined) return false;
		return ms > 250 && ms % 80 < FIXED_STEP_MS;
	}

	/** True once any button has been pressed, for the audio-unlock gesture check. */
	get hasInteracted(): boolean {
		return this.sawInput;
	}
}
