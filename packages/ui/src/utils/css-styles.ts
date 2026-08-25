/**
 * The style object shape `css()` accepts, aliased directly from `css()`'s own
 * parameter type because `remix/ui` doesn't export that type under its own
 * name. Modules that build a nested selector, at-rule, or gated block ahead
 * of a `css()` call assign it into its own `CSSStyles` variable first, so
 * each nested block gets checked against this exact type as it's written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { css } from "remix/ui";

/**
 * The style object shape {@link css} accepts: a plain CSS-in-JS declaration
 * block, with nested selectors, at-rules (`@media`, `@supports`,
 * `@starting-style`, `@keyframes`), and computed keys all valid at any depth.
 *
 * @example
 * let hovered: CSSStyles = { opacity: 1 };
 * let host: CSSStyles = { opacity: 0, "&:hover": hovered };
 */
export type CSSStyles = Parameters<typeof css>[0];
