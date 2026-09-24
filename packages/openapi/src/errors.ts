/**
 * The failures the package reports, kept apart so the builder, the operations, the
 * serializer and the test helpers construct them without importing each other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";

/** Why a document could not be assembled, pointing at the part being built. */
export class OpenAPIBuildError extends Error {
	override name = "OpenAPIBuildError";
	/** The operation being added when the build failed, `null` for a document-level problem. */
	readonly operationId: string | null;
	/** A JSON Pointer into the document being built. */
	readonly pointer: string;

	/**
	 * @param message - What made the document unbuildable.
	 * @param operationId - The operation at fault, or `null`.
	 * @param pointer - Where in the document the failure sits.
	 * @param options - Native error options, carrying a schema conversion failure as `cause`.
	 */
	constructor(
		message: string,
		operationId: string | null,
		pointer: string,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.operationId = operationId;
		this.pointer = pointer;
	}
}

/** Why text could not be read as an OpenAPI 3.1 document. */
export class OpenAPIParseError extends Error {
	override name = "OpenAPIParseError";
}

/** Why a document could not be written in the requested format. */
export class OpenAPIStringifyError extends Error {
	override name = "OpenAPIStringifyError";
}

/**
 * A request whose params, query or body failed the operation's schema, carrying the
 * Standard Schema issues so a handler can answer with a validation problem.
 */
export class OperationInputError extends Error {
	override name = "OperationInputError";
	readonly location: "params" | "query" | "body";
	readonly issues: readonly StandardSchemaV1.Issue[];

	/**
	 * @param location - Which part of the request failed.
	 * @param issues - The schema's issues, paths relative to that part.
	 */
	constructor(location: "params" | "query" | "body", issues: readonly StandardSchemaV1.Issue[]) {
		super(`Invalid request ${location}: ${issues.map((issue) => issue.message).join("; ")}`);
		this.location = location;
		this.issues = issues;
	}
}
