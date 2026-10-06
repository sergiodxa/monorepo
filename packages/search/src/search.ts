/**
 * Search over a table the app declares: `defineSearch` describes it, and the definition
 * builds FTS5 or `LIKE` statements a pager can page, a match fragment for statements the
 * app writes itself, and the idempotent batches that fill an FTS5 index from its source.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeysetQuery, OffsetQuery, OrderDirection } from "@sdxc/pagination";
import type { Result } from "@sdxc/result";
import type {
	AnyTable,
	Database,
	Predicate,
	SqlStatement,
	TableColumnName,
	TableRow,
	WhereInput,
} from "remix/data-table";

import { failure, success } from "@sdxc/result";
import {
	eq,
	getTableColumnDefinitions,
	getTableName,
	getTablePrimaryKey,
	rawSql,
} from "remix/data-table";

import type { ParsedQuery, SearchTerm } from "./query.js";

import { ParameterBudgetError, SearchError } from "./errors.js";

/** Values D1 and Durable Object SQLite bind in one statement at most. */
export const MAX_BOUND_PARAMETERS = 100;

/** Source rows one `reindex` call writes when `limit` is not given. */
const DEFAULT_REINDEX_LIMIT = 500;

/** Characters a `trigram` index needs in a term before it can answer it. */
const TRIGRAM_LENGTH = 3;

/** The CTE the FTS5 statement reads matches from, named apart from any app column. */
const HITS = `"search_hits"`;

/** How the FTS5 statement refers to a match's score, a plain column FTS5 never reinterprets. */
const HITS_RANK = `${HITS}."search_rank"`;

/** One searched column and how much a match in it counts. */
export interface SearchColumn<Column extends string> {
	/** A column of the described table, in the FTS5 table's declaration order. */
	name: Column;
	/** A positive multiplier; a column weighted 10 outranks one weighted 1 for the same match. */
	weight: number;
}

/** The FTS5 table an app keeps beside its source table. */
export interface SearchFts {
	/** The virtual table's name, as the app's migration creates it. */
	table: string;
	/**
	 * The tokenizer the virtual table declares. `"unicode61"` is assumed to carry
	 * `remove_diacritics 2`; `"trigram"` matches substrings of three characters or more.
	 *
	 * @default "unicode61"
	 */
	tokenizer?: "unicode61" | "trigram";
}

/**
 * A searchable table: which columns to match with which weights, and the FTS5 table, if
 * any, whose `rowid` mirrors `key`. Without `fts`, every query runs as `LIKE`.
 *
 * @template Source The app's own `table()` value.
 */
export interface DefineSearchOptions<Source extends AnyTable> {
	/** The source table, whose rows a search returns. */
	table: Source;
	/**
	 * The column identifying a row; with `fts`, an integer column the index's `rowid` mirrors.
	 *
	 * @default the table's primary key
	 */
	key?: TableColumnName<Source>;
	/** Searched columns, in the order the FTS5 table declares them, since `bm25()` weighs by position. */
	columns: readonly SearchColumn<TableColumnName<Source>>[];
	/** The FTS5 index over the same columns, when the app keeps one. */
	fts?: SearchFts;
}

/** A source row as a search returns it: every table column, plus a score where lower is better. */
export type SearchRow<Source extends AnyTable> = TableRow<Source> & { rank: number };

/** A column a search query can filter or order by: the table's own, or `rank`. */
export type SearchColumnName<Source extends AnyTable> = TableColumnName<Source> | "rank";

/** A filter a search query accepts: a `remix/data-table` predicate or object, or a `sql` fragment. */
export type SearchWhere<Source extends AnyTable> =
	| WhereInput<SearchColumnName<Source>>
	| SqlStatement;

/** Options for a match fragment embedded in a statement the app writes. */
export interface SearchPredicateOptions {
	/**
	 * The name the statement gives the source table, which the fragment's columns are qualified with.
	 *
	 * @default the table's name
	 */
	alias?: string;
}

/** Where one `reindex` call starts, and how much it writes. */
export interface ReindexOptions {
	/** The last key a previous call indexed, or `null` to start below every key. */
	after?: number | null;
	/**
	 * Source rows this call writes.
	 *
	 * @default 500
	 */
	limit?: number;
}

