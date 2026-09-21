/**
 * Public entry point: parse a JSDoc block on its own, or extract a whole module
 * of source text into the JSON model a documentation site renders.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	DocComment,
	DocFlags,
	DocKind,
	DocLink,
	DocModule,
	DocNode,
	DocParameter,
	DocProject,
	DocReExport,
	DocSignature,
	DocSource,
	DocTag,
	DocTypeParameter,
} from "./types.js";
export type { DocDiagnostic } from "./extract-error.js";
export type { ExtractOptions } from "./extract.js";

export { parseComment } from "./comment.js";
export { findTag, findTags } from "./tags.js";
export { inlineLinks } from "./links.js";
export { extract } from "./extract.js";
export { ExtractError } from "./extract-error.js";
export { SCHEMA_VERSION } from "./schema.js";
