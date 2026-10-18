/**
 * Source-to-source edits over JavaScript and TypeScript, built on a scanner that reads strings,
 * template literals, regular expressions, comments and JSX as what they are. Every edit replaces
 * source ranges and returns the new text, so a file keeps its formatting, comments and quotes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { Edit } from "./edit.js";
export type { AddElementOptions } from "./element.js";
export type { CodemodErrorCode } from "./errors.js";
export type { InsertOptions } from "./insert.js";
export type { MoveOptions } from "./move.js";
export type { AddPropertyOptions } from "./property.js";
export type {
	BoundName,
	FindOptions,
	ModuleReference,
	Range,
	ReferenceKind,
} from "./references.js";
export type { Token, TokenType } from "./tokenize.js";

export { addElement } from "./element.js";
export { CodemodError } from "./errors.js";
export { insertAfterLast } from "./insert.js";
export { moveImports } from "./move.js";
export { addProperty } from "./property.js";
export { findModuleReferences } from "./references.js";
export { rewriteSpecifiers } from "./rewrite.js";
export { tokenize } from "./tokenize.js";
