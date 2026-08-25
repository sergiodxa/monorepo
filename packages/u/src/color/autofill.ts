/**
 * Browsers paint their own background (often a bright yellow) into an
 * autofilled input, ignoring the input's actual `background-color` — an
 * inset `box-shadow` large enough to cover the whole field is the only
 * reliable way to paint over it, and `!important` is required since the
 * autofill background comes from the browser's own user-agent styles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ColorValue } from "../types";

import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";
import { when } from "../state/when";

/**
 * Overrides the browser's autofill background and text color under
 * `&:-webkit-autofill`, so an autofilled input keeps the appearance every
 * other input has. Defaults to the system background/foreground tokens.
 *
 * @example u.autofill()
 * @example css({ "&:-webkit-autofill": { boxShadow: "0 0 0 1000px var(--ui-bg, Canvas) inset !important", WebkitBoxShadow: "0 0 0 1000px var(--ui-bg, Canvas) inset !important", WebkitTextFillColor: "var(--ui-fg, CanvasText) !important" } })
 * @example u.autofill("neutral.tint", "neutral")
 */
export function autofill<Node extends Element = Element>(
	background?: ColorValue | (string & {}),
	foreground?: ColorValue | (string & {}),
) {
	let bg = background ? color(background) : varUtility("ui-bg", "Canvas");
	let fg = foreground ? color(foreground, "fg") : varUtility("ui-fg", "CanvasText");

	return when<Node>(
		"&:-webkit-autofill",
		utility<Node>(() => ({
			boxShadow: `0 0 0 1000px ${bg} inset !important`,
			WebkitBoxShadow: `0 0 0 1000px ${bg} inset !important`,
			WebkitTextFillColor: `${fg} !important`,
		})),
	);
}
