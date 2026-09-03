/**
 * The grammar for source that is shown rather than highlighted, and the
 * destination for the names that ask for exactly that: `text`, `txt`, `dotenv`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar } from "../lexer.js";

/**
 * Claims nothing, so the scanner returns the whole input as one `plain` token.
 */
export const plain: Grammar = { main: [] };
