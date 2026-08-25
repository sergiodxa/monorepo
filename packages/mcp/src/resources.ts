/**
 * Resource declaration and handling.
 *
 * A resource is addressed by URI, and a URI is a URL, so the pattern is a
 * `remix/route-pattern` — the same syntax the apps declare routes with, and the same
 * machinery for matching one and for building one from its variables. The RFC 6570
 * template MCP puts on the wire is derived from that pattern rather than written a second
 * time, which is the same trade as deriving a tool's argument type from its JSON Schema.
 *
 * Resources differ from tools in who reaches for them: a tool is chosen by the model,
 * while a resource is picked by the person or attached by their client. That is why the
 * blog's posts belong here as well as behind a search tool — a reader who wants to hand
 * one to their agent has no slug to give a tool.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CreateHrefArgs } from "remix/route-pattern/href";
import type { MatchParams } from "remix/route-pattern/match";

import { createHref } from "remix/route-pattern/href";

import type { AnyRequestContext, ResourceContext } from "./context";

/** A value a handler may return directly or as a promise. */
type Awaitable<T> = T | Promise<T>;

/** What a resource declares about itself, beyond its URI pattern. */
export interface ResourceDeclaration {
	/** Programmatic name, unique within the server. */
	name: string;
	/** Human-readable name, shown in a picker. */
	title?: string;
	/** What the resource holds, written for the person choosing it. */
	description?: string;
	/** The media type its contents are served as, when it is known up front. */
	mimeType?: string;
}

/** The metadata a resource carries into every list and read. */
export interface ResourceDescriptor extends ResourceDeclaration {
	/** The RFC 6570 template published in `resources/templates/list`. */
	uriTemplate: string;
}

/** Brands a declared resource so a group can tell one from a nested group. */
const RESOURCE = Symbol.for("@pkg/mcp.resource");

/** A declared resource. Holds no handler — `map()` binds that. */
export interface Resource<Pattern extends string = string> {
	readonly [RESOURCE]: true;
	/** The `route-pattern` source this resource matches and builds URIs from. */
	readonly pattern: Pattern;
	/** The declared metadata, plus the derived RFC 6570 template. */
	readonly descriptor: ResourceDescriptor;
	/** Whether the pattern captures anything, which decides which list it appears in. */
	readonly hasVariables: boolean;
	/**
	 * Builds this resource's URI from its variables.
	 *
	 * The typed `createHref` for the declared pattern, so a listing never concatenates a
	 * URI by hand and cannot drift from the template it was declared with.
	 */
	href(...args: CreateHrefArgs<Pattern>): string;
}

/** One entry in a `resources/list` answer. */
export interface ResourceListing {
	uri: string;
	name?: string;
	title?: string;
	description?: string;
	mimeType?: string;
	size?: number;
}

/** One block of a resource's contents. */
export interface ResourceContents {
	uri?: string;
	mimeType?: string;
	text?: string;
	blob?: string;
}

/**
 * What a read handler may answer with.
 *
 * A string is text in the declared media type; a byte array is Base64-encoded as a blob;
 * an array is passed through for a read that returns several contents. `null` means the
 * resource does not exist, which MCP reports as `-32602` — and it has to be `null` rather
 * than an empty array, because the specification forbids an empty `contents` for a
 * resource that is not there: it cannot be told apart from one that is simply empty.
 */
export type ReadResult = string | Uint8Array | ResourceContents[] | null | undefined;

/** How one resource is listed and read. */
export interface ResourceAction<Pattern extends string = string> {
	/**
	 * Whether this resource exists for this caller.
	 *
	 * Same contract as a tool's: absent from every list, and reported as not found on read.
	 */
	available?(ctx: AnyRequestContext): boolean;
	/**
	 * Enumerates concrete instances for `resources/list`.
	 *
	 * Omit it and a resource with variables appears only in `resources/templates/list` —
	 * which is the right shape for a corpus too large to enumerate. A resource with no
	 * variables needs no enumerator: it is already one concrete URI.
	 */
	list?(ctx: AnyRequestContext): Awaitable<ResourceListing[]>;
	/** Reads one instance. Return `null` when it does not exist. */
	read(ctx: ResourceContext<MatchParams<Pattern>>): Awaitable<ReadResult>;
}

/** A tree of declared resources. */
export interface ResourceGroup {
	readonly [key: string]: Resource | ResourceGroup;
}

/** Reports whether a node of a declaration tree is a resource rather than a nested group. */
export function isResource(value: Resource | ResourceGroup): value is Resource {
	return RESOURCE in value;
}

/**
 * Declares one resource.
 *
 * @param pattern A `route-pattern` source. It must be convertible to an RFC 6570 template,
 * so static text, `:name` variables and `*name` wildcards only.
 * @param declaration What the resource is called and what it holds.
 * @returns The declared resource, ready to be mapped.
 * @throws Error When the pattern uses syntax RFC 6570 cannot express.
 * @example
 * let article = resource("https://example.com/articles/:slug.md", {
 * 	name: "Article",
 * 	mimeType: "text/markdown",
 * });
 */
export function resource<const Pattern extends string>(
	pattern: Pattern,
	declaration: ResourceDeclaration,
): Resource<Pattern> {
	let { uriTemplate, hasVariables } = toUriTemplate(pattern);

	return {
		[RESOURCE]: true,
		pattern,
		descriptor: { ...declaration, uriTemplate },
		hasVariables,
		href(...args) {
			return createHref(pattern, ...args);
		},
	};
}

/**
 * Groups declared resources, checking that no name and no pattern is used twice.
 *
 * @param group Resources and nested groups.
 * @returns The same tree, unchanged.
 * @throws Error When two resources share a name or a pattern.
 * @example
 * export default resources({ article, tutorial });
 */
