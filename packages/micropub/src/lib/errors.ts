/**
 * The one failure every Micropub parser returns, so an endpoint answers any rejected
 * request with `invalid_request` and can pass the message on as `error_description`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";

/** Signals a request the spec answers with `invalid_request`, carrying the data-schema issues. */
export class MicropubRequestError extends Error {
	override name = "MicropubRequestError";
	/** Where the body departs from the expected shape; empty for failures outside the body's shape. */
	readonly issues: readonly StandardSchemaV1.Issue[];

	/**
	 * @param message - What was wrong with the request, suitable for `error_description`
	 * @param issues - The data-schema issues behind the failure
	 */
	constructor(message: string, issues: readonly StandardSchemaV1.Issue[] = []) {
		super(message);
		this.issues = issues;
	}
}
