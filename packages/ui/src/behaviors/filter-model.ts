/**
 * Headless filtering model for search-as-you-type option lists such as a
 * command palette. Owns the query string, the matched subset of options,
 * and which match is active, dispatching a plain `"change"` event whenever
 * any of the three moves so a DOM adapter can re-render without owning state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypedEventTarget } from "remix/ui";

import { dispatchChange } from "../utils/dispatch-change";

/** Query string a model starts with when {@link FilterModel.Init.query} is omitted. */
const DEFAULT_QUERY = "";

/**
 * Default matcher: a case-insensitive substring test against an option's
 * `value` and, when present, its `keywords`. An empty query matches every
 * option.
 *
 * @param option Option under test.
 * @param query Current query string.
 * @returns `true` when the option should be part of the matched set.
 */
function defaultMatch(option: FilterModel.Option, query: string): boolean {
	let needle = query.trim().toLowerCase();

	if (needle === "") return true;

	if (option.value.toLowerCase().includes(needle)) return true;

	if (option.keywords === undefined) return false;

	for (let keyword of option.keywords) {
		if (keyword.toLowerCase().includes(needle)) return true;
	}

	return false;
}

/**
 * Types associated with {@link FilterModel}: the option shape it filters
 * over, its construction options, and the event it dispatches.
 */
export namespace FilterModel {
	/**
	 * One filterable option. `id` is the stable key a consumer uses to
	 * correlate a rendered item with matched/active state; `value` and
	 * `keywords` are the text compared against the query.
	 */
	export interface Option {
		/** Stable identifier correlated with a rendered item. */
		id: string;
		/** Primary text compared against the query. */
		value: string;
		/** Additional search terms folded into matching alongside `value`. */
		keywords?: readonly string[];
	}

	/** Construction options accepted by {@link FilterModel}. */
	export interface Init {
		/** Initial option set the model filters over. Defaults to none. */
		options?: Iterable<Option>;
		/** Initial query string. Defaults to an empty string. */
		query?: string;
		/**
		 * Overrides the default case-insensitive substring match against
		 * `value` and `keywords`.
		 */
		match?: (option: Option, query: string) => boolean;
	}

	/** Events dispatched by {@link FilterModel} as its state changes. */
	export interface EventMap {
		/** Dispatched whenever the query, the matched set, or the active option changes. */
		change: Event;
	}
}

/**
 * Owns the query, the matched option set, and the active match for a
 * filterable list, and dispatches a `"change"` event whenever any of the
 * three moves. A DOM adapter mixin is the thin layer around an instance: it
 * forwards input events into {@link FilterModel.setQuery}, arrow keys into
 * the movement methods, and reads {@link FilterModel.matches} and
 * {@link FilterModel.activeId} back into `hidden` and
 * `aria-activedescendant` on the rendered items.
 */
export class FilterModel extends TypedEventTarget<FilterModel.EventMap> {
	#options: FilterModel.Option[];
	#query: string;
	#matches: FilterModel.Option[];
	#activeId: string | null;
	#match: (option: FilterModel.Option, query: string) => boolean;

	/**
	 * @param init Initial options, query, and match override.
	 */
	constructor(init: FilterModel.Init = {}) {
		super();

		this.#match = init.match ?? defaultMatch;
		this.#query = init.query ?? DEFAULT_QUERY;
		this.#options = init.options ? Array.from(init.options) : [];
		this.#matches = this.#options.filter((option) => this.#match(option, this.#query));
		this.#activeId = this.#matches[0]?.id ?? null;
	}

	/** Current query string filtering the option set. */
	get query(): string {
		return this.#query;
	}

	/** Full option set the model filters over, in the order last provided. */
	get options(): readonly FilterModel.Option[] {
		return this.#options;
	}

	/** Options whose value or keywords currently match the query, in their original order. */
	get matches(): readonly FilterModel.Option[] {
		return this.#matches;
	}

	/** Id of the currently active match, or `null` when nothing is active. */
	get activeId(): string | null {
		return this.#activeId;
	}

