/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * The standard `touch-action` keywords. The `(string & {})` member keeps the
 * type a plain string for a space-separated combination of the `pan-*`
 * values (e.g. `"pan-x pan-y"`), which isn't a fixed keyword and so can't be
 * enumerated here.
 */
export type TouchActionValue =
	| "auto"
	| "none"
	| "pan-x"
	| "pan-y"
	| "pan-left"
	| "pan-right"
	| "pan-up"
	| "pan-down"
	| "pinch-zoom"
	| "manipulation"
	| (string & {});

/**
 * Applies `touch-action`. Defaults to `"none"`, the common case of a custom
 * drag handle or gesture surface that needs to handle its own touch input
 * instead of the browser's default panning/zooming.
 *
 * @example u.touchAction()
 * @example css({ touchAction: "none" })
 * @example u.touchAction("manipulation")
 * @example css({ touchAction: "manipulation" })
 */
export function touchAction<Node extends Element = Element>(value: TouchActionValue = "none") {
	return utility<Node>(() => ({ touchAction: value }));
}
