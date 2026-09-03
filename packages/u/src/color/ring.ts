/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types.js";

import { var as varUtility } from "../general/var.js";
import { utility } from "../internal/descriptor.js";
import { color } from "../internal/tokens.js";
import { focusVisible } from "../state/focus-visible.js";

/**
 * Applies a focus ring already scoped to `&:focus-visible`, so it shows for
 * keyboard and assistive-tech focus and a component can apply it directly.
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