/** What one `reindex` call wrote, and where the next one starts. */
export interface ReindexProgress {
	/** Source rows written into the index. */
	indexed: number;
	/** The `after` for the next call, or `null` once every row is indexed. */
	next: number | null;
}

/**
 * A described table, frozen, holding no connection and no rows, so one module-level
 * definition serves every tenant's database.
 *
 * @template Source The app's own `table()` value.
 */
export interface Search<Source extends AnyTable> {
	/** The source table. */
	readonly table: Source;
	/** The column identifying a row, and the one the FTS5 `rowid` mirrors. */
	readonly key: TableColumnName<Source>;
	/**
	 * A query matching `query`, ordered best first unless `orderBy` says otherwise, ready
	 * for `Pagination.byOffset` or `Pagination.byKeyset`.
	 *
	 * @param db The database the source table lives in, usually `ctx.db`.
	 * @param query A query from `parseQuery`.
	 */
	query(db: Database, query: ParsedQuery): SearchQuery<Source>;
	/**
	 * The match alone, as a `sql` fragment for a statement the app writes itself. It carries
	 * no `rank`.
	 *
	 * @param query A query from `parseQuery`.
	 * @param options The alias the statement gives the source table.
	 */
	predicate(query: ParsedQuery, options?: SearchPredicateOptions): SqlStatement;
	/**
	 * Writes the next `limit` source rows above `after` into the FTS5 index. Every write is
	 * complete on its own and idempotent, so a call that fails or runs twice leaves the
	 * index correct. It needs an index that accepts `insert or replace` by `rowid`.
	 *
	 * @param db The database the source and index live in.
	 * @param options Where to start, and how many rows to write.
	 */
	reindex(db: Database, options?: ReindexOptions): Promise<Result<ReindexProgress, SearchError>>;
}

/** A definition reduced to the names and numbers statements are built from. */
interface Plan {
	tableName: string;
	key: string;
	columns: readonly SearchColumn<string>[];
	fts: Required<SearchFts> | null;
	known: ReadonlySet<string>;
	json: ReadonlySet<string>;
	booleans: ReadonlySet<string>;
}

/**
 * Describes a searchable table. The description is fixed at module scope, so a mistake in
 * it is thrown rather than returned.
 *
 * @param options The source table, its searched columns and weights, and its FTS5 table.
 * @returns A frozen definition that queries, builds match fragments and reindexes.
 * @throws RangeError for empty `columns`, a non-positive weight, a column the table lacks,
 * a table holding a column named `rank`, a key that is not one column, or a non-integer key with `fts`.
 * @example
 * let articleSearch = defineSearch({ table: articles, columns: [{ name: "title", weight: 10 }], fts: { table: "articles_fts" } });
 */
export function defineSearch<Source extends AnyTable>(
	options: DefineSearchOptions<Source>,
): Search<Source> {
	let plan = toPlan(options);
	let key = plan.key as TableColumnName<Source>;

	return Object.freeze({
		table: options.table,
		key,
		query(db: Database, query: ParsedQuery): SearchQuery<Source> {
			return new ComposedSearch<Source>(db, plan, query, EMPTY_STATE);
		},
		predicate(query: ParsedQuery, predicateOptions?: SearchPredicateOptions): SqlStatement {
			return matchPredicate(plan, query, predicateOptions?.alias ?? plan.tableName);
		},
		reindex(
			db: Database,
			reindexOptions?: ReindexOptions,
		): Promise<Result<ReindexProgress, SearchError>> {
			return reindex(db, plan, reindexOptions ?? {});
		},
	});
}

