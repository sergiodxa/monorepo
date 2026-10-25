/**
 * `/mcp`, called through the app's router the way an MCP client calls it, with `callTool` from
 * `app/test/mcp.ts`.
 */

import { describe, expect, test } from "vitest";

import { callTool } from "~/app/test/mcp";

describe("mcp", () => {
	test("answers a call to a tool the server does not offer with an error", async () => {
		let call = await callTool("missing", {});

		expect(call.isError).toBe(true);
	});
});
