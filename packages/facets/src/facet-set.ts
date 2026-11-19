/**
 * The facet set: a typed list of facets over one record type that parses a URL's filters,
 * writes them back, narrows records and counts every option with the other facets applied.
 * One definition answers all four, so a filter link and the counts beside it always agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import { ValidationError } from "@sdxc/validate";

import type { FacetEntry, RangeOptions, TermsOptions, ToggleOptions } from "./facet.js";
import type {
	AppliedFilter,
	BucketCount,
	Counts,
	FacetResult,
	FacetShape,
	FacetsOfKind,
	Filters,
	NumberRange,
	TermCount,
} from "./types.js";

import {
	DEFAULT_TERM_LIMIT,
	inRange,
	isActive,
	isRange,
	matches,
	MAX_TERM_LENGTH,
	readTerms,
} from "./facet.js";

/** One problem found while parsing, named by the query parameter that carried it. */
interface Issue {
	message: string;
	path: string[];
}

/** Parameter text a toggle reads as on; `on` is what a checkbox without a value submits. */
const TOGGLE_ON = new Set(["1", "true", "on"]);

/** Parameter text a toggle reads as off. */
const TOGGLE_OFF = new Set(["0", "false", "off"]);

/** A facet name new to the set; reusing a name is a type error. */
type NewName<N extends string, D extends FacetShape> = N extends keyof D ? never : N;

/**
 * Faceted filtering for one record type. Build it once with `createFacets<Record>()` and a
 * chain of `.terms()`, `.range()` and `.toggle()`; each call returns a new set, so a set
 * shared across requests is never changed by one of them.
 *
 * @template T The record type.
 * @template D The facets by name, each mapped to its kind.
 */
export class FacetSet<T, D extends FacetShape = Record<never, never>> {
	readonly #entries: readonly FacetEntry<T>[];

	/** @param entries The facets in definition order, which is also the URL's parameter order. */
	constructor(entries: readonly FacetEntry<T>[] = []) {
		this.#entries = entries;
	}

	/**
	 * Adds a facet whose options are values a record carries, one or several per record.
	 * Several chosen values match a record carrying any one of them.
	 *
	 * @example createFacets<Poster>().terms("color", (poster) => poster.colors)
	 */
	terms<N extends string>(
		name: NewName<N, D>,
		read: (record: T) => string | readonly string[] | null | undefined,
		options: TermsOptions = {},
	): FacetSet<T, D & Record<N, "terms">> {
		return new FacetSet([
			...this.#entries,
			{
				kind: "terms",
				name,
				param: options.param ?? name,
				values: options.values ?? null,
				limit: options.limit ?? DEFAULT_TERM_LIMIT,
				read,
			},
		]);
	}

	/**
	 * Adds a numeric facet filtered by an interval and counted in buckets. A record without a
	 * value is kept while the range is open and dropped once either end is set.
	 *
	 * @example createFacets<Poster>().range("price", (poster) => poster.price, { buckets: [0, 2500, 5000] })
	 */
	range<N extends string>(
		name: NewName<N, D>,
		read: (record: T) => number | null | undefined,
		options: RangeOptions = {},
	): FacetSet<T, D & Record<N, "range">> {
		return new FacetSet([
			...this.#entries,
			{
				kind: "range",
				name,
				minParam: options.minParam ?? `${name}_min`,
				maxParam: options.maxParam ?? `${name}_max`,
				buckets: [...(options.buckets ?? [])].sort((a, b) => a - b),
				read,
			},
		]);
	}

	/**
	 * Adds a yes/no facet, such as "in stock", that keeps only records passing the test once on.
	 *
	 * @example createFacets<Poster>().toggle("inStock", (poster) => poster.stock > 0)
	 */
	toggle<N extends string>(
		name: NewName<N, D>,
		read: (record: T) => boolean,
		options: ToggleOptions = {},
	): FacetSet<T, D & Record<N, "toggle">> {
		return new FacetSet([
			...this.#entries,
			{ kind: "toggle", name, param: options.param ?? name, read },
		]);
	}