/** Validates a description and reduces it to a {@link Plan}. */
function toPlan<Source extends AnyTable>(options: DefineSearchOptions<Source>): Plan {
	let tableName: string = getTableName(options.table);
	let definitions: Record<string, { type: string }> = getTableColumnDefinitions(options.table);
	let known = new Set(Object.keys(definitions));

	if (known.has("rank")) {
		throw new RangeError(`${tableName} declares a column named rank, which a search returns.`);
	}

	if (options.columns.length === 0) {
		throw new RangeError("A search needs at least one column.");
	}

	let seen = new Set<string>();
	for (let column of options.columns) {
		if (!known.has(column.name)) {
			throw new RangeError(`${tableName} declares no column named ${column.name}.`);
		}
		if (seen.has(column.name)) {
			throw new RangeError(`${column.name} appears more than once in columns.`);
		}
		if (!(Number.isFinite(column.weight) && column.weight > 0)) {
			throw new RangeError(`${column.name} needs a positive weight, received ${column.weight}.`);
		}
		seen.add(column.name);
	}

	let key = options.key ?? singleKey(tableName, getTablePrimaryKey(options.table));
	if (!known.has(key)) throw new RangeError(`${tableName} declares no column named ${key}.`);

	let fts: Required<SearchFts> | null = null;
	if (options.fts !== undefined) {
		if (options.fts.table.trim().length === 0) {
			throw new RangeError("fts.table needs the FTS5 table's name.");
		}

		let type = definitions[key]?.type;
		if (type !== "integer" && type !== "bigint") {
			throw new RangeError(`${key} mirrors the FTS5 rowid, so it needs an integer column.`);
		}

		fts = { table: options.fts.table, tokenizer: options.fts.tokenizer ?? "unicode61" };
	}

	let json = new Set<string>();
	let booleans = new Set<string>();
	for (let [name, definition] of Object.entries(definitions)) {
		if (definition.type === "json") json.add(name);
		if (definition.type === "boolean") booleans.add(name);
	}

	return {
		tableName,
		key,
		columns: options.columns.map((column) => ({ name: column.name, weight: column.weight })),
		fts,
		known,
		json,
		booleans,
	};
}

/** The one primary key column a search can default to. */
function singleKey(tableName: string, primaryKey: readonly string[]): string {
	let [only] = primaryKey;
	if (primaryKey.length !== 1 || only === undefined) {
		throw new RangeError(`${tableName} has no single-column primary key, so key is required.`);
	}
	return only;
}

/** Everything a search query has composed beyond the match itself. */
interface QueryState {
	wheres: readonly (Predicate | SqlStatement)[];
	orderBy: readonly (readonly [string, OrderDirection])[];
	limit: number | null;
	offset: number | null;
}

/** The state of a query nobody has narrowed, ordered or limited yet. */
const EMPTY_STATE: QueryState = Object.freeze({
	wheres: [],
	orderBy: [],
	limit: null,
	offset: null,
});

/**
 * A search as a composable query: `where`, `orderBy`, `limit` and `offset` each return a
 * new query, and `all` and `count` run one statement each. Without `orderBy` it orders by
 * `rank`, then key, both ascending, so the best match comes first.
 *
 * `all` and `count` reject with a `SearchError` rather than answering a `Result`, since
 * pagers expect the query builder's contract; `Pagination` turns the rejection into a
 * `QueryFailedError`.
 *
 * @template Source The app's own `table()` value.
 */
export interface SearchQuery<Source extends AnyTable>
	extends
		OffsetQuery<SearchRow<Source>>,
		KeysetQuery<SearchRow<Source>, SearchWhere<Source>, SearchColumnName<Source>> {
	/**
	 * Narrows the matches further. Predicate columns must belong to the source table or be
	 * `rank`; a `sql` fragment is used as written, inside parentheses.
	 *
	 * @param input A predicate, a `{ column: value }` object, or a `sql` fragment.
	 */
	where(input: SearchWhere<Source>): SearchQuery<Source>;
	/**
	 * Appends a sort key. The first call replaces the default best-match ordering.
	 *
	 * @param column A source column, or `rank`.
	 * @param direction `"asc"` or `"desc"`.
	 */
	orderBy(column: SearchColumnName<Source>, direction: OrderDirection): SearchQuery<Source>;
	/** Reads at most `value` rows. */
	limit(value: number): SearchQuery<Source>;
	/** Skips the first `value` rows. */
	offset(value: number): SearchQuery<Source>;
	/**
	 * Runs the search, ignoring `limit` and `offset`, and counts the matches.
	 *
	 * @throws SearchError when the statement cannot be built or the database refuses it.
	 */
	count(): Promise<number>;
	/**
	 * Runs the search and reads the rows, decoding JSON and boolean columns as the table declares them.
	 *
	 * @throws SearchError when the statement cannot be built or the database refuses it.
	 */
	all(): Promise<SearchRow<Source>[]>;
}

