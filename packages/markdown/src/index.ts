/**
 * The package root: markdown transformations that are neither parsing nor
 * rendering, and that carry no runtime beyond the parser. Plain-text extraction
 * lives here rather than in a string utility because it needs the markdown AST,
 * and it is reached from this entrypoint so an excerpt or a search index can use
 * it without pulling in a renderer or a syntax highlighter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { PlainTextOptions } from "./server/plain-text";

export { toPlainText } from "./server/plain-text";