	/** A selection with every facet cleared: no terms, open ranges, toggles off. */
	empty(): Filters<D> {
		let filters: Record<string, unknown> = {};
		for (let entry of this.#entries) filters[entry.name] = blank(entry);
		return filters as Filters<D>;
	}

	/**
	 * Reads the filters from a URL's query. Blank parameters count as absent; every malformed
	 * one (an undeclared value, a non-number, a reversed range, too many values) is reported
	 * together, each issue's path naming its parameter.
	 *
	 * @example let filters = posterFacets.parse(url.searchParams);
	 */
	parse(searchParams: URLSearchParams): Result<Filters<D>, ValidationError> {
		let issues: Issue[] = [];
		let filters: Record<string, unknown> = {};
		for (let entry of this.#entries) {
			if (entry.kind === "terms") filters[entry.name] = parseTerms(entry, searchParams, issues);
			else if (entry.kind === "range")
				filters[entry.name] = parseRange(entry, searchParams, issues);
			else filters[entry.name] = parseToggle(entry, searchParams, issues);
		}
		if (issues.length > 0) return failure(new ValidationError(issues));
		return success(filters as Filters<D>);
	}

	/**
	 * Writes filters into query parameters. Parameters in `base` that no facet owns (a search
	 * query, a sort) are kept, every facet parameter is rewritten, and terms come out in a
	 * stable order so one selection always yields one URL.
	 *
	 * @example `?${posterFacets.serialize(posterFacets.toggleTerm(filters, "color", "ochre"), url.searchParams)}`
	 */
	serialize(filters: Partial<Filters<D>>, base?: URLSearchParams): URLSearchParams {
		let params = new URLSearchParams(base);
		let selection = filters as Record<string, unknown>;
		for (let entry of this.#entries) {
			for (let param of paramsOf(entry)) params.delete(param);
		}
		for (let entry of this.#entries) {
			let value = selection[entry.name];
			if (!isActive(value)) continue;
			if (entry.kind === "terms") {
				for (let term of orderTerms(value as string[], entry.values))
					params.append(entry.param, term);
			} else if (entry.kind === "range") {
				let range = value as NumberRange;
				if (range.min !== null) params.set(entry.minParam, String(range.min));
				if (range.max !== null) params.set(entry.maxParam, String(range.max));
			} else {
				params.set(entry.param, "1");
			}
		}
		return params;
	}

	/**
	 * Narrows the records to those passing every filter, and counts each facet's options over
	 * the records every *other* facet leaves, so choosing a colour never hides the other
	 * colours' counts. One pass over the records, whatever the number of facets.
	 *
	 * @example let { items, total, counts } = posterFacets.apply(posters, filters);
	 */
	apply(records: Iterable<T>, filters: Partial<Filters<D>> = {}): FacetResult<T, D> {
		let selection = filters as Record<string, unknown>;
		let tallies = this.#entries.map((entry) => new Tally(entry, selection[entry.name]));
		let items: T[] = [];
		for (let record of records) {
			let failed = -1;
			let failures = 0;
			for (let [index, entry] of this.#entries.entries()) {
				if (matches(entry, record, selection[entry.name])) continue;
				failures += 1;
				failed = index;
				if (failures > 1) break;
			}
			if (failures === 0) {
				items.push(record);
				for (let tally of tallies) tally.add(record);
			} else if (failures === 1) {
				tallies[failed]?.add(record);
			}
		}
		let counts: Record<string, unknown> = {};
		for (let tally of tallies) counts[tally.entry.name] = tally.result();
		return { items, total: items.length, counts: counts as Counts<D> };
	}

	/**
	 * Adds a value to a terms facet's selection, or removes it when already chosen: the link
	 * behind one checkbox in a facet list.
	 */
	toggleTerm<N extends FacetsOfKind<D, "terms">>(
		filters: Filters<D>,
		name: N,
		value: string,
	): Filters<D> {
		let selected: unknown = filters[name];
		let current = Array.isArray(selected) ? (selected as string[]) : [];
		let next = current.includes(value)
			? current.filter((term) => term !== value)
			: [...current, value];
		return { ...filters, [name]: next };
	}

	/** Replaces one facet's selection, leaving the others as they are. */
	set<N extends keyof D & string>(filters: Filters<D>, name: N, value: Filters<D>[N]): Filters<D> {
		return { ...filters, [name]: value };
	}

	/** Clears one facet's selection, or every facet's when no name is given. */
	clear(filters: Filters<D>, name?: keyof D & string): Filters<D> {
		if (name === undefined) return this.empty();
		let entry = this.#entries.find((candidate) => candidate.name === name);
		if (entry === undefined) return filters;
		return { ...filters, [name]: blank(entry) };
	}

	/**
	 * Lists every filter in effect, one entry per chosen term, range or toggle, each carrying
	 * the selection without it so a chip's remove link is one `serialize()` away.
	 */
	applied(filters: Filters<D>): AppliedFilter<D>[] {
		let list: AppliedFilter<D>[] = [];
		let selection = filters as Record<string, unknown>;
		for (let entry of this.#entries) {
			let value = selection[entry.name];
			if (!isActive(value)) continue;
			let facet = entry.name as keyof D & string;
			if (entry.kind === "terms") {
				for (let term of orderTerms(value as string[], entry.values)) {
					let rest = (value as string[]).filter((other) => other !== term);
					list.push({ facet, kind: "terms", value: term, filters: { ...filters, [facet]: rest } });
				}
			} else if (entry.kind === "range") {
				list.push({
					facet,
					kind: "range",
					value: value as NumberRange,
					filters: this.clear(filters, facet),
				});
			} else {
				list.push({ facet, kind: "toggle", value: true, filters: this.clear(filters, facet) });
			}
		}
		return list;
	}
}

/**
 * Starts a facet set for one record type; chain `.terms()`, `.range()` and `.toggle()` to add
 * facets. The record type is the only type argument, and every facet name is inferred.
 *
 * @template T The record type.
 * @example let posterFacets = createFacets<Poster>().terms("style", (p) => p.style).toggle("inStock", (p) => p.stock > 0);
 */
export function createFacets<T>(): FacetSet<T> {
	return new FacetSet<T>();
}

/** Counts one facet's options over the records it is shown. */
class Tally<T> {
	readonly entry: FacetEntry<T>;
	readonly #selection: unknown;
	readonly #terms = new Map<string, number>();
	readonly #buckets: number[];
	#on = 0;
	#min: number | null = null;
	#max: number | null = null;

