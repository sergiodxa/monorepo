/**
 * Search over tables an app declares: query parsing, safe FTS5 and `LIKE` matching,
 * field-weighted ranking, highlighting and batched reindexing, exposed as a query that
 * `@sdxc/pagination` pages like any other list. The app owns every table and migration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	Excerpt,
	ExcerptOptions,
	HighlightOptions,
	HighlightSegment,
	ParsedQuery,
	ParseQueryOptions,
	SearchClause,
	SearchFilter,
	SearchTerm,
} from "./query.js";
export type {
	DefineSearchOptions,
	ReindexOptions,
	ReindexProgress,
	Search,
	SearchColumn,
	SearchColumnName,
	SearchFts,
	SearchPredicateOptions,
	SearchQuery,
	SearchRow,
	SearchWhere,
} from "./search.js";

export { ParameterBudgetError, SearchError } from "./errors.js";
export {
	DEFAULT_MAX_QUERY_LENGTH,
	DEFAULT_MAX_QUERY_TERMS,
	excerpt,
	highlight,
	parseQuery,
} from "./query.js";
export { defineSearch, MAX_BOUND_PARAMETERS } from "./search.js";
