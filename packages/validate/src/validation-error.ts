import type { StandardSchemaV1 } from "@standard-schema/spec";

export class ValidationError extends Error {
	issues: StandardSchemaV1.Issue[];

	constructor(issues: readonly StandardSchemaV1.Issue[]) {
		super("Validation Error");
		this.issues = [...issues];
	}
}