export function resources<const Group extends ResourceGroup>(group: Group): Group {
	let names = new Set<string>();
	let patterns = new Set<string>();

	for (let each of walkResources(group)) {
		if (names.has(each.descriptor.name)) {
			throw new Error(`Duplicate resource name ${JSON.stringify(each.descriptor.name)}`);
		}
		if (patterns.has(each.pattern)) {
			throw new Error(`Duplicate resource pattern ${JSON.stringify(each.pattern)}`);
		}
		names.add(each.descriptor.name);
		patterns.add(each.pattern);
	}

	return group;
}

/**
 * Walks a resource declaration tree.
 *
 * @param group The tree to walk.
 * @yields Every resource in it, depth first in declaration order.
 */
export function* walkResources(group: ResourceGroup): Generator<Resource> {
	for (let node of Object.values(group)) {
		if (isResource(node)) yield node;
		else yield* walkResources(node as ResourceGroup);
	}
}

/**
 * Types one resource's implementation against its declaration, so it can live in its own
 * file.
 *
 * Purely a type anchor at runtime — it returns what it was given. Its value is that a read
 * handler written apart from the `map()` call still gets `ctx.variables` typed from the
 * pattern, the way `createAction` types `ctx.params` for a route.
 *
 * @param resource The declared resource this implements.
 * @param action How to list and read it.
 * @returns The action, typed for `map()`.
 * @example
 * export default createResource(resourceset.article, { list, read });
 */
export function createResource<const Pattern extends string>(
	resource: Resource<Pattern>,
	action: ResourceAction<Pattern>,
): ResourceAction<Pattern> {
	return action;
}

/** The result of converting a `route-pattern` source to an RFC 6570 template. */
interface Converted {
	uriTemplate: string;
	hasVariables: boolean;
}

/**
 * Derives the RFC 6570 template MCP publishes from a `route-pattern` source.
 *
 * `:name` becomes `{name}` and `*name` becomes `{+name}`, whose reserved expansion is what
 * allows the `/` a wildcard can match. Everything else in the pattern language has no RFC
 * 6570 equivalent — optionals, protocol alternation, search constraints, unnamed
 * wildcards, repeated capture names — and is refused here rather than silently published
 * as a template a client would expand into a URI this server never matches. A pattern that
 * needs an optional segment is two resources.
 */
function toUriTemplate(pattern: string): Converted {
	let template = "";
	let names = new Set<string>();
	let hasVariables = false;

	for (let index = 0; index < pattern.length; index++) {
		let char = pattern[index];

		if (char === "\\") {
			// An escaped delimiter is literal text in the pattern, and literal text in the
			// template — but `{` and `}` are the template's own syntax and have to stay out.
			let escaped = pattern[index + 1] ?? "";
			if (escaped === "{" || escaped === "}") {
				throw new Error(`Resource pattern ${JSON.stringify(pattern)} cannot contain braces`);
			}
			template += escaped;
			index += 1;
			continue;
		}

		if (char === "(" || char === ")") {
			throw new Error(
				`Resource pattern ${JSON.stringify(pattern)} uses an optional group, which RFC 6570 cannot express; declare one resource per variant`,
			);
		}

		if (char === "?") {
			throw new Error(
				`Resource pattern ${JSON.stringify(pattern)} uses a search constraint, which RFC 6570 cannot express`,
			);
		}

		if (char === "{" || char === "}") {
			throw new Error(`Resource pattern ${JSON.stringify(pattern)} cannot contain braces`);
		}

		if (char === ":" || char === "*") {
			let name = readName(pattern, index + 1);
			if (name === "") {
				// `://` is the protocol delimiter, not a capture, so a bare colon there is text.
				if (char === ":") {
					template += char;
					continue;
				}
				throw new Error(
					`Resource pattern ${JSON.stringify(pattern)} uses an unnamed wildcard, which has no name to publish`,
				);
			}
			if (names.has(name)) {
				throw new Error(
					`Resource pattern ${JSON.stringify(pattern)} captures ${JSON.stringify(name)} twice, which RFC 6570 cannot express`,
				);
			}
			names.add(name);
			hasVariables = true;
			template += char === "*" ? `{+${name}}` : `{${name}}`;
			index += name.length;
			continue;
		}

		template += char;
	}

	return { uriTemplate: template, hasVariables };
}

/** Reads a capture name — letters, digits and underscores — starting at `start`. */
function readName(pattern: string, start: number): string {
	let end = start;
	while (end < pattern.length && /[a-zA-Z0-9_]/.test(pattern[end] ?? "")) end += 1;
	return pattern.slice(start, end);
}

/**
 * Shapes a read handler's return value into the `contents` array MCP expects.
 *
 * @param output What the handler returned.
 * @param uri The URI that was asked for, used when a content block names none.
 * @param mimeType The resource's declared media type.
 * @returns The contents, or `null` when the handler reported the resource missing.
 */
export function toContents(
	output: ReadResult,
	uri: string,
	mimeType: string | undefined,
): ResourceContents[] | null {
	if (output === null || output === undefined) return null;

	if (typeof output === "string") {
		return [{ uri, ...(mimeType === undefined ? {} : { mimeType }), text: output }];
	}

	if (output instanceof Uint8Array) {
		return [{ uri, ...(mimeType === undefined ? {} : { mimeType }), blob: toBase64(output) }];
	}

	return output.map((each) => ({ uri, ...(mimeType === undefined ? {} : { mimeType }), ...each }));
}

/** Base64-encodes bytes without assuming a Node or browser-only helper. */
function toBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let byte of bytes) binary += String.fromCodePoint(byte);
	return btoa(binary);
}