/** The one implementation of {@link SearchQuery}, holding its database and composed state. */
class ComposedSearch<Source extends AnyTable> implements SearchQuery<Source> {
	#db: Database;
	#plan: Plan;
	#query: ParsedQuery;
	#state: QueryState;

	/**
	 * @param db The database the source table lives in.
	 * @param plan The definition's reduced description.
	 * @param query The parsed query to match.
	 * @param state Filters, ordering and window composed so far.
	 */
	constructor(db: Database, plan: Plan, query: ParsedQuery, state: QueryState) {
		this.#db = db;
		this.#plan = plan;
		this.#query = query;
		this.#state = state;
	}

	where(input: SearchWhere<Source>): SearchQuery<Source> {
		let clause = isSqlStatement(input) ? input : normalizeWhere(input as WhereInput);
		return this.#with({ wheres: [...this.#state.wheres, clause] });
	}

	orderBy(column: SearchColumnName<Source>, direction: OrderDirection): SearchQuery<Source> {
		return this.#with({ orderBy: [...this.#state.orderBy, [column, direction]] });
	}

	limit(value: number): SearchQuery<Source> {
		return this.#with({ limit: value });
	}

	offset(value: number): SearchQuery<Source> {
		return this.#with({ offset: value });
	}

	async count(): Promise<number> {
		let rows = await this.#run("count");
		return Number(rows[0]?.count ?? 0);
	}

	async all(): Promise<SearchRow<Source>[]> {
		let rows = await this.#run("rows");
		return rows.map((row) => decodeRow(this.#plan, row) as SearchRow<Source>);
	}

	/** Builds the statement, checks it against the parameter budget, and runs it. */
	async #run(shape: "rows" | "count"): Promise<Record<string, unknown>[]> {
		let statement: SqlStatement;
		try {
			statement = buildStatement(this.#plan, this.#query, this.#state, shape);
		} catch (error) {
			if (error instanceof SearchError) throw error;
			throw new SearchError("A search statement could not be built", { cause: error });
		}

		if (statement.values.length > MAX_BOUND_PARAMETERS) {
			throw new ParameterBudgetError(statement.values.length, MAX_BOUND_PARAMETERS);
		}

		try {
			let result = await this.#db.exec(statement);
			return result.rows ?? [];
		} catch (error) {
			throw new SearchError("A search statement failed", { cause: error });
		}
	}

	/** A copy of this query with part of its state replaced. */
	#with(change: Partial<QueryState>): SearchQuery<Source> {
		return new ComposedSearch<Source>(this.#db, this.#plan, this.#query, {
			...this.#state,
			...change,
		});
	}
}

/** Whether a value is a `sql` fragment rather than a predicate or a `{ column: value }` object. */
function isSqlStatement(value: unknown): value is SqlStatement {
	if (typeof value !== "object" || value === null) return false;
	let candidate = value as Partial<SqlStatement>;
	return typeof candidate.text === "string" && Array.isArray(candidate.values);
}

/** Turns `{ column: value }` shorthand into the `and` of equalities it stands for. */
function normalizeWhere(input: WhereInput): Predicate {
	if (isPredicate(input)) return input;

	let predicates = Object.entries(input).map(([column, value]) => eq(column, value));
	let [only] = predicates;
	if (predicates.length === 1 && only !== undefined) return only;

	return { type: "logical", operator: "and", predicates };
}

/** Whether a where input is already a predicate tree. */
function isPredicate(input: WhereInput): input is Predicate {
	let type = (input as { type?: unknown }).type;
	return type === "comparison" || type === "between" || type === "null" || type === "logical";
}

/** Whether a query runs against the FTS5 index or as `LIKE`. */
type Strategy = "fts" | "like";

/**
 * Picks the strategy for one query. A `trigram` index cannot answer a term shorter than
 * three characters, so such a query runs as `LIKE`, which finds every substring.
 */
function strategyOf(plan: Plan, query: ParsedQuery): Strategy {
	if (plan.fts === null) return "like";
	if (plan.fts.tokenizer !== "trigram") return "fts";

	let short = query.terms.some((term) => Array.from(term.text).length < TRIGRAM_LENGTH);
	return short ? "like" : "fts";
}

