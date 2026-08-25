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
 * A tool ran and could not complete — the post does not exist, the target refused the
 * connection, the caller asked for a page past the end.
 *
 * Its message reaches the model verbatim, so write it as guidance rather than as a log
 * line: state what was wrong and, where there is one, what would work. Every other
 * exception is reported to the model as a generic failure, since an unexpected error's
 * message is written for an operator and can carry detail the caller must not read.
 */
export class ToolError extends Error {
	override readonly name = "ToolError";
}

/**
 * A tool call is not permitted for this caller, reported as a protocol error.
 *
 * Reaching it means a call got past the `available` predicate that should already have
 * hidden the tool, so it is the backstop for a client working from a stale tool list
 * rather than the normal way a permission is enforced. Refusing the *request* — no
 * credential at all — is the surrounding remix middleware's job, not a tool's.
 */
export class ForbiddenError extends Error {
	override readonly name = "ForbiddenError";
}

/**
 * Arguments did not satisfy a tool's declared schema.
 *
 * Mapped to JSON-RPC `-32602` and never surfaced as a tool result: a call whose
 * arguments do not typecheck never reached the handler, so there is no outcome to
 * report.
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
