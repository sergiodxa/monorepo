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

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { InputOf } from "./tools.js";

import { createTool, createToolController, tool, tools, walk } from "./tools.js";

/** A tool exercising an enum, a default, an optional, and a required argument. */
let searchPosts = tool("search_posts", {
	description: "Searches published posts.",
	input: s.object({
		query: s.string().pipe(checks.minLength(1)).meta({ description: "Words to look for." }),
		type: s.optional(s.enum_(["articles", "tutorials"])),
		limit: s.defaulted(s.integer(), 10),
	}),
	annotations: { readOnlyHint: true },
});

/** An input with no arguments, for the cases that only exercise names and grouping. */
const NO_ARGUMENTS = s.object({});

describe("tool", () => {
	test("builds the descriptor a tools/list entry is made of", () => {
		expect(searchPosts.name).toBe("search_posts");
		expect(searchPosts.descriptor.description).toBe("Searches published posts.");
		expect(searchPosts.descriptor.annotations).toEqual({ readOnlyHint: true });
	});

	test("publishes the input side of the schema as JSON Schema, without $schema", () => {
		expect(searchPosts.descriptor.inputSchema).toEqual({
			type: "object",
			properties: {
				query: { type: "string", minLength: 1, description: "Words to look for." },
				type: { type: "string", enum: ["articles", "tutorials"] },
				limit: { type: "integer", default: 10 },
			},
			required: ["query"],
		});
	});

	test("publishes the output side of a declared output schema", () => {
		let counted = tool("count_posts", {
			description: "d",
			input: NO_ARGUMENTS,
			output: s.object({ count: s.defaulted(s.integer(), 0) }),
		});

		expect(counted.descriptor.outputSchema).toEqual({
			type: "object",
			properties: { count: { type: "integer", default: 0 } },
			required: ["count"],
		});
	});

	test("writes a named schema inline, so the published schema is self-contained", () => {
		let Author = s.object({ name: s.string() }).meta({ id: "Author" });
		let byAuthor = tool("posts_by_author", {
			description: "d",
			input: s.object({ author: Author }),
		});

		expect(byAuthor.descriptor.inputSchema).not.toHaveProperty("$defs");
		expect(byAuthor.descriptor.inputSchema.properties?.author).toMatchObject({ type: "object" });
	});

	test("refuses a schema whose JSON Schema is not an object, as a union's anyOf is", () => {
		let input = s.union([s.object({ slug: s.string() }), s.object({ id: s.string() })]);

		expect(() => tool("get_either", { description: "d", input })).toThrow(
			/input schema must describe an object/,
		);
	});

	test("leaves undeclared descriptor keys absent rather than null", () => {
		expect(searchPosts.descriptor).not.toHaveProperty("title");
		expect(searchPosts.descriptor).not.toHaveProperty("outputSchema");
	});

	test("refuses a name a client could not carry in the Mcp-Name header", () => {
		expect(() => tool("get post", { description: "d", input: NO_ARGUMENTS })).toThrow(
			/Invalid tool name/,
		);
		expect(() => tool("", { description: "d", input: NO_ARGUMENTS })).toThrow(/Invalid tool name/);
	});

	test("accepts every character class MCP allows", () => {
		expect(
			tool("admin.tools.list-v2_1", {
				description: "d",
				input: NO_ARGUMENTS,
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
				list: tool("list_posts", { description: "d", input: NO_ARGUMENTS }),
				get: tool("get_post", { description: "d", input: NO_ARGUMENTS }),
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
			input: NO_ARGUMENTS,
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
			list: tool("list_things", { description: "d", input: NO_ARGUMENTS }),
			get: tool("get_thing", {
				description: "d",
				input: s.object({ id: s.string() }),
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
