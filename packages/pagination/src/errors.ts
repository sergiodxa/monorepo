/**
 * Error values returned by every failing operation in this package.
 *
 * All of them extend `PaginationError`, so one `instanceof` check covers paging
 * while the subclasses let a route tell a client's bad cursor (answer `400`)
 * apart from a database that refused the query (answer `500`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Base class for every error this package returns inside a `Result`.
 *
 * Use it as the error type in signatures and as the `instanceof` check when the
 * specific cause does not change the caller's behavior.
 *
 * @example
 * if (isFailure(page) && page.error instanceof PaginationError) renderUnavailable();
 */
export class PaginationError extends Error {
	override name = "PaginationError";
}

/**
 * A cursor could not be decoded, or does not describe the current ordering.
 *
 * Cursors are client-supplied, so this is a `400`-path validation failure whose
 * message is fixed text, keeping untrusted client bytes out of the logs.
 *
 * @example
 * // failure(new InvalidCursorError("not base64url"))
 * await Pagination.byKeyset(query, { orderBy, after: "%%%", limit: 25 });
 */
export class InvalidCursorError extends PaginationError {
	override name = "InvalidCursorError";

	/**
	 * @param reason Fixed description of the structural problem, free of client input.
	 */
	constructor(reason: string) {
		super(`Invalid cursor: ${reason}`);
	}
}

/**
 * A keyset ordering cannot page deterministically.
 *
 * Raised before any query runs, catching an ordering without a unique tiebreaker
 * before rows sharing a sort value are silently skipped or repeated.
 *
 * @example
 * // failure(new InvalidOrderingError(...)): one non-unique sort key
 * await Pagination.byKeyset(query, { orderBy: [["created_at", "desc"]], limit: 25 });
 */
export class InvalidOrderingError extends PaginationError {
	override name = "InvalidOrderingError";

	/**
	 * @param reason Fixed description of why the ordering was rejected.
	 */
	constructor(reason: string) {
		super(`Invalid keyset ordering: ${reason}`);
	}
}

/**
 * The underlying query rejected or failed to execute.
 *
 * The original throw is kept in `cause` for logging, while the response-facing
 * message stays generic, keeping database error strings out of client output.
 */
export class QueryFailedError extends PaginationError {
	override name = "QueryFailedError";

	/**
	 * @param cause The value the query builder threw, preserved for logging.
	 */
	constructor(cause: unknown) {
		super("Pagination query failed", { cause });
	}
}

/**
 * Keyset cursors travel as text, so only strings, finite numbers, and booleans
 * round-trip; a `null` sort value breaks the seek predicate, since no SQL
 * comparison against `NULL` is ever true.
 */
export class UnencodableCursorValueError extends PaginationError {
	override name = "UnencodableCursorValueError";

	/**
	 * @param column Ordering column whose value could not be encoded.
	 */
	constructor(column: string) {
		super(`Cannot encode a cursor for column "${column}": value is null or not a primitive`);
	}
}
