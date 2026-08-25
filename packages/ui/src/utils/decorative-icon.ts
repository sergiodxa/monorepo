/**
 * The shared `aria-hidden` default every decorative icon slot applies
 * through `attrs` — an `Icon` compound part whose meaning is already carried
 * by adjacent text or the surrounding component's color, so exposing its
 * glyph to assistive technology would only add noise.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * `aria-hidden="true"` applied to a decorative icon slot through `attrs`
 * unless a consumer overrides it. The value stays the string `"true"` since
 * a boolean prop serializes to `aria-hidden=""`, which hides nothing.
 */
export const DEFAULT_ICON_ARIA_HIDDEN = "true";
