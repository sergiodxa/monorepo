/**
 * Carries the Standard Schema issues from a failed `validate()` call as a
 * typed `Error`, so callers can pattern-match on it in a `Result`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";

export class ValidationError extends Error {
	issues: StandardSchemaV1.Issue[];

	constructor(issues: readonly StandardSchemaV1.Issue[]) {
		super("Validation Error");
		this.issues = [...issues];
	}
}
