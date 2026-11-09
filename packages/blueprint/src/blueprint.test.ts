/**
 * Tests for the library: front matter against a schema, placeholders with filters, `if` and
 * `each` blocks and the lines they leave, strict errors with their stub and line, the values a
 * set of stubs reads, and plans that create, replace or stop on a conflict.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isFailure, isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import { afterEach, beforeEach, describe, expect, expectTypeOf, test } from "vitest";

import * as blueprint from "./index.js";

/** The rendered text, failing the test on a render error. */
function rendered(input: string, values: blueprint.Values): string {
	let result = blueprint.render(input, values);
	if (isFailure(result)) throw result.error;
	return result.data;
}

/** The error message of a render expected to fail. */
function renderError(input: string, values: blueprint.Values): string {
	let result = blueprint.render(input, values, { source: "flag.stub" });
	if (isSuccess(result)) throw new Error(`Rendered ${JSON.stringify(result.data)}`);
	return result.error.message;
}

describe("parse", () => {
	test("validates front matter with the caller's schema and keeps the body", () => {
		let text = "---\nto: app/{{name}}.ts\ndescription: A flag\n---\nexport {};\n";
		let stub = blueprint.parse(text, {
			schema: s.object({ to: s.string(), description: s.optional(s.string()) }),
			source: "index.stub",
		});

		if (isFailure(stub)) throw stub.error;
		expectTypeOf(stub.data.frontmatter.to).toEqualTypeOf<string>();
		expect(stub.data.frontmatter).toEqual({ to: "app/{{name}}.ts", description: "A flag" });
		expect(stub.data.body).toBe("export {};\n");
	});

	test("reads a stub without front matter as an empty object", () => {
		let stub = blueprint.parse("hello\n");

		expect(isSuccess(stub) && stub.data.frontmatter).toEqual({});
	});

	test("names the key a schema rejects", () => {
		let stub = blueprint.parse("---\ndescription: x\n---\n", {
			schema: s.object({ to: s.string() }),
			source: "index.stub",
		});

		expect(isFailure(stub) && stub.error.message).toMatch(/^index\.stub: Front matter to: /);
	});

	test("counts lines from the top of the file, front matter included", () => {
		let stub = blueprint.parse("---\nto: x\n---\nline 4\n{{#if a}}\n", { source: "index.stub" });

		expect(isFailure(stub) && stub.error.message).toBe("index.stub:5: {{#if a}} is never closed");
	});
});

describe("render", () => {
	test("pipes a value through each filter in turn", () => {
		expect(rendered("{{ name | plural | pascal }}", { name: "user-profile" })).toBe("UserProfiles");
	});

	test.each([
		["camel", "showPage"],
		["pascal", "ShowPage"],
		["kebab", "show-page"],
		["snake", "show_page"],
		["humanize", "Show page"],
		["title", "Show Page"],
		["upper", "SHOW-PAGE"],
		["base", "show-page"],
	])("applies %s", (filter, expected) => {
		expect(rendered(`{{name | ${filter}}}`, { name: "show-page" })).toBe(expected);
	});

	test("changes case in each folder of a nested name", () => {
		expect(rendered("{{name | pascal}}", { name: "users/show-page" })).toBe("Users/ShowPage");
	});

	test("accepts the caller's filters beside the built-in ones", () => {
		let result = blueprint.render(
			"{{name | shout}}",
			{ name: "hi" },
			{
				filters: { shout: (value) => `${value}!` },
			},
		);

		expect(isSuccess(result) && result.data).toBe("hi!");
	});

	test("writes an if block for a true flag, a non-empty text or list", () => {
		let stub = "{{#if on}}yes{{/if}}";

		expect(rendered(stub, { on: true })).toBe("yes");
		expect(rendered(stub, { on: false })).toBe("");
		expect(rendered(stub, { on: "x" })).toBe("yes");
		expect(rendered(stub, { on: [] })).toBe("");
	});

	test("repeats an each block per item, with filters on the item", () => {
		let stub = "{{#each fields}}{{item | camel}};{{/each}}";

		expect(rendered(stub, { fields: ["first-name", "last_name"] })).toBe("firstName;lastName;");
	});

	test("removes the line of a block tag that stands alone", () => {
		let stub = "start\n\t{{#if beta}}\n\tbeta\n\t{{/if}}\nend\n";

		expect(rendered(stub, { beta: true })).toBe("start\n\tbeta\nend\n");
		expect(rendered(stub, { beta: false })).toBe("start\nend\n");
	});

	test("indents every line of a multi-line value standing alone on its line", () => {
		expect(rendered("{\n\t{{body}}\n}", { body: "a;\nb;" })).toBe("{\n\ta;\n\tb;\n}");
	});

	test("leaves braces that form no tag, and writes an escaped one", () => {
		expect(rendered("values={{}} \\{{name}}", {})).toBe("values={{}} {{name}}");
	});

	test("names a missing value, the stub and line, and the values it has", () => {
		expect(renderError("one\n{{title}}", { name: "x" })).toBe(
			"flag.stub:2: {{title}} has no value; it accepts {{name}}",
		);
	});

	test("names an unknown filter", () => {
		expect(renderError("{{name | shout}}", { name: "x" })).toMatch(
			/^flag\.stub:1: No filter "shout"; the filters are base, camel/,
		);
	});

	test("refuses a list where text belongs", () => {
		expect(renderError("{{fields}}", { fields: ["a"] })).toBe(
			"flag.stub:1: {{fields}} is a list; use it in {{#each}}",
		);
	});

	test("refuses an each inside an each, and mismatched blocks", () => {
		expect(renderError("{{#each a}}{{#each b}}{{/each}}{{/each}}", {})).toBe(
			"flag.stub:1: {{#each}} cannot hold another {{#each}}",
		);
		expect(renderError("{{#if a}}\n{{/each}}", {})).toBe(
			"flag.stub:2: {{/each}} closes the {{#if a}} opened on line 1",
		);
	});
});