/** Quotes an SQL identifier, doubling any quote inside it. */
function quote(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}

/**
 * Builds the statement for one search, binding every value in the order its placeholder
 * appears: the match, the score, the filters, then the window.
 */
function buildStatement(
	plan: Plan,
	query: ParsedQuery,
	state: QueryState,
	shape: "rows" | "count",
): SqlStatement {
	let strategy = strategyOf(plan, query);
	let table = quote(plan.tableName);
	let rankRef = strategy === "fts" ? HITS_RANK : `"rank"`;
	let text: string[] = [];
	let values: unknown[] = [];

	let selection: SqlStatement;
	let from: string;
	let conditions: SqlStatement[] = [];

	if (strategy === "fts" && plan.fts !== null) {
		let fts = quote(plan.fts.table);
		let weights = plan.columns.map((column) => String(column.weight)).join(", ");

		text.push(
			`with ${HITS} as (select "rowid" as "search_key", bm25(${fts}, ${weights}) as "search_rank" from ${fts} where ${fts} match ?)`,
		);
		values.push(ftsMatch(query, plan.fts.tokenizer));

		selection = rawSql(`${table}.*, ${HITS_RANK} as "rank"`);
		from = `${HITS} cross join ${table} on ${table}.${quote(plan.key)} = ${HITS}."search_key"`;
	} else {
		selection = likeScore(plan, query, table);
		from = table;
		conditions.push(likeMatch(plan, query, table));
	}

	for (let clause of state.wheres) {
		conditions.push(
			isSqlStatement(clause) ? clause : compilePredicate(plan, clause, table, rankRef),
		);
	}

	let where =
		conditions.length === 0
			? rawSql("1 = 1")
			: rawSql(
					conditions.map((condition) => `(${condition.text})`).join(" and "),
					conditions.flatMap((condition) => condition.values),
				);

	let inner = `select ${selection.text} from ${from} where ${where.text}`;

	if (shape === "count") {
		text.push(`select count(*) as "count" from (${inner})`);
		values.push(...selection.values, ...where.values);
		return rawSql(text.join(" "), values);
	}

	let ordering: readonly (readonly [string, OrderDirection])[] =
		state.orderBy.length === 0
			? [
					["rank", "asc"],
					[plan.key, "asc"],
				]
			: state.orderBy;
	let orderBy = ordering
		.map(([column, direction]) => {
			let ref = columnRef(plan, column, table, rankRef);
			return `${ref} ${direction === "desc" ? "desc" : "asc"}`;
		})
		.join(", ");

	text.push(`${inner} order by ${orderBy}`);
	values.push(...selection.values, ...where.values);

	if (state.limit !== null || state.offset !== null) {
		text.push("limit ?");
		values.push(state.limit === null ? -1 : Math.max(0, Math.trunc(state.limit)));
	}

	if (state.offset !== null) {
		text.push("offset ?");
		values.push(Math.max(0, Math.trunc(state.offset)));
	}

	return rawSql(text.join(" "), values);
}

/**
 * The FTS5 `MATCH` argument for a query: every term double-quoted with inner quotes
 * doubled, so no user text is read as query syntax. Positives join as an implicit `AND`,
 * and each exclusion follows as `NOT`, since FTS5 rejects a query opening with one.
 */
function ftsMatch(query: ParsedQuery, tokenizer: "unicode61" | "trigram"): string {
	let compile = (term: SearchTerm): string => {
		let quoted = `"${term.text.replaceAll('"', '""')}"`;
		return term.prefix && tokenizer === "unicode61" ? `${quoted}*` : quoted;
	};

	let positives = query.terms.filter((term) => !term.exclude).map(compile);
	let exclusions = query.terms.filter((term) => term.exclude).map(compile);

	if (exclusions.length === 0) return positives.join(" ");
	return [`(${positives.join(" ")})`, ...exclusions.map((term) => `NOT ${term}`)].join(" ");
}

/**
 * A term as a `LIKE` pattern that finds exactly its text: the escape character is escaped
 * first, then `%` and `_`, so none of them act as wildcards.
 */
function likePattern(term: SearchTerm): string {
	let escaped = term.text.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
	return `%${escaped}%`;
}

