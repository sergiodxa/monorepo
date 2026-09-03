/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * The standard `touch-action` keywords. The `(string & {})` member keeps the
 * type a plain string, so space-separated `pan-*` combinations such as
 * `"pan-x pan-y"` stay valid.
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
 * drag handle or gesture surface that handles its own touch input.
 *
 * @example u.touchAction()
 * @example css({ touchAction: "none" })
 * @example u.touchAction("manipulation")
 * @example css({ touchAction: "manipulation" })
 */
export function touchAction<Node extends Element = Element>(value: TouchActionValue = "none") {
	return utility<Node>(() => ({ touchAction: value }));
}
