/**
 * The MCP tool list generated mechanically from the management API's own OpenAPI
 * operations: every operation becomes a tool, its input schema reflects its own
 * params, query and body, and an unknown tool name is refused before any request
 * is ever built.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { callManagementTool, listManagementTools } from "~/app/mcp/tools";

describe("listManagementTools", () => {
	test("generates a non-empty tool list from the management API's own operations", () => {
		let tools = listManagementTools();
		expect(tools.length).toBeGreaterThan(10);
	});

	test("includes a tool naming subjects and a tool naming clients", () => {
		let names = listManagementTools().map((tool) => tool.name);
		expect(names).toContain("subjectsList");
		expect(names).toContain("clientsRegister");
	});

	test("every tool carries a name, a non-empty description and an object input schema", () => {
		for (let tool of listManagementTools()) {
			expect(tool.name.length).toBeGreaterThan(0);
			expect(tool.description?.length).toBeGreaterThan(0);
			expect(tool.inputSchema.type).toBe("object");
		}
	});

	test("a tenant-scoped operation's tool requires its path param", () => {
		let tool = listManagementTools().find((entry) => entry.name === "subjectsRead");
		expect(tool?.inputSchema.properties).toMatchObject({
			tenantId: { type: "string" },
			subjectId: { type: "string" },
		});
		expect(tool?.inputSchema.required).toEqual(expect.arrayContaining(["tenantId", "subjectId"]));
	});

	test("an operation with a JSON body carries it under its own body property", () => {
		let tool = listManagementTools().find((entry) => entry.name === "subjectsCreate");
		expect(tool?.inputSchema.properties?.body).toMatchObject({ type: "object" });
	});
});

describe("callManagementTool", () => {
	test("refuses an unknown tool name before building any request", async () => {
		let result = await callManagementTool("not-a-real-tool", {}, "token");
		expect(result.isError).toBe(true);
		expect(result.content).toEqual([{ type: "text", text: 'Unknown tool "not-a-real-tool"' }]);
	});
});
