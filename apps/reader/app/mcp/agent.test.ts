/**
 * Checks the two halves of scope: the predicate that keeps a writing tool out of a
 * read-scoped credential's list, and the middleware that refuses one anyway.
 *
 * The second is the backstop, and it is the half no transport test can reach — a tool the
 * predicate hides is already unreachable, so a client working from a list it kept is what
 * this asserts against directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ToolContext } from "@sdxc/mcp";

import { ForbiddenError } from "@sdxc/mcp";
import { RequestContext } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { AgentIdentity } from "~/app/mcp/agent";

import { Agent, agentOf, mayWrite, requireWriteScope } from "~/app/mcp/agent";

/** The tool a call is for, which the middleware carries but never reads. */
const TOOL = {
	name: "mark_read",
	description: "Marks one post read.",
	inputSchema: { type: "object", properties: {} },
} as const;

/** A tool call carrying one verified agent, which is what the route publishes. */
function contextFor(scope: AgentIdentity["scope"]): ToolContext {
	let ctx = new RequestContext(new Request("https://reader.sergiodxa.com/mcp", { method: "POST" }));

	ctx.set(Agent, { subject: "sub-agent", tokenId: "tok_1", scope, tier: "paid" });

	return Object.assign(ctx, { input: {}, tool: TOOL });
}

describe("scope", () => {
	test("hides a writing tool from a read-scoped credential", () => {
		expect(mayWrite(contextFor("read"))).toBe(false);
		expect(mayWrite(contextFor("write"))).toBe(true);
	});

	/** A client working from a list it kept still meets this, as a refusal it cannot act on. */
	test("refuses a writing tool a read-scoped credential reached anyway", () => {
		let next = vi.fn();

		expect(() => requireWriteScope()(contextFor("read"), next)).toThrow(ForbiddenError);
		expect(next).not.toHaveBeenCalled();
	});

	test("lets a write-scoped credential through to the tool", async () => {
		let next = vi.fn(async () => ({ content: [] }));

		await requireWriteScope()(contextFor("write"), next);

		expect(next).toHaveBeenCalledOnce();
	});

	/**
	 * Absent means the route was assembled without the credential middleware, which is a
	 * mistake in the wiring rather than news about the caller.
	 */
	test("raises where the mistake was made when nothing verified the caller", () => {
		let bare = new RequestContext(new Request("https://reader.sergiodxa.com/mcp"));

		expect(() => agentOf(bare)).toThrow(/requireAgent/);
	});
});
