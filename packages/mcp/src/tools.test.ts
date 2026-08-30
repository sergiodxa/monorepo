/**
 * Tests for the tool declaration tree.
 *
 * Declaration is where the mistakes are cheapest to catch, so both of the ones that would
 * otherwise surface far away — a name invalid for the Mcp-Name header, and two tools
 * answering to the same name — fail here instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, expectTypeOf, test } from "vitest";

import type { InputOf } from "./tools";

import { createTool, createToolController, tool, tools, walk } from "./tools";

/** A tool exercising an enum, a default, an optional, and a required argument. */
let searchPosts = tool("search_posts", {
	description: "Searches published posts.",
	input: {
		type: "object",
		properties: {
			query: { type: "string" },
			type: { type: "string", enum: ["articles", "tutorials"] },
			limit: { type: "integer", default: 10 },
		},
		required: ["query"],
	},
	annotations: { readOnlyHint: true },
});

describe("tool", () => {
	test("builds the descriptor a tools/list entry is made of", () => {
		expect(searchPosts.name).toBe("search_posts");
		expect(searchPosts.descriptor.description).toBe("Searches published posts.");
		expect(searchPosts.descriptor.inputSchema.required).toEqual(["query"]);
		expect(searchPosts.descriptor.annotations).toEqual({ readOnlyHint: true });
	});

	test("leaves undeclared descriptor keys absent rather than null", () => {
		expect(searchPosts.descriptor).not.toHaveProperty("title");
		expect(searchPosts.descriptor).not.toHaveProperty("outputSchema");
	});

	test("refuses a name a client could not carry in the Mcp-Name header", () => {
		expect(() =>
			tool("get post", { description: "d", input: { type: "object", properties: {} } }),
		).toThrow(/Invalid tool name/);
		expect(() => tool("", { description: "d", input: { type: "object", properties: {} } })).toThrow(
			/Invalid tool name/,
		);
	});

	test("accepts every character class MCP allows", () => {
		expect(
			tool("admin.tools.list-v2_1", {
				description: "d",
				input: { type: "object", properties: {} },
			}).name,
		).toBe("admin.tools.list-v2_1");
	});

	test("derives the handler argument type from the schema", () => {
		type Input = InputOf<typeof searchPosts>;

		expectTypeOf<Input["query"]>().toEqualTypeOf<string>();
		expectTypeOf<Input["type"]>().toEqualTypeOf<"articles" | "tutorials" | undefined>();
		expectTypeOf<Input["limit"]>().toEqualTypeOf<number>();
	});
});

describe("tools", () => {
	test("walks a nested tree in declaration order", () => {
		let tree = tools({
			search: searchPosts,
			posts: tools({
				list: tool("list_posts", { description: "d", input: { type: "object", properties: {} } }),
				get: tool("get_post", { description: "d", input: { type: "object", properties: {} } }),
			}),
		});

		expect([...walk(tree)].map((each) => each.name)).toEqual([
			"search_posts",
			"list_posts",
			"get_post",
		]);
	});

	test("refuses two tools answering to the same name", () => {
		let duplicate = tool("search_posts", {
			description: "d",
			input: { type: "object", properties: {} },
		});

		expect(() => tools({ a: searchPosts, b: tools({ c: duplicate }) })).toThrow(
			/Duplicate tool name "search_posts"/,
		);
	});
});

describe("createTool", () => {
	test("types a handler declared in its own file", () => {
		let action = createTool(searchPosts, (ctx) => {
			expectTypeOf(ctx.input.query).toEqualTypeOf<string>();
			expectTypeOf(ctx.input.limit).toEqualTypeOf<number>();
			return { results: [ctx.input.query] };
		});

		expect(action).toBeTypeOf("function");
	});

	test("accepts the action object form, with middleware and visibility", () => {
		let action = createTool(searchPosts, {
			available: () => true,
			middleware: [(_ctx, next) => next()],
			handler: (ctx) => ctx.input.query,
		});

		expect(action).toHaveProperty("handler");
	});
});

describe("createToolController", () => {
	test("requires an action for every tool in the group", () => {
		let group = tools({
			list: tool("list_things", { description: "d", input: { type: "object", properties: {} } }),
			get: tool("get_thing", {
				description: "d",
				input: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
			}),
		});

		let controller = createToolController(group, {
			middleware: [(_ctx, next) => next()],
			actions: {
				list: () => "listed",
				get: {
					handler: (ctx) => {
						expectTypeOf(ctx.input.id).toEqualTypeOf<string>();
						return ctx.input.id;
					},
				},
			},
		});

		expect(Object.keys(controller.actions)).toEqual(["list", "get"]);
	});
});
