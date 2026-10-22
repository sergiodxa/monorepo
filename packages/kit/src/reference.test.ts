/**
 * The README's command reference against the one the contract renders, so adding or changing a
 * command, argument or flag fails here until `bun run kit:reference` rewrites the README.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { createSDXC } from "./cli.js";
import { readReference, renderReference, replaceReference } from "./reference.js";

/** The README the reference section lives in. */
const README = join(import.meta.dirname, "../README.md");

describe("renderReference", () => {
	test("matches the README's reference section; run bun run kit:reference to rewrite it", async () => {
		let readme = await readFile(README, "utf8");
		let description = createSDXC().describe();
		expect(description).toBeDefined();
		expect(readReference(readme)).toBe(renderReference(description!));
	});

	test("escapes angle brackets and pipes in descriptions and pads the flag table", () => {
		let reference = renderReference({
			path: [],
			title: "sdxc",
			description: null,
			arguments: [],
			flags: [],
			examples: [],
			commands: [
				{
					path: ["greet"],
					title: "sdxc greet",
					description: "Greet <name>",
					arguments: [
						{ name: "name", description: null, required: true, variadic: false, rest: false },
						{ name: "extra", description: null, required: false, variadic: true, rest: false },
					],
					flags: [
						{
							name: "color",
							aliases: [],
							short: "c",
							kind: "boolean",
							negatable: true,
							value: null,
							optionalValue: false,
							list: false,
							repeatable: false,
							required: false,
							description: "Color a | b",
							builtin: false,
							default: true,
						},
					],
					examples: [],
					commands: [],
				},
			],
		});
		expect(reference).toBe(
			[
				"#### `sdxc greet <name> [extra...]`",
				"",
				"Greet &lt;name&gt;",
				"",
				"| Flag             | Does         |",
				"| ---------------- | ------------ |",
				"| `-c, --no-color` | Color a \\| b |",
				"",
			].join("\n"),
		);
	});
});

describe("replaceReference", () => {
	test("replaces the section between the first command heading and Configuration", () => {
		let readme = "# Kit\n\n#### `sdxc old`\n\nOld\n\n### Configuration\n\nKeys\n";
		expect(replaceReference(readme, "#### `sdxc new`\n")).toBe(
			"# Kit\n\n#### `sdxc new`\n\n### Configuration\n\nKeys\n",
		);
	});

	test("returns null without the headings bounding the section", () => {
		expect(replaceReference("# Kit\n", "")).toBeNull();
		expect(readReference("#### `sdxc x`\n")).toBeNull();
	});
});
