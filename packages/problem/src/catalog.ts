/**
 * Problem catalogs: an API declares its problem types once, and gets a builder per
 * type for its handlers and a parser that recognizes those types for its clients,
 * so the `type`, `status` and `title` of each are written in one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, success } from "@sdxc/result";

import type { Problem } from "./types.js";

import { ProblemParseError, parseProblem, readExtensions } from "./parse.js";
import { problem } from "./problem.js";

/** One problem type in a catalog. */
export interface ProblemEntry<Extensions extends object = object> {
	/** Appended to the catalog's base URL to form `type`; it is the wire contract, so keep it stable. */
	slug: string;
	status: number;
	title: string;
	/** Types the builder's `extensions` argument and validates them when the catalog parses. */
	extensions?: StandardSchemaV1<unknown, Extensions>;
}

/** The entries of a catalog, keyed by builder name; `parse`, `is` and `entries` name its own methods. */
export type ProblemEntries = Record<string, ProblemEntry<any>> & {
	parse?: never;
	is?: never;
	entries?: never;
};

/** The extension members an entry's schema produces, `undefined` for an entry without one. */
type ExtensionsOf<Entry> =
	Entry extends ProblemEntry<infer Extensions>
		? Entry extends { extensions: StandardSchemaV1 }
			? Extensions
			: undefined
		: undefined;

/** What a call site supplies to a builder; `extensions` is required exactly when the entry has a schema. */
export type BuilderInput<Extensions> = {
	detail?: string;
	instance?: string;
} & ([Extensions] extends [undefined] ? { extensions?: undefined } : { extensions: Extensions });

/** A builder for one catalog entry, returning its problem `Response`. */
export type ProblemBuilder<Extensions> = [Extensions] extends [undefined]
	? (input?: BuilderInput<Extensions>, init?: ResponseInit) => Response
	: (input: BuilderInput<Extensions>, init?: ResponseInit) => Response;

/**
 * A problem the catalog read: `name` is the entry whose `type` it carries, with that entry's
 * extensions validated, or `null` for a type outside the catalog, which RFC 9457 requires a
 * client to accept.
 */
export type CatalogProblem<Entries extends ProblemEntries> =
	| {
			[Name in keyof Entries & string]: Problem<
				ExtensionsOf<Entries[Name]> extends object
					? ExtensionsOf<Entries[Name]>
					: Record<string, unknown>
			> & { name: Name };
	  }[keyof Entries & string]
	| (Problem & { name: null });

/** One entry as `entries()` lists it, with its resolved `type`. */
export interface CatalogEntry {
	name: string;
	type: string;
	status: number;
	title: string;
}

/** The methods every catalog carries beside its builders. */
export interface CatalogMethods<Entries extends ProblemEntries> {
	/**
	 * Reads a problem response and names the entry it belongs to. A known type whose
	 * extensions fail the entry's schema is a failure.
	 */
	parse(response: Response): Promise<Result<CatalogProblem<Entries>, ProblemParseError>>;
	/** Narrows a parsed problem to one entry. */
	is<Name extends keyof Entries & string>(
		problem: CatalogProblem<Entries>,
		name: Name,
	): problem is Extract<CatalogProblem<Entries>, { name: Name }>;
	/** Every entry, in declaration order, for rendering an error reference. */
	entries(): CatalogEntry[];
}

/** A defined catalog: one builder per entry, plus its methods. */
export type ProblemCatalog<Entries extends ProblemEntries> = {
	[Name in keyof Entries]: ProblemBuilder<ExtensionsOf<Entries[Name]>>;
} & CatalogMethods<Entries>;

/**
 * Declares an API's problem types. Each `type` is `base` followed by the entry's slug, so
 * `base` ends in `/`: that is what keeps its last path segment when a slug is resolved.
 *
 * @param base - The URL the types live under, usually the error reference's docs page.
 * @param entries - The problem types, keyed by the builder name each becomes.
 * @returns The catalog.
 * @example let problems = defineProblems("https://docs.example.com/errors/", { notFound: { slug: "not-found", status: 404, title: "Not found" } });
 * @example return problems.notFound({ detail: "No article has that slug." });
 */
export function defineProblems<const Entries extends ProblemEntries>(
	base: `${string}/`,
	entries: Entries,
): ProblemCatalog<Entries> {
	let names = new Map<string, string>();
	let listing: CatalogEntry[] = [];
	let catalog: Record<string, unknown> = {};

	for (let [name, entry] of Object.entries(entries) as [string, ProblemEntry][]) {
		let type = `${base}${entry.slug}`;
		names.set(type, name);
		listing.push({ name, type, status: entry.status, title: entry.title });
		catalog[name] = (
			input: { detail?: string; instance?: string; extensions?: object } = {},
			init?: ResponseInit,
		) => problem({ ...input, type, status: entry.status, title: entry.title }, init);
	}

	catalog.parse = async (response: Response) => {
		let parsed = await parseProblem(response);
		if (parsed.status === "failure") return parsed;

		let name = names.get(parsed.data.type) ?? null;
		if (name === null) return success({ ...parsed.data, name });

		let extensions = readExtensions(parsed.data.extensions, entries[name]?.extensions);
		if (extensions.status === "failure") return failure(extensions.error);
		return success({ ...parsed.data, extensions: extensions.data, name });
	};
	catalog.is = (parsed: { name: string | null }, name: string) => parsed.name === name;
	catalog.entries = () => listing.map((entry) => ({ ...entry }));

	return catalog as ProblemCatalog<Entries>;
}
