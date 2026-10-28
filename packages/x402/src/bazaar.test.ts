/**
 * Tests Bazaar extension builders stamp the schema facilitators validate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { bazaarHttpPost, bazaarMcpTool } from "./bazaar.js";

describe("bazaarHttpPost", () => {
	test("advertises a JSON POST body and output example", () => {
		let extension = bazaarHttpPost(
			{ version: "1.2.3", comparison: "^", against: "1.0.0" },
			{ type: "json", example: { satisfies: true } },
		);
		expect(extension.info.input).toEqual({
			type: "http",
			method: "POST",
			bodyType: "json",
			body: { version: "1.2.3", comparison: "^", against: "1.0.0" },
		});
		expect(extension.info.output.type).toBe("json");
		expect(extension.schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
	});
});

describe("bazaarMcpTool", () => {
	test("advertises a tool name and optional arguments", () => {
		let extension = bazaarMcpTool(
			"semver.satisfies",
			{ type: "json", example: { satisfies: true } },
			{ version: "1.2.3", comparison: "^", against: "1.0.0" },
		);
		expect(extension.info.input).toEqual({
			type: "mcp",
			toolName: "semver.satisfies",
			arguments: { version: "1.2.3", comparison: "^", against: "1.0.0" },
		});
	});
});
