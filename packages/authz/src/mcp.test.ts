/**
 * Tests the MCP adapter through a real `@sdxc/mcp` handler: one claim hides
 * a tool from `tools/list` and refuses a stale call, and a tool middleware
 * answers a hidden record like a missing one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import { createHandler, LATEST_PROTOCOL_VERSION, MetaKey, tool, tools } from "@sdxc/mcp";
import { RequestContext } from "remix/router";
import { describe, expect, test } from "vitest";

import { abilities, ability, context } from "./catalog.js";
import { allow, deny, fact } from "./grants.js";
import { guard, requireToolAbility } from "./mcp.js";
import { access } from "./middleware/router.js";
import { definePolicy } from "./policy.js";

interface Monitor {
	id: string;
	teamId: string;
}

const CATALOG = abilities({
	monitor: {
		run: ability({ context: context<{ monitor: Monitor }>("monitor"), deniedAs: "notFound" }),
	},
	agent: { read: ability(), write: ability() },
});

const POLICY = definePolicy(CATALOG, {
	facts: { actor: fact<{ teamId: string }>(), billing: fact<{ state: string }>() },
	roles: {
		member: [allow(["monitor", "agent"])],
		"agent:read": [allow("agent.read")],
		"agent:write": [allow(["agent", "monitor"])],
	},
	guards: [
		deny("monitor", {
			id: "other-team",
			when: { op: "ne", field: "monitor.teamId", path: "actor.teamId" },
			as: "notFound",
		}),
		deny("monitor.run", {
			id: "subscription",
			when: { op: "eq", field: "billing.state", value: "inactive" },
			reason: "subscription-required",
			as: "forbidden",
		}),
	],
});

const TOOLSET = tools({
	list: tool("list_monitors", { description: "Lists monitors.", input: s.object({}) }),
	run: tool("run_monitor", {
		description: "Runs a monitor now.",
		input: s.object({ monitorId: s.string() }),
	}),
});

const MONITORS: Record<string, Monitor> = {
	m1: { id: "m1", teamId: "t1" },
	m2: { id: "m2", teamId: "t2" },
};

/** The MCP handler under test, its tools guarded by the agent claims. */
function server() {
	let mcp = createHandler({ name: "test", version: "1.0.0" });
	mcp.tools.map(TOOLSET, {
		actions: {
			list: { ...guard(CATALOG.agent.read), handler: () => Object.keys(MONITORS) },
			run: {
				...guard(CATALOG.agent.write),
				middleware: [
					requireToolAbility<typeof CATALOG.monitor.run, { monitorId: string }>(
						CATALOG.monitor.run,
						{
							context: (ctx) => {
								let monitor = MONITORS[ctx.input.monitorId];
								return monitor ? { monitor } : null;
							},
							notFound: "No such monitor",
						},
					),
				],
				handler: (ctx) => `ran ${ctx.input.monitorId}`,
			},
		},
	});
	return mcp;
}

/** A JSON-RPC request with the headers and metadata MCP requires. */
function send(method: string, params: Record<string, unknown> = {}): Request {
	let headers: Record<string, string> = {
		"Content-Type": "application/json",
		"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
		"Mcp-Method": method,
	};
	if (typeof params.name === "string") headers["Mcp-Name"] = params.name;
	return new Request("https://example.com/mcp", {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method,
			params: {
				...params,
				_meta: {
					[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
					[MetaKey.ClientInfo]: { name: "TestClient", version: "1.0.0" },
					[MetaKey.ClientCapabilities]: {},
				},
			},
		}),
	});
}

/** What a JSON-RPC answer carries, as far as these tests read it. */
interface Body {
	result?: { tools?: { name: string }[]; content?: { text: string }[]; isError?: boolean };
	error?: { message?: string };
}

/** Runs a request through `access` for a token of `scope`, then the MCP handler. */
async function call(request: Request, scope: string, state = "active"): Promise<Body> {
	let ctx = new RequestContext(request);
	let response = await access(POLICY, {
		roles: ["member"],
		within: [`agent:${scope}`],
		facts: { actor: { teamId: "t1" }, billing: async () => ({ state }) },
		load: [CATALOG.agent],
	})(ctx, () => server().fetch(ctx));
	return (await response.json()) as Body;
}

describe("guard", () => {
	test("hides a write tool from a read-scoped token", async () => {
		let read = await call(send("tools/list"), "read");
		let write = await call(send("tools/list"), "write");

		expect(read.result?.tools?.map((each) => each.name)).toEqual(["list_monitors"]);
		expect(write.result?.tools?.map((each) => each.name)).toEqual(["list_monitors", "run_monitor"]);
	});

	test("refuses a call to a hidden tool from a stale list", async () => {
		let body = await call(
			send("tools/call", { name: "run_monitor", arguments: { monitorId: "m1" } }),
			"read",
		);

		expect(body.error).toBeDefined();
		expect(body.result).toBeUndefined();
	});
});

describe("requireToolAbility", () => {
	test("runs an allowed call", async () => {
		let body = await call(
			send("tools/call", { name: "run_monitor", arguments: { monitorId: "m1" } }),
			"write",
		);

		expect(body.result?.content?.[0]?.text).toBe("ran m1");
	});

	test("answers a hidden record and a missing one with the same tool error", async () => {
		let hidden = await call(
			send("tools/call", { name: "run_monitor", arguments: { monitorId: "m2" } }),
			"write",
		);
		let missing = await call(
			send("tools/call", { name: "run_monitor", arguments: { monitorId: "m9" } }),
			"write",
		);

		expect(hidden.result).toEqual(missing.result);
		expect(hidden.result).toMatchObject({ isError: true, content: [{ text: "No such monitor" }] });
	});

	test("answers a forbidden refusal as a protocol error carrying its reason", async () => {
		let body = await call(
			send("tools/call", { name: "run_monitor", arguments: { monitorId: "m1" } }),
			"write",
			"inactive",
		);

		expect(body.error?.message).toMatch(/subscription-required/);
	});
});
