/**
 * Covers the markdown the `@sdxc/ui` pages are served as: a table cell that would split
 * on a union's pipe or a description's line break, and a fence that would close early on
 * an example holding its own fence.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { UiExportReference } from "~/app/services/ui-exports";

import { componentMarkdown, uiExportMarkdown } from "~/app/services/catalogue-markdown";

describe("componentMarkdown", () => {
	test("keeps a union and a wrapped description inside their cells", () => {
		let body = componentMarkdown({
			name: "Badge",
			slug: "badge",
			definition: "A compact pill.",
			summary: "A compact pill.",
			description: "Renders a pill.",
			examples: [],
			props: {
				rows: [
					{
						name: "variant",
						type: "Variant",
						description: "How loud\nit is.",
						optional: true,
						values: ['"solid"', '"outline"'],
					},
				],
				inherits: ['ElementProps<"span">'],
			},
			parts: [],
			types: [],
			related: [],
		});

		expect(body).toContain('| `variant?` | `"solid" \\| "outline"` | How loud it is. |');
		expect(body).toContain('Also accepts everything in `ElementProps<"span">`.');
	});
});

describe("uiExportMarkdown", () => {
	test("fences an example longer than any fence written inside it", () => {
		let reference: UiExportReference = {
			name: "copy",
			subpath: "mixins",
			slug: "copy",
			module: "copy",
			summary: "Copies text.",
			symbol: {
				name: "copy",
				kind: "mixin",
				description: "Copies text.",
				signature: "copy(): MixinDescriptor<HTMLElement>",
				parameters: [],
				returns: "",
				examples: ["let doc = `\n```ts\nx\n```\n`;"],
				members: [],
				methods: [],
				values: [],
			},
			companions: [],
		};
		let body = uiExportMarkdown(reference);

		expect(body).toContain("````tsx\nlet doc");
		expect(body).toContain('import { copy } from "@sdxc/ui/mixins";');
	});
});
