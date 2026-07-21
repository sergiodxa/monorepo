/**
 * Press-and-hold repeat for a NumberField group's increment/decrement
 * buttons: wires each button's custom `--step-up`/`--step-down` Invoker
 * Command to the field's native `stepUp()`/`stepDown()` methods, then keeps
 * calling the same method on an interval for as long as the button stays
 * pressed.
 *
 * Why JS: `stepUp()` and `stepDown()` are script-only methods with no
 * declarative HTML equivalent yet, and holding a pointer down to repeat an
 * action has no native repeat semantics on `<button>` at all.
 * No-JS baseline: the number input keeps its own native spinner arrows and
 * `ArrowUp`/`ArrowDown` keyboard stepping; only the group's external
 * increment/decrement buttons and their hold-to-repeat go silent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import { asCommandEvent } from "../utils/command-event";

/**
 * Direction a single step moves a NumberField's value: `"increment"` raises
 * it, `"decrement"` lowers it.
 */
export type NumberFieldStepDirection = "increment" | "decrement";

/**
 * Custom Invoker Command an increment button declares (`command="--step-up"`
 * `commandfor` pointing at the group's number input), read back by
 * `stepper()` to call `stepUp()` on the matching input.
 */
export const NUMBER_FIELD_STEP_UP_COMMAND = "--step-up";

/**
 * Custom Invoker Command a decrement button declares (`command="--step-down"`
 * `commandfor` pointing at the group's number input), read back by
 * `stepper()` to call `stepDown()` on the matching input.
 */
export const NUMBER_FIELD_STEP_DOWN_COMMAND = "--step-down";

/**
 * Event type `stepper()` dispatches on the number input after every
 * completed step, whether triggered by a single activation or by one tick of
 * hold-to-repeat.
 */
export const NUMBER_FIELD_STEP_EVENT = "ui:number-field-step" as const;

declare global {
	interface HTMLElementEventMap {
		[NUMBER_FIELD_STEP_EVENT]: NumberFieldStepEvent;
	}
}

/**
 * Dispatched on the number input immediately after `stepper()` applies a
 * step. Carries the direction and the freshly stepped value so a consumer
 * can react to the change without diffing two `input`/`change` events
 * against the previous value itself.
 */
export class NumberFieldStepEvent extends Event {
	/** Which direction the value just moved. */
	readonly direction: NumberFieldStepDirection;

	/** The input's `valueAsNumber` immediately after the step. */
	readonly value: number;

	/**
	 * @param direction Which direction the value just moved.
	 * @param value The input's `valueAsNumber` immediately after the step.
	 */
	constructor(direction: NumberFieldStepDirection, value: number) {
		super(NUMBER_FIELD_STEP_EVENT, { bubbles: true });
		this.direction = direction;
		this.value = value;
	}
}

/** Milliseconds a step button must stay pressed before hold-repeat begins. */
const DEFAULT_HOLD_DELAY_MS = 400;

/** Milliseconds between repeated steps once hold-repeat has begun. */
const DEFAULT_HOLD_INTERVAL_MS = 60;

/**
 * Options accepted by {@link stepper} to tune its hold-to-repeat timing.
 */
export interface StepperOptions {
	/** Milliseconds a step button must stay pressed before hold-repeat begins. Defaults to {@link DEFAULT_HOLD_DELAY_MS}. */
	holdDelayMs?: number;
	/** Milliseconds between repeated steps once hold-repeat has begun. Defaults to {@link DEFAULT_HOLD_INTERVAL_MS}. */
	holdIntervalMs?: number;
}

/**
 * Resolves which direction a step button's own custom command names,
 * returning `undefined` for any command string that isn't one of the two
 * `stepper()` recognizes (so a group holding unrelated Invoker Command
 * buttons is left alone).
 *
 * @param command The `command` attribute value read off a button, or a
 * dispatched `CommandEvent`'s `command` property.
 */
function directionForCommand(command: string | null): NumberFieldStepDirection | undefined {
	if (command === NUMBER_FIELD_STEP_UP_COMMAND) return "increment";
	if (command === NUMBER_FIELD_STEP_DOWN_COMMAND) return "decrement";
	return undefined;
}

/**
 * Finds the number input a step button's `commandfor` targets, preferring
 * the live `commandForElement` reference and falling back to an
 * `id` lookup for runtimes that parse the `commandfor` attribute without yet
 * reflecting the IDL property.
 *
 * @param button A step button found inside the group.
 */
function resolveStepTarget(button: HTMLButtonElement): HTMLInputElement | undefined {
	if (button.commandForElement instanceof HTMLInputElement) return button.commandForElement;

	let commandForId = button.getAttribute("commandfor");
	if (!commandForId) return undefined;

	let fallbackTarget = document.getElementById(commandForId);
	return fallbackTarget instanceof HTMLInputElement ? fallbackTarget : undefined;
}

