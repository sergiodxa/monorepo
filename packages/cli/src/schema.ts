/**
 * Runs a Standard Schema over one command-line value, synchronous or asynchronous alike, and
 * answers its output or the issue messages, so every argument, flag and prompt answer is checked
 * by the schema it was declared with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, success } from "@sdxc/result";

/** A value's issues, each as the message the user reads after the input's name. */
export class SchemaIssues extends Error {
	override name = "SchemaIssues";

	/** One message per issue, in the order the schema reported them. */
	messages: readonly string[];

	/** @param messages - The schema's issue messages */
	constructor(messages: readonly string[]) {
		super(messages.join("; "));
		this.messages = messages;
	}
}

/**
 * `value` checked by `schema`, or its issues. A missing schema accepts the value unchanged.
 *
 * @param schema - Any Standard Schema
 * @param value - What the command line, a prompt or a default supplied
 */
export async function validate(
	schema: StandardSchemaV1 | undefined,
	value: unknown,
): Promise<Result<unknown, SchemaIssues>> {
	if (schema === undefined) return success(value);
	let outcome = await schema["~standard"].validate(value);
	if (outcome.issues === undefined) return success(outcome.value);
	return failure(new SchemaIssues(outcome.issues.map((issue) => issue.message)));
}

/** The output type of a Standard Schema. */
export type SchemaOutput<Schema> =
	Schema extends StandardSchemaV1<infer _Input, infer Output> ? Output : never;
