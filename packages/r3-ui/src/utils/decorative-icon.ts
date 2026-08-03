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
 * unless a consumer overrides it, keeping a purely visual glyph out of the
 * accessibility tree by default.
 *
 * **The string, never the boolean.** `aria-hidden` is not an HTML boolean
 * attribute: it is an ARIA attribute whose value is a token, and the only
 * token that hides anything is the text `"true"`. The renderer serializes a
 * `true` prop the way HTML wants a boolean attribute written — as the bare
 * name — which leaves `aria-hidden=""` in the markup, and an empty value is
 * not that token, so every glyph meant to be hidden gets announced instead.
 * `true` is the tidier-looking spelling and it is the one that silently does
 * nothing. The same trap applies to every ARIA attribute whose value is a
 * token rather than a flag — `aria-invalid`, `aria-busy`, `aria-pressed`,
 * `aria-checked` — and this package writes all of them as strings for it.
 */
export const DEFAULT_ICON_ARIA_HIDDEN = "true";
