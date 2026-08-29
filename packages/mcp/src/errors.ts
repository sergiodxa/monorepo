/**
 * The errors a host application throws to steer a response, and the ones the
 * transport raises when a request does not satisfy the protocol.
 *
 * The split that matters is where MCP reports each category. A protocol error is a
 * JSON-RPC error the model never sees; a tool that ran and could not do what was asked
 * answers with an ordinary result carrying `isError`, which the model reads and can
 * act on. Putting one in the other's place either hides a recoverable failure from the
 * model or shows it an operator's stack trace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A tool ran and could not complete — the post does not exist, the connection was
 * refused, the caller asked for a page past the end. Its message reaches the model
 * verbatim, so it must read as actionable guidance: what went wrong, and what would work.
 */
export class ToolError extends Error {
	override readonly name = "ToolError";
}

/**
 * A tool call is not permitted for this caller, reported as a protocol error.
 *
 * Reaching it means a call got past the `available` predicate meant to hide the tool — a backstop for a
 * stale client list, since remix middleware already blocks a credential-less request earlier in the chain.
 */
export class ForbiddenError extends Error {
	override readonly name = "ForbiddenError";
}

/**
 * Arguments did not satisfy a tool's declared schema.
 *
 * Reported to the client as JSON-RPC error `-32602`, raised before the handler runs; each
 * instance carries exactly the constraint failures that stopped the call before the handler could run.
 */
export class InvalidArgumentsError extends Error {
	override readonly name = "InvalidArgumentsError";

	/** One entry per failed constraint, each naming the property path it applies to. */
	readonly issues: readonly string[];

	/** @param issues Human-readable constraint failures, in declaration order. */
	constructor(issues: readonly string[]) {
		super(`Invalid arguments: ${issues.join("; ")}`);
		this.issues = issues;
	}
}
