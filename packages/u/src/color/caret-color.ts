/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";
import type { ColorValue } from "../types";

import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";

/**
 * Sets `caret-color` for an editable field, resolving a tone at its `fg`
 * weight. With no value it emits `"auto"`, deriving the caret from the
 * field's text color; pass a tone when that reads near-invisible on a tint.
 *
 * @example u.caretColor()
 * @example css({ caretColor: "auto" })
 * @example u.caretColor("brand")
 * @example css({ caretColor: "var(--ui-brand-fg)" })
 * @example u.caretColor("brand.emphasis")
 * @example css({ caretColor: "var(--ui-brand-fg-emphasis)" })
 * @example u.caretColor("color.neutral.50")
 * @example css({ caretColor: "var(--ui-color-neutral-50)" })
 */
export function caretColor<Node extends Element = Element>(
	value?: ColorValue | (string & {}),
): UtilityMixin<Node> {
	return utility<Node>(() => ({ caretColor: value ? color(value, "fg") : "auto" }) as CSSStyles);
}
