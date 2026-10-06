/**
 * Errors a search answers with. `SearchError` covers every failure of a statement this
 * package built, so one `instanceof` check catches them; `ParameterBudgetError` names a
 * query refused before it reached the database, since D1 and SQLite storage cap bindings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A search or reindex statement failed, or could not be built from what the caller composed.
 *
 * The database's own error, when there is one, stays in `cause` for logging.
 *
 * @example
 * if (isFailure(progress) && progress.error instanceof SearchError) return ctx.retry({ cause: progress.error });
 */
export class SearchError extends Error {
	override name = "SearchError";
}

/**
 * A composed search would bind more values than D1 and Durable Object SQLite accept in
 * one statement. It is raised before execution, so a page never fails halfway through.
 */
export class ParameterBudgetError extends SearchError {
	override name = "ParameterBudgetError";

	/** Values the statement would have bound. */
	readonly count: number;

	/** Values one statement may bind. */
	readonly limit: number;

	/**
	 * @param count Values the statement would have bound.
	 * @param limit Values one statement may bind.
	 */
	constructor(count: number, limit: number) {
		super(`A search statement would bind ${count} values, over the limit of ${limit}`);
		this.count = count;
		this.limit = limit;
	}
}
