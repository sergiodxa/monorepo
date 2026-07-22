/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";
import { focusVisible } from "../state/focus-visible";

/**
 * Applies a focus ring. Composes `u.focusVisible()` itself — a ring never
 * shows on plain `:focus`, only on keyboard/assistive-tech focus — so this
 * utility already wraps the state a component would otherwise have to add
 * by hand.
 *
 * @example u.ring()
 * @example css({ "&:focus-visible": { outlineWidth: "2px", outlineStyle: "solid", outlineOffset: "2px", outlineColor: "var(--ui-ring, Highlight)" } })
 * @example u.ring("danger")
 * @example css({ "&:focus-visible": { outlineColor: "var(--ui-danger-ring)" } })
 */
export function ring<Node extends Element = Element>(value?: ColorValue | (string & {})) {
	return focusVisible<Node>(
		utility<Node>(() => ({
			outlineWidth: "2px",
			outlineStyle: "solid",
			outlineOffset: "2px",
			outlineColor: value ? color(value, "ring") : varUtility("ui-ring", "Highlight"),
		})),
	);
}
