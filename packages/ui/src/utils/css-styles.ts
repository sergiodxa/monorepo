/**
 * The style object shape `css()` accepts, aliased from its own parameter type
 * rather than redeclared by hand, since `remix/ui` doesn't export that type by
 * name. Shared by every module that builds a nested selector, at-rule, or
 * gated block ahead of one `css()` call as its own separately-typed variable
 * instead of a computed key inline in one large object literal — assigning
 * into an already-typed variable keeps each nested block checked directly
 * against this one type, rather than widening past what `css()` accepts.
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
