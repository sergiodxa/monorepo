/**
 * The documentation model: the JSON a documentation site reads. Every shape here
 * is plain data with no undefined members, so a module survives `JSON.stringify`
 * and arrives at a renderer with the same keys it left with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A parsed JSDoc block: the prose a reader sees first, then every block tag in
 * the order it was written.
 */
export interface DocComment {
	/** Markdown written before the first block tag, with the comment markers removed. */
	description: string;
	tags: DocTag[];
}

/**
 * One block tag. Aliases collapse onto their canonical spelling (`@arg` and
 * `@argument` become `param`, `@return` becomes `returns`), so a renderer
 * matches on one name per concept.
 */
export interface DocTag {
	/** Canonical tag name without the `@`. */
	tag: string;
	/** Subject of tags that name one, such as `@param` and `@template`. */
	name: string | null;
	/** Text between the braces of a `{Type}` annotation. */
	type: string | null;
	/** Everything after the tag, its type and its name, with the `-` separator dropped. */
	text: string;
}

/**
 * One `{@link}`, `{@linkcode}` or `{@linkplain}` occurrence, carried with the
 * offsets a renderer needs to substitute it inside the surrounding markdown.
 */
export interface DocLink {
	/** The whole inline tag as written, braces included. */
	raw: string;
	/** Symbol name or URL the link points at. */
	target: string;
	/** Label written after the target, when the author supplied one. */
	text: string | null;
	/** Offset of `raw` within the text it was found in. */
	index: number;
}

/** Where a documented symbol was written, with 1-based line and column. */
export interface DocSource {
	path: string;
	line: number;
	column: number;
}

/**
 * What a documented symbol is. `type-alias` covers both object and union
 * aliases, and `variable` covers every `const`, `let` and `var` binding.
 */
export type DocKind =
	| "function"
	| "class"
	| "interface"
	| "type-alias"
	| "variable"
	| "enum"
	| "enum-member"
	| "namespace"
	| "property"
	| "method"
	| "accessor"
	| "constructor";

/**
 * Modifiers a renderer turns into badges. Every field is always present, so a
 * template reads `flags.deprecated` without guarding for a missing object.
 */
export interface DocFlags {
	/** The symbol is the module's `export default`. */
	default: boolean;
	optional: boolean;
	readonly: boolean;
	static: boolean;
	abstract: boolean;
	async: boolean;
	/** The symbol carries `@deprecated`. */
	deprecated: boolean;
	/** The symbol carries `@internal`, which `extract` can drop entirely. */
	internal: boolean;
	visibility: "public" | "protected" | "private";
}

/** A generic parameter, with the description its `@template` tag supplied. */
export interface DocTypeParameter {
	name: string;
	constraint: string | null;
	default: string | null;
	description: string | null;
}

/** One parameter of a signature, merged with the `@param` tag that names it. */
export interface DocParameter {
	/** Identifier, or the binding pattern text for a destructured parameter. */
	name: string;
	/** The written type annotation; `null` when the parameter relies on inference. */
	type: string | null;
	description: string | null;
	optional: boolean;
	/** The parameter is a rest parameter (`...args`). */
	rest: boolean;
	/** Initializer text for a parameter with a default value. */
	default: string | null;
}

/**
 * One callable shape. A function with overloads contributes one signature per
 * overload, each keeping the comment written above it.
 */
export interface DocSignature {
	comment: DocComment | null;
	typeParameters: DocTypeParameter[];
	parameters: DocParameter[];
	/** The written return annotation; `null` when the return type is inferred. */
	returns: string | null;
}

/**
 * A documented symbol. Members of classes, interfaces, enums and namespaces are
 * the same shape under `children`, so one recursive renderer covers the tree.
 */
export interface DocNode {
	/** Stable identifier, `<module id>#<name>`, with members suffixed `#Class.member`. */
	id: string;
	name: string;
	kind: DocKind;
	comment: DocComment | null;
	source: DocSource;
	/** Written type annotation, alias right-hand side, or enum member initializer. */
	type: string | null;
	signatures: DocSignature[];
	typeParameters: DocTypeParameter[];
	/** Type text of each `extends` clause entry. */
	extends: string[];
	/** Type text of each `implements` clause entry. */
	implements: string[];
	children: DocNode[];
	flags: DocFlags;
}

/**
 * An export forwarded from another module. The extractor reads one file at a
 * time, so a barrel's symbols arrive here as pointers the caller resolves by
 * extracting the module named in `module`.
 */
export interface DocReExport {
	/** `named` for `export { a } from`, `all` for `export *`, `namespace` for `export * as ns`. */
	kind: "named" | "all" | "namespace";
	/** Specifier as written, such as `./parse.js`. */
	module: string;
	/** Name in the source module, `null` for `export *` and `export * as ns`. */
	name: string | null;
	/** Name this module publishes it under, `null` for `export *`. */
	exported: string | null;
	/** The clause is `export type`, or the named binding is written `type x`. */
	typeOnly: boolean;
}

/** One extracted file: its module comment, its exports and what it forwards. */
export interface DocModule {
	/** Identifier a `DocNode.id` is prefixed with; defaults to `path` without its extension. */
	id: string;
	/** Path the caller supplied, repeated on every `DocSource` below it. */
	path: string;
	/** The file's leading JSDoc block, when one is separated from the first declaration. */
	comment: DocComment | null;
	children: DocNode[];
	reExports: DocReExport[];
}

/**
 * The document a documentation site reads. The caller assembles it from the
 * modules it extracted, in whatever order it wants them presented.
 */
export interface DocProject {
	/** Value of `SCHEMA_VERSION` the document was written with. */
	schema: number;
	name: string;
	version: string | null;
	modules: DocModule[];
}
