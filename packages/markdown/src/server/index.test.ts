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
	});
});
