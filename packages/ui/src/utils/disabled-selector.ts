/**
 * The selector every mixin checks before reacting to a click or counting an
 * element among its keyboard-navigation stops: an element reads as disabled
 * whether that state rides the native `disabled` attribute a form control
 * carries, or `aria-disabled="true"`, the attribute a non-form element (a
 * `role="menuitem"` row, a `role="gridcell"` action) carries instead since it
 * has no native disabled state of its own to set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Matches an element carrying the native `disabled` attribute or
 * `aria-disabled="true"`, the pairing that lets one guard cover both a native
 * form control and an ARIA-only widget with a single `.matches()` call or
 * `querySelectorAll` filter.
 *
 * @example
 * button.matches(DISABLED_SELECTOR);
 * @example
 * candidates.filter((element) => !element.matches(DISABLED_SELECTOR));
 */
export const DISABLED_SELECTOR = ':disabled, [aria-disabled="true"]';
