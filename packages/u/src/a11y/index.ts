/**
 * Accessibility mixins for development-time layout debugging, forced-colors
 * mode opt-outs, and clipping content out of view while keeping it reachable
 * by screen readers and keyboard focus.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export { debug } from "./debug";
export { forcedColorAdjust } from "./forced-color-adjust";
export type { ForcedColorAdjustValue } from "./forced-color-adjust";
export { visuallyHidden } from "./visually-hidden";