	constructor(entry: FacetEntry<T>, selection: unknown) {
		this.entry = entry;
		this.#selection = selection;
		this.#buckets = entry.kind === "range" ? entry.buckets.map(() => 0) : [];
	}

	add(record: T): void {
		let entry = this.entry;
		if (entry.kind === "terms") {
			for (let term of readTerms(entry, record))
				this.#terms.set(term, (this.#terms.get(term) ?? 0) + 1);
			return;
		}
		if (entry.kind === "toggle") {
			if (entry.read(record) === true) this.#on += 1;
			return;
		}
		let value = entry.read(record);
		if (typeof value !== "number" || !Number.isFinite(value)) return;
		this.#min = this.#min === null ? value : Math.min(this.#min, value);
		this.#max = this.#max === null ? value : Math.max(this.#max, value);
		let index = bucketIndex(entry.buckets, value);
		if (index !== -1) this.#buckets[index] = (this.#buckets[index] ?? 0) + 1;
	}

	result():
		| TermCount[]
		| { min: number | null; max: number | null; buckets: BucketCount[] }
		| { count: number; selected: boolean } {
		let entry = this.entry;
		if (entry.kind === "terms") return termCounts(this.#terms, this.#selection, entry.values);
		if (entry.kind === "toggle") return { count: this.#on, selected: this.#selection === true };
		let range = isRange(this.#selection) ? this.#selection : { min: null, max: null };
		let buckets = entry.buckets.map((min, index) => {
			let max = entry.buckets[index + 1] ?? null;
			return {
				min,
				max,
				count: this.#buckets[index] ?? 0,
				selected: range.min === min && range.max === max,
			};
		});
		return { min: this.#min, max: this.#max, buckets };
	}
}

/**
 * Orders a terms facet's options: declared values in their declared order, zeros included;
 * otherwise by count, most first, then by value. A chosen value always stays in the list,
 * so its checkbox can be unticked even when nothing matches it any more.
 */
function termCounts(
	tally: Map<string, number>,
	selection: unknown,
	values: readonly string[] | null,
): TermCount[] {
	let chosen = Array.isArray(selection) ? (selection as string[]) : [];
	let names = values === null ? [...tally.keys()] : [...values];
	for (let term of chosen) if (!names.includes(term)) names.push(term);
	let counts = names.map((value) => ({
		value,
		count: tally.get(value) ?? 0,
		selected: chosen.includes(value),
	}));
	if (values !== null) return counts;
	return counts.sort((a, b) => b.count - a.count || compareText(a.value, b.value));
}

/** Code-unit order, so counts sort the same in every runtime and locale. */
function compareText(a: string, b: string): number {
	if (a === b) return 0;
	return a < b ? -1 : 1;
}

/** The bucket `[edge, nextEdge)` a value falls in, or -1 below the first edge. */
function bucketIndex(edges: readonly number[], value: number): number {
	for (let index = edges.length - 1; index >= 0; index -= 1) {
		let edge = edges[index];
		if (edge !== undefined && inRange(value, { min: edge, max: edges[index + 1] ?? null }))
			return index;
	}
	return -1;
}

/** Puts chosen terms in declared order, or alphabetical order without one, deduplicated. */
function orderTerms(terms: readonly string[], values: readonly string[] | null): string[] {
	let unique = [...new Set(terms)];
	if (values === null) return unique.sort(compareText);
	let rank = (term: string) => {
		let index = values.indexOf(term);
		return index === -1 ? values.length : index;
	};
	return unique.sort((a, b) => rank(a) - rank(b) || compareText(a, b));
}

/** The query parameters a facet owns. */
function paramsOf<T>(entry: FacetEntry<T>): string[] {
	return entry.kind === "range" ? [entry.minParam, entry.maxParam] : [entry.param];
}

/** A facet's cleared selection. */
function blank<T>(entry: FacetEntry<T>): string[] | NumberRange | boolean {
	if (entry.kind === "terms") return [];
	if (entry.kind === "range") return { min: null, max: null };
	return false;
}

/** Reads a parameter, treating blank text as absent. */
function readParam(searchParams: URLSearchParams, name: string): string | null {
	let raw = searchParams.get(name);
	if (raw === null) return null;
	let trimmed = raw.trim();
	return trimmed === "" ? null : trimmed;
}

/** Reads a terms facet's repeated parameter, the shape a group of checkboxes submits. */
function parseTerms<T>(
	entry: FacetEntry<T> & { kind: "terms" },
	searchParams: URLSearchParams,
	issues: Issue[],
): string[] {
	let terms = [
		...new Set(
			searchParams
				.getAll(entry.param)
				.map((term) => term.trim())
				.filter((term) => term !== ""),
		),
	];
	if (terms.length > entry.limit) {
		issues.push({ message: `Choose at most ${entry.limit} values`, path: [entry.param] });
		return [];
	}
	for (let term of terms) {
		if (term.length > MAX_TERM_LENGTH) {
			issues.push({
				message: `Expected a value of at most ${MAX_TERM_LENGTH} characters`,
				path: [entry.param],
			});
		} else if (entry.values !== null && !entry.values.includes(term)) {
			issues.push({ message: `Unknown value "${term}"`, path: [entry.param] });
		}
	}
	return terms;
}

/** Reads a range facet's two ends, each optional, and checks they are in order. */
function parseRange<T>(
	entry: FacetEntry<T> & { kind: "range" },
	searchParams: URLSearchParams,
	issues: Issue[],
): NumberRange {
	let min = parseNumber(searchParams, entry.minParam, issues);
	let max = parseNumber(searchParams, entry.maxParam, issues);
	if (min !== null && max !== null && min >= max) {
		issues.push({ message: "Expected the lower end below the upper end", path: [entry.maxParam] });
	}
	return { min, max };
}

/** Reads one finite number, reporting anything else. */
function parseNumber(searchParams: URLSearchParams, param: string, issues: Issue[]): number | null {
	let raw = readParam(searchParams, param);
	if (raw === null) return null;
	let value = Number(raw);
	if (!Number.isFinite(value)) {
		issues.push({ message: "Expected a number", path: [param] });
		return null;
	}
	return value;
}

/** Reads a toggle, accepting what a checkbox, a link or a hand-typed URL would send. */
function parseToggle<T>(
	entry: FacetEntry<T> & { kind: "toggle" },
	searchParams: URLSearchParams,
	issues: Issue[],
): boolean {
	let raw = readParam(searchParams, entry.param);
	if (raw === null) return false;
	let text = raw.toLowerCase();
	if (TOGGLE_ON.has(text)) return true;
	if (TOGGLE_OFF.has(text)) return false;
	issues.push({ message: "Expected 1 or 0", path: [entry.param] });
	return false;
}
