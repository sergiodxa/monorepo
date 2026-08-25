/**
 * The style object shape `css()` accepts, aliased from its own parameter type
 * because `remix/ui` exposes the shape only through that parameter. Every
 * utility mixin's internal style tree matches it, so a tree can be merged,
 * nested under a wrapper's selector or at-rule, and handed to `css()`
 * unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { css } from "remix/ui";

/**
 * The style object shape {@link css} accepts: a plain CSS-in-JS declaration
 * block, with nested selectors, at-rules (`@media`, `@container`,
 * `@supports`), and computed keys all valid at any depth.
 *
 * @example
 * let hovered: CSSStyles = { opacity: 1 };
 * let host: CSSStyles = { opacity: 0, "&:hover": hovered };
 */
export type CSSStyles = Parameters<typeof css>[0];
