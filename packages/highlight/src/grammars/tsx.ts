/**
 * The TSX grammar: the element modes and the type-level syntax at once, which
 * is what a `.tsx` fence needs and what degrading it to JSX loses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar } from "../lexer.js";

import { compose } from "../lexer.js";

import { elements } from "./jsx.js";
import { typescript } from "./typescript.js";

/**
 * Highlights TSX: everything TypeScript paints, plus tags, their attributes and
 * expression containers. The element rules are tried first, so `<div>` opens a
 * tag rather than reading as the comparison it looks like.
 *
 * @example scan("let el = <Row items={items} />", tsx)
 */
export const tsx: Grammar = compose(elements, typescript);