/** One column tested against one pattern, escaping with a literal `\` so no value binds for it. */
function likeTest(qualified: string): string {
	return `${qualified} like ? escape '\\'`;
}

/**
 * The `LIKE` match: every positive term found in some column, and no excluded term found
 * in any. `coalesce` keeps a `NULL` column from turning an exclusion into an unknown.
 */
function likeMatch(plan: Plan, query: ParsedQuery, qualifier: string): SqlStatement {
	let clauses: string[] = [];
	let values: unknown[] = [];

	for (let term of query.terms) {
		let pattern = likePattern(term);
		let tests = plan.columns.map((column) => likeTest(`${qualifier}.${quote(column.name)}`));
		values.push(...plan.columns.map(() => pattern));

		let any = `(${tests.join(" or ")})`;
		clauses.push(term.exclude ? `not coalesce(${any}, 0)` : any);
	}

	return rawSql(clauses.join(" and "), values);
}

/**
 * The `LIKE` score: the negated weighted count of columns each positive term hit, so
 * `rank asc` puts the best match first with the sign `bm25()` uses.
 */
function likeScore(plan: Plan, query: ParsedQuery, table: string): SqlStatement {
	let parts: string[] = [];
	let values: unknown[] = [];

	for (let term of query.terms) {
		if (term.exclude) continue;
		let pattern = likePattern(term);

		for (let column of plan.columns) {
			parts.push(`${column.weight} * coalesce(${likeTest(`${table}.${quote(column.name)}`)}, 0)`);
			values.push(pattern);
		}
	}

	return rawSql(`${table}.*, -(${parts.join(" + ")}) as "rank"`, values);
}

/** The match alone, qualified to `alias`, for a statement the app writes. */
function matchPredicate(plan: Plan, query: ParsedQuery, alias: string): SqlStatement {
	let qualifier = quote(alias);

	if (strategyOf(plan, query) === "fts" && plan.fts !== null) {
		let fts = quote(plan.fts.table);
		return rawSql(
			`${qualifier}.${quote(plan.key)} in (select "rowid" from ${fts} where ${fts} match ?)`,
			[ftsMatch(query, plan.fts.tokenizer)],
		);
	}

	let match = likeMatch(plan, query, qualifier);
	return rawSql(`(${match.text})`, match.values);
}

/**
 * A column as the statement spells it: `rank` as the score, anything else qualified to the
 * source table, so a filter can never reach a column the table does not declare.
 */
function columnRef(plan: Plan, column: string, table: string, rankRef: string): string {
	if (column === "rank") return rankRef;

	let prefix = `${plan.tableName}.`;
	let bare = column.startsWith(prefix) ? column.slice(prefix.length) : column;
	if (!plan.known.has(bare)) {
		throw new SearchError(`${plan.tableName} declares no column named ${column}`);
	}

	return `${table}.${quote(bare)}`;
}

/** Comparison operators as SQL, for those that compile to `column op value`. */
const COMPARISON_OPERATORS: Readonly<Record<string, string>> = {
	eq: "=",
	ne: "<>",
	gt: ">",
	gte: ">=",
	lt: "<",
	lte: "<=",
	like: "like",
};

/**
 * Compiles a `remix/data-table` predicate to SQL over the source table, binding values the
 * way the SQLite adapters do: booleans as `1` and `0`, and `null` equality as `is null`.
 */
