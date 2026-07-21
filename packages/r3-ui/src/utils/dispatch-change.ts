/**
 * Dispatches the plain `"change"` event a behavior class fires after a
 * state-mutating method runs, shared by every class under `behaviors/` that
 * announces its updates this way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Dispatches a plain `"change"` event on `target`, announcing a state update
 * to any subscriber.
 *
 * @param target Event target the `"change"` event is dispatched on.
 * @example
 * dispatchChange(this);
 */
export function dispatchChange(target: EventTarget): void {
	target.dispatchEvent(new Event("change"));
}
