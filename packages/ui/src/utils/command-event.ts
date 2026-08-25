/**
 * The escape-hatch cast every mixin answering an Invoker Commands `command`
 * event repeats on its own: `on()` types a `"command"` handler's event as a
 * plain DOM `Event`, since `CommandEvent` isn't part of the standard
 * `HTMLElementEventMap` yet, so reading `command` or `source` off it needs a
 * cast past that generic type first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Narrows an `on("command", ...)` handler's event to `CommandEvent`, so the
 * `as unknown as CommandEvent` cast a command-answering mixin would
 * otherwise repeat lives in one reviewable place.
 *
 * @param event The event received by an `on("command", ...)` handler.
 * @returns The same event, narrowed to `CommandEvent`.
 * @example
 * on<HTMLElement, "command">("command", (event) => {
 * 	let commandEvent = asCommandEvent(event);
 * 	if (commandEvent.command !== TOGGLE_COMMAND) return;
 * });
 */
export function asCommandEvent(event: Event): CommandEvent {
	return event as unknown as CommandEvent;
}
