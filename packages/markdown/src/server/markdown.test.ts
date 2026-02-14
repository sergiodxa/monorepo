import { describe, expect, test } from "bun:test";

import { isFailure, isSuccess } from "@pkg/result";
import { z } from "zod";

import { Markdown, MarkdownParseError } from "./index";

let defaultSchema = z.object({
	title: z.string().optional(),
	description: z.string().optional(),
	lang: z.string().optional(),
});

describe("Markdown", () => {
	describe("parse", () => {
		test("parses basic markdown content", () => {
			let md = new Markdown({ frontmatter: defaultSchema });
			let result = md.parse("# Hello World\n\nThis is a paragraph.");

			expect(isSuccess(result)).toBe(true);
			if (isFailure(result)) return;

			expect(result.data.frontmatter).toEqual({});
			expect(result.data.content).toBeDefined();
		});

		test("extracts frontmatter", () => {
			let md = new Markdown({ frontmatter: defaultSchema });
			let result = md.parse(`---
title: Test Title
description: Test Description
---

# Content`);

			expect(isSuccess(result)).toBe(true);
			if (isFailure(result)) return;

			expect(result.data.frontmatter.title).toBe("Test Title");
			expect(result.data.frontmatter.description).toBe("Test Description");
		});

		test("handles frontmatter with quoted values", () => {
			let md = new Markdown({ frontmatter: defaultSchema });
			let result = md.parse(`---
title: "Quoted Title"
description: 'Single Quoted'
---

Content`);

			expect(isSuccess(result)).toBe(true);
			if (isFailure(result)) return;

			expect(result.data.frontmatter.title).toBe("Quoted Title");
			expect(result.data.frontmatter.description).toBe("Single Quoted");
		});

		test("handles content without frontmatter", () => {
			let md = new Markdown({ frontmatter: defaultSchema });
			let result = md.parse("Just plain content");

			expect(isSuccess(result)).toBe(true);
			if (isFailure(result)) return;

			expect(result.data.frontmatter).toEqual({});
			expect(result.data.content).toBeDefined();
		});

		test("parses code blocks", () => {
			let md = new Markdown({ frontmatter: defaultSchema });
			let result = md.parse("```typescript\nconst x = 1;\n```");

			expect(isSuccess(result)).toBe(true);
			if (isFailure(result)) return;

			expect(result.data.content).toBeDefined();
		});
	});

	describe("frontmatter", () => {
		test("extracts frontmatter from content", () => {
			let input = `---
title: Hello
description: World
---

Content here`;

			let schema = z.object({
				title: z.string(),
				description: z.string(),
			});

			let result = Markdown.frontmatter(input, schema);

			expect(isSuccess(result)).toBe(true);
			if (isFailure(result)) return;

			expect(result.data.frontmatter).toEqual({
				title: "Hello",
				description: "World",
			});
			expect(result.data.content.trim()).toBe("Content here");
		});

		test("handles quoted values", () => {
			let input = `---
title: "Double Quoted"
description: 'Single Quoted'
---

Content`;

			let result = Markdown.frontmatter(input, defaultSchema);

			expect(isSuccess(result)).toBe(true);
			if (isFailure(result)) return;

			expect(result.data.frontmatter.title).toBe("Double Quoted");
			expect(result.data.frontmatter.description).toBe("Single Quoted");
		});

		test("returns empty frontmatter when none exists", () => {
			let input = "Just some content";
			let result = Markdown.frontmatter(input, defaultSchema);

			expect(isSuccess(result)).toBe(true);
			if (isFailure(result)) return;

			expect(result.data.frontmatter).toEqual({});
			expect(result.data.content).toBe("Just some content");
		});

		test("handles malformed frontmatter gracefully", () => {
			let input = `---
not valid yaml
---

Content`;

			let result = Markdown.frontmatter(input, defaultSchema);

			expect(isSuccess(result)).toBe(true);
			if (isFailure(result)) return;

			expect(result.data.content.trim()).toBe("Content");
		});

		test("handles colons in values", () => {
			let input = `---
url: https://example.com
time: 10:30
---

Content`;

			let schema = z.object({
				url: z.string(),
				time: z.string(),
			});

			let result = Markdown.frontmatter(input, schema);

			expect(isSuccess(result)).toBe(true);
			if (isFailure(result)) return;

			expect(result.data.frontmatter.url).toBe("https://example.com");
			expect(result.data.frontmatter.time).toBe("10:30");
		});

		test("returns failure with MarkdownParseError on invalid frontmatter", () => {
			let input = `---
title: Hello
---

Content`;

			let schema = z.object({
				title: z.string(),
				required: z.string(),
			});

			let result = Markdown.frontmatter(input, schema);

			expect(isFailure(result)).toBe(true);
			if (isSuccess(result)) return;

			expect(result.error).toBeInstanceOf(MarkdownParseError);
		});

		test("MarkdownParseError includes validation issues", () => {
			let input = `---
title: Hello
---

Content`;

			let schema = z.object({
				title: z.string(),
				required: z.string(),
			});

			let result = Markdown.frontmatter(input, schema);

			expect(isFailure(result)).toBe(true);
			if (isSuccess(result)) return;

			expect(result.error.issues.length).toBeGreaterThan(0);
			expect(result.error.issues[0]?.path).toContain("required");
		});

		test("validates and transforms frontmatter with schema", () => {
			let input = `---
title: My Post
count: 42
---

Content`;

			let schema = z.object({
				title: z.string(),
				count: z.coerce.number(),
			});

			let result = Markdown.frontmatter(input, schema);

			expect(isSuccess(result)).toBe(true);
			if (isFailure(result)) return;

			expect(result.data.frontmatter.title).toBe("My Post");
			expect(result.data.frontmatter.count).toBe(42);
			expect(typeof result.data.frontmatter.count).toBe("number");
		});
	});
});
