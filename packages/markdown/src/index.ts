/**
 * The package root holds markdown transformations that need the parsed AST
 * but carry no rendering runtime. Plain-text extraction sits here because it
 * operates directly on that AST, and this entrypoint lets an excerpt or a
 * search index reach it while depending only on the parser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { PlainTextOptions } from "./server/plain-text";

export { toPlainText } from "./server/plain-text";
