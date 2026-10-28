/**
 * Checks the two halves of scope, both decided by the access the route binds: the claim
 * that keeps a writing tool out of a read-scoped credential's list, and the check that
 * refuses one anyway.
 *
 * The second is the backstop, and it is the half no transport test can reach — a tool the
 * predicate hides is already unreachable, so a client working from a list it kept is what
 * this asserts against directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ToolContext } from "@sdxc/mcp/server";

import { ForbiddenError } from "@sdxc/mcp/server";
import { RequestContext } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { AgentIdentity } from "~/app/mcp/agent";
import type { Tier } from "~/app/services/entitlement";

import { Agent, agentAccess, agentOf, WRITES } from "~/app/mcp/agent";

/** The tool a call is for, which the middleware carries but never reads. */
const TOOL = {
	name: "mark_read",
	description: "Marks one post read.",
	inputSchema: { type: "object", properties: {} },
} as const;

/**
 * A tool call carrying one verified agent, with the access the route binds for it, which
 * is what every tool below the credential middleware runs under.
 */
async function contextFor(
	scope: AgentIdentity["scope"],
	tier: Tier = "paid",
): Promise<ToolContext> {
	let ctx = new RequestContext(new Request("https://reader.sergiodxa.com/mcp", { method: "POST" }));
	ctx.set(Agent, { subject: "sub-agent", tokenId: "tok_1", scope, tier });

	await agentAccess(ctx, async () => new Response(null));

	return Object.assign(ctx, { input: {}, tool: TOOL });
}

/** The backstop every writing tool declares, which refuses before the handler runs. */
function writeGuard(ctx: ToolContext, next: () => Promise<{ content: [] }>) {
	let [middleware] = WRITES.middleware;
	if (middleware === undefined) throw new Error("A writing tool declares its write check");

	return middleware(ctx, next);
}

describe("scope", () => {
	test("hides a writing tool from a read-scoped credential", async () => {
		expect(WRITES.available(await contextFor("read"))).toBe(false);
		expect(WRITES.available(await contextFor("write"))).toBe(true);
	});

	/** The token's scope caps its holder's tier, so a write token on the free tier writes nothing. */
	test("hides a writing tool from a write-scoped credential whose holder's plan lacks it", async () => {
		expect(WRITES.available(await contextFor("write", "free"))).toBe(false);
	});

	/** A client working from a list it kept still meets this, as a refusal naming the ability. */
	test("refuses a writing tool a read-scoped credential reached anyway", async () => {
		let next = vi.fn(async () => ({ content: [] as [] }));
		let refused = writeGuard(await contextFor("read"), next);

		await expect(refused).rejects.toThrow(ForbiddenError);
		await expect(refused).rejects.toThrow("agent.write is not permitted");
		expect(next).not.toHaveBeenCalled();
	});

	test("lets a write-scoped credential through to the tool", async () => {
		let next = vi.fn(async () => ({ content: [] as [] }));

		await writeGuard(await contextFor("write"), next);

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
