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
 * Sets `caret-color`, the color of the text-insertion cursor — the blinking
 * bar — inside an editable field: an `<input>`, a `<textarea>`, or anything
 * with `contenteditable`.
 *
 * Called with no argument it emits CSS's own initial value, `"auto"`, which
 * lets the browser derive the caret from the field's text color. That is
 * already the right answer most of the time, which is why there is no token
 * default here — passing a value should mean the default was actually wrong.
 *
 * Two cases make it worth reaching for. The first is legibility: against a
 * strongly tinted or high-contrast input background the browser-derived caret
 * can come out near-invisible, and an explicit color is the fix. The second is
 * polish — a brand-colored caret in a search field or a prominent composer is
 * one declaration, costs nothing, and reads as considered.
 *
 * Avoid `"transparent"`. It hides the caret completely, and the caret is the
 * only cue showing where the next character will land — without it a typist
 * cannot tell where they are in the text, and neither can anyone navigating by
 * keyboard. It is defensible only when a custom caret is being drawn in its
 * place, never as a way to tidy up the field's appearance.
 *
 * The value is resolved through the same color layer as the rest of these
 * utilities, with a default property of `fg`:
 *
 * - a bare semantic tone (`"brand"`, `"danger"`) — resolves to that tone's
 *   plain `fg` weight, e.g. `var(--ui-brand-fg)`
 * - a tone with an explicit suffix (`"brand.emphasis"`, `"neutral.muted"`) —
 *   the suffix goes through the friendly-name alias table: `tint`→`bg-tint`,
 *   `solid`→`bg-solid`, `muted`→`fg-muted`, `emphasis`→`fg-emphasis`,
 *   `onSolid`→`fg-on-solid`, `strong`→`border-strong`
 * - a raw palette reference (`"color.brand.600"`) — resolves to
 *   `var(--ui-color-brand-600)`
 * - `"transparent"`, `"inherit"`, or `"currentColor"` — passed through as CSS
 *   keywords
 * - any value containing `(` — a `u.colorMix()` result, a `var(...)`
 *   reference, a raw `oklch(...)` — handed through untouched instead of being
 *   parsed as a token
 *
 * It paints one specific piece of native chrome, so it belongs with the rest
 * of that family: `u.colorScheme()` to decide the scheme the browser paints
 * everything else in, `u.accent()` for form-control chrome, and
 * `u.scrollbarColor()` for a scrollbar.
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