function compilePredicate(
	plan: Plan,
	predicate: Predicate,
	table: string,
	rankRef: string,
): SqlStatement {
	let ref = (column: string) => columnRef(plan, column, table, rankRef);

	if (predicate.type === "logical") {
		if (predicate.predicates.length === 0) {
			return rawSql(predicate.operator === "and" ? "1 = 1" : "1 = 0");
		}

		let parts = predicate.predicates.map((nested) =>
			compilePredicate(plan, nested, table, rankRef),
		);
		return rawSql(
			parts.map((part) => `(${part.text})`).join(` ${predicate.operator} `),
			parts.flatMap((part) => part.values),
		);
	}

	if (predicate.type === "null") {
		return rawSql(
			`${ref(predicate.column)} ${predicate.operator === "isNull" ? "is null" : "is not null"}`,
		);
	}

	if (predicate.type === "between") {
		return rawSql(`${ref(predicate.column)} between ? and ?`, [
			bindable(predicate.lower),
			bindable(predicate.upper),
		]);
	}

	let column = ref(predicate.column);

	if (predicate.valueType === "column") {
		let other = ref(predicate.value);
		if (predicate.operator === "ilike") return rawSql(`lower(${column}) like lower(${other})`);
		return rawSql(`${column} ${COMPARISON_OPERATORS[predicate.operator] ?? "="} ${other}`);
	}

	let { operator, value } = predicate;

	if (operator === "in" || operator === "notIn") {
		let list = Array.isArray(value) ? value : [];
		if (list.length === 0) return rawSql(operator === "in" ? "1 = 0" : "1 = 1");

		let placeholders = list.map(() => "?").join(", ");
		return rawSql(
			`${column} ${operator === "in" ? "in" : "not in"} (${placeholders})`,
			list.map(bindable),
		);
	}

	if ((operator === "eq" || operator === "ne") && (value === null || value === undefined)) {
		return rawSql(`${column} ${operator === "eq" ? "is null" : "is not null"}`);
	}

	if (operator === "ilike") return rawSql(`lower(${column}) like lower(?)`, [bindable(value)]);

	return rawSql(`${column} ${COMPARISON_OPERATORS[operator] ?? "="} ?`, [bindable(value)]);
}

/** A value as SQLite binds it: booleans become the integers the adapters store them as. */
function bindable(value: unknown): unknown {
	if (typeof value === "boolean") return value ? 1 : 0;
	return value;
}

/**
 * Restores the JS types SQLite cannot store natively, as the adapters do for a typed read:
 * JSON text becomes a value again and `0`/`1` become booleans, leaving `null` alone.
 */
function decodeRow(plan: Plan, row: Record<string, unknown>): Record<string, unknown> {
	let decoded: Record<string, unknown> = { ...row, rank: Number(row.rank) };

	for (let column of plan.json) {
		let value = decoded[column];
		if (typeof value !== "string") continue;
		try {
			decoded[column] = JSON.parse(value);
		} catch {
			decoded[column] = value;
		}
	}

	for (let column of plan.booleans) {
		let value = decoded[column];
		if (typeof value === "number") decoded[column] = value !== 0;
		else if (typeof value === "bigint") decoded[column] = value !== 0n;
	}

	return decoded;
}

/**
 * Writes one batch of source rows into the FTS5 index: it reads the batch's highest key,
 * then copies every row up to it with `insert or replace`, so each statement is complete
 * on its own and a repeated batch rewrites the same values.
 */
async function reindex(
	db: Database,
	plan: Plan,
	options: ReindexOptions,
): Promise<Result<ReindexProgress, SearchError>> {
	if (plan.fts === null) {
		return failure(new SearchError(`${plan.tableName}'s search declares no FTS5 table to reindex`));
	}

	let table = quote(plan.tableName);
	let key = quote(plan.key);
	let fts = quote(plan.fts.table);
	let after = options.after ?? null;
	let limit = Math.max(1, Math.trunc(options.limit ?? DEFAULT_REINDEX_LIMIT));
	let lower = after === null ? "" : `where ${key} > ?`;
	let lowerValues = after === null ? [] : [after];

	try {
		let range = await db.exec(
			rawSql(
				`select count(*) as "count", max("k") as "last" from (select ${key} as "k" from ${table} ${lower} order by ${key} asc limit ?)`,
				[...lowerValues, limit],
			),
		);

		let indexed = Number(range.rows?.[0]?.count ?? 0);
		let last = range.rows?.[0]?.last;
		if (indexed === 0 || last === null || last === undefined) {
			return success({ indexed: 0, next: null });
		}

		let columns = plan.columns.map((column) => quote(column.name)).join(", ");
		let bounds = after === null ? `${key} <= ?` : `${key} > ? and ${key} <= ?`;

		await db.exec(
			rawSql(
				`insert or replace into ${fts} ("rowid", ${columns}) select ${key}, ${columns} from ${table} where ${bounds}`,
				[...lowerValues, last],
			),
		);

		return success({ indexed, next: indexed < limit ? null : Number(last) });
	} catch (error) {
		return failure(new SearchError("Reindexing failed", { cause: error }));
	}
}