	/** The active match's full option, or `null` when nothing is active. */
	get activeOption(): FilterModel.Option | null {
		return this.#matches.find((option) => option.id === this.#activeId) ?? null;
	}

	/** `true` when the current query has no matches. */
	get isEmpty(): boolean {
		return this.#matches.length === 0;
	}

	/**
	 * Replaces the option set the model filters over and recomputes matches
	 * against the current query. Keeps the active option when it is still
	 * among the new matches, otherwise falls back to the first match (or
	 * `null` when there are none). Always dispatches `"change"`.
	 *
	 * @param options The full replacement option set.
	 */
	setOptions(options: Iterable<FilterModel.Option>): void {
		this.#options = Array.from(options);
		this.#recomputeMatches();
		this.#activeId = this.#resolveActiveId();
		dispatchChange(this);
	}

	/**
	 * Updates the query and recomputes matches. Keeps the active option
	 * when it is still among the new matches, otherwise falls back to the
	 * first match (or `null` when there are none). A no-op, dispatching
	 * nothing, when `query` equals the current query.
	 *
	 * @param query The new query string.
	 */
	setQuery(query: string): void {
		if (query === this.#query) return;

		this.#query = query;
		this.#recomputeMatches();
		this.#activeId = this.#resolveActiveId();
		dispatchChange(this);
	}

	/**
	 * Reports whether an option id is part of the current matched set.
	 *
	 * @param id Option id to test.
	 * @returns `true` when the option with that id currently matches the query.
	 */
	isMatch(id: string): boolean {
		return this.#matches.some((option) => option.id === id);
	}

	/**
	 * Sets the active option explicitly. Ignored when `id` is not `null`
	 * and not part of the current matches, so the active option always
	 * stays a visible match. Dispatches `"change"` only when the active id
	 * actually changes.
	 *
	 * @param id Id of the option to activate, or `null` to clear activation.
	 */
	setActive(id: string | null): void {
		if (id !== null && !this.isMatch(id)) return;

		this.#setActiveId(id);
	}

	/**
	 * Moves activation to the match after the current one, wrapping to the
	 * first match after the last. Activates the first match when nothing is
	 * currently active.
	 */
	moveNext(): void {
		this.#moveBy(1);
	}

	/**
	 * Moves activation to the match before the current one, wrapping to the
	 * last match before the first. Activates the last match when nothing is
	 * currently active.
	 */
	movePrevious(): void {
		this.#moveBy(-1);
	}

	/** Activates the first match, or clears activation when there are no matches. */
	moveFirst(): void {
		this.#setActiveId(this.#matches[0]?.id ?? null);
	}

	/** Activates the last match, or clears activation when there are no matches. */
	moveLast(): void {
		this.#setActiveId(this.#matches.at(-1)?.id ?? null);
	}

	/** Recomputes `matches` from the current options, query, and matcher. */
	#recomputeMatches(): void {
		this.#matches = this.#options.filter((option) => this.#match(option, this.#query));
	}

	/**
	 * Resolves the active id after `matches` changes: keeps the previous
	 * active id when it is still among the matches, otherwise falls back to
	 * the first match, or `null` when there are none.
	 */
	#resolveActiveId(): string | null {
		if (this.#activeId !== null && this.isMatch(this.#activeId)) return this.#activeId;

		return this.#matches[0]?.id ?? null;
	}

	/** Moves activation by `delta` positions across `matches`, wrapping around both ends. */
	#moveBy(delta: number): void {
		if (this.#matches.length === 0) {
			this.#setActiveId(null);
			return;
		}

		let index = this.#matches.findIndex((option) => option.id === this.#activeId);

		let nextIndex =
			index === -1
				? delta > 0
					? 0
					: this.#matches.length - 1
				: (index + delta + this.#matches.length) % this.#matches.length;

		let nextOption = this.#matches[nextIndex];

		if (nextOption === undefined) return;

		this.#setActiveId(nextOption.id);
	}

	/** Sets the active id and dispatches `"change"` only when it actually changes. */
	#setActiveId(id: string | null): void {
		if (id === this.#activeId) return;

		this.#activeId = id;
		dispatchChange(this);
	}
}