describe("variables", () => {
	test("reads each value's shape from how the stubs use it", () => {
		let index = blueprint.parse("{{name}}\n{{#if beta}}{{#each fields}}{{item}}{{/each}}{{/if}}", {
			source: "index.stub",
		});
		if (isFailure(index)) throw index.error;
		let found = blueprint.variables([index.data, "{{#if name}}{{/if}}"]);

		if (isFailure(found)) throw found.error;
		expect(found.data.map(({ name, kind }) => ({ name, kind }))).toEqual([
			{ name: "name", kind: "text" },
			{ name: "beta", kind: "flag" },
			{ name: "fields", kind: "list" },
		]);
		expect(found.data[0]?.uses).toEqual([
			{ source: "index.stub", line: 1 },
			{ source: "template", line: 1 },
		]);
	});

	test("refuses a value used both as a list and as text", () => {
		let found = blueprint.variables(["{{#each a}}{{/each}}", "{{a}}"]);

		expect(isFailure(found) && found.error.message).toBe(
			"{{a}} is a list in template:1 and text in template:1",
		);
	});
});

describe("plan and write", () => {
	/** A folder of its own for each test. */
	let root = "";

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "blueprint-"));
	});
	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	test("creates new files in new folders", async () => {
		let planned = await blueprint.plan([{ path: "app/flags/beta.ts", content: "x\n" }], { root });
		if (isFailure(planned)) throw planned.error;

		expect(planned.data.files.map((file) => file.action)).toEqual(["create"]);
		let written = await blueprint.write(planned.data);
		expect(isSuccess(written) && written.data).toEqual(["app/flags/beta.ts"]);
		expect(await readFile(join(root, "app/flags/beta.ts"), "utf8")).toBe("x\n");
	});

	test("reports a file that exists as a conflict and writes nothing", async () => {
		await writeFile(join(root, "a.ts"), "old");
		let planned = await blueprint.plan(
			[
				{ path: "a.ts", content: "new" },
				{ path: "b.ts", content: "b" },
			],
			{ root },
		);
		if (isFailure(planned)) throw planned.error;

		expect(planned.data.conflicts).toEqual(["a.ts"]);
		let written = await blueprint.write(planned.data);
		expect(isFailure(written) && written.error.message).toBe("These files exist already: a.ts");
		expect(await readFile(join(root, "a.ts"), "utf8")).toBe("old");
	});

	test("replaces a file that exists when forced", async () => {
		await writeFile(join(root, "a.ts"), "old");
		let planned = await blueprint.plan([{ path: "a.ts", content: "new" }], { root, force: true });
		if (isFailure(planned)) throw planned.error;

		expect(planned.data.files[0]?.action).toBe("replace");
		await blueprint.write(planned.data);
		expect(await readFile(join(root, "a.ts"), "utf8")).toBe("new");
	});

	test("refuses paths outside the root and two files with one path", async () => {
		let outside = await blueprint.plan([{ path: "../x.ts", content: "" }], { root });
		let twice = await blueprint.plan(
			[
				{ path: "a.ts", content: "", source: "index.stub" },
				{ path: "./a.ts", content: "", source: "test.stub" },
			],
			{ root },
		);

		expect(isFailure(outside) && outside.error.message).toContain("../x.ts is outside");
		expect(isFailure(twice) && twice.error.message).toBe(
			"test.stub: a.ts is also written by index.stub",
		);
	});
});