/**
 * Steps a number input one unit in the given direction using its native
 * `stepUp()`/`stepDown()` method, then dispatches the `input`, `change`, and
 * {@link NumberFieldStepEvent} events those methods don't fire on their own.
 * Does nothing — and reports no step taken — when the input is disabled,
 * read-only, or already at the boundary the direction would cross.
 *
 * @param input The number input to step.
 * @param direction Which direction to step it.
 * @returns Whether the value actually changed.
 */
function applyStep(input: HTMLInputElement, direction: NumberFieldStepDirection): boolean {
	if (input.disabled || input.readOnly) return false;

	let previousValue = input.value;
	try {
		if (direction === "increment") input.stepUp();
		else input.stepDown();
	} catch {
		return false;
	}

	if (input.value === previousValue) return false;

	input.dispatchEvent(new Event("input", { bubbles: true }));
	input.dispatchEvent(new Event("change", { bubbles: true }));
	input.dispatchEvent(new NumberFieldStepEvent(direction, input.valueAsNumber));
	return true;
}

/**
 * Adds press-and-hold repeat to a NumberField group's increment/decrement
 * buttons. Each button declares its own step as a custom Invoker Command —
 * `command={NUMBER_FIELD_STEP_UP_COMMAND}` or
 * `command={NUMBER_FIELD_STEP_DOWN_COMMAND}` with `commandfor` pointing at
 * the group's number input — and `stepper()` reads that same command string
 * back to know which direction to step, so the group needs no separate
 * data attribute to coordinate its parts.
 *
 * A single activation (click, or `Enter`/`Space` while a button is focused)
 * steps once through the native `command` event. Holding a button down with
 * a pointer starts a delay timer; once it elapses, the input steps
 * repeatedly on an interval for as long as the button stays pressed, and the
 * trailing click that follows release is absorbed so it doesn't add one
 * extra step on top of the repeat.
 *
 * @param options Hold-to-repeat timing overrides.
 * @example
 * <div role="group" mix={[stepper()]}>
 * 	<button type="button" command={NUMBER_FIELD_STEP_DOWN_COMMAND} commandfor="quantity" aria-label={decrementLabel}>
 * 		<MinusIcon />
 * 	</button>
 * 	<input id="quantity" type="number" min={0} max={99} defaultValue={1} />
 * 	<button type="button" command={NUMBER_FIELD_STEP_UP_COMMAND} commandfor="quantity" aria-label={incrementLabel}>
 * 		<PlusIcon />
 * 	</button>
 * </div>
 */
export const stepper = createMixin<HTMLElement, [options?: StepperOptions]>((handle) => {
	let holdDelayMs = DEFAULT_HOLD_DELAY_MS;
	let holdIntervalMs = DEFAULT_HOLD_INTERVAL_MS;

	let holdDelayTimerId = 0;
	let holdRepeatTimerId = 0;
	let repeatFiredForGesture = false;

	/** Cancels any pending delay or in-progress repeat timer for the current press. */
	function clearHoldTimers(): void {
		window.clearTimeout(holdDelayTimerId);
		window.clearInterval(holdRepeatTimerId);
		holdDelayTimerId = 0;
		holdRepeatTimerId = 0;
	}

	handle.signal.addEventListener("abort", clearHoldTimers);

	return (options) => {
		holdDelayMs = options?.holdDelayMs ?? DEFAULT_HOLD_DELAY_MS;
		holdIntervalMs = options?.holdIntervalMs ?? DEFAULT_HOLD_INTERVAL_MS;

		return createElement(handle.element, {
			mix: [
				on<HTMLElement, "pointerdown">("pointerdown", (event) => {
					if (!(event.target instanceof Element)) return;

					let button = event.target.closest("button[command]");
					if (!(button instanceof HTMLButtonElement)) return;

					let direction = directionForCommand(button.getAttribute("command"));
					if (!direction) return;

					let input = resolveStepTarget(button);
					if (!input) return;

					clearHoldTimers();
					repeatFiredForGesture = false;

					holdDelayTimerId = window.setTimeout(() => {
						repeatFiredForGesture = applyStep(input, direction) || repeatFiredForGesture;
						holdRepeatTimerId = window.setInterval(() => {
							let stepped = applyStep(input, direction);
							repeatFiredForGesture = repeatFiredForGesture || stepped;
							if (!stepped) clearHoldTimers();
						}, holdIntervalMs);
					}, holdDelayMs);
				}),
				on<HTMLElement, "pointerup">("pointerup", clearHoldTimers),
				on<HTMLElement, "pointercancel">("pointercancel", clearHoldTimers),
				on<HTMLElement, "command">(
					"command",
					(event) => {
						let commandEvent = asCommandEvent(event);
						let direction = directionForCommand(commandEvent.command);
						if (!direction) return;

						// A completed hold-repeat gesture already applied its steps;
						// swallow the trailing click's own command so it doesn't add
						// one more on top of what the repeat already did.
						if (repeatFiredForGesture) {
							repeatFiredForGesture = false;
							return;
						}

						if (!(commandEvent.target instanceof HTMLInputElement)) return;
						applyStep(commandEvent.target, direction);
					},
					true,
				),
			],
		});
	};
});
