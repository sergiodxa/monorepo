import { isFailure, isSuccess } from "@pkg/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { Markdown, MarkdownParseError } from "./index";

let defaultSchema = s.object({
	title: s.optional(s.string()),
	description: s.optional(s.string()),
	lang: s.optional(s.string()),
});

describe("Markdown", () => {
	describe("parse", () => {
		test("parses basic markdown content", () => {
			let md = new Markdown({ frontmatter: defaultSchema });
			let result = md.parse("# Hello World\n\nThis is a paragraph.");

			expect(isSuccess(result)).toBe(true);
			if (isFailure(result)) return;

			// `s.optional()` types each key as present-but-`undefined` rather than as
			// an optional property, so an empty object is not assignable to the
			// inferred type even though parsing does drop the absent keys. Comparing
			// the keys asserts the same emptiness without fighting the type.
			expect(Object.keys(result.data.frontmatter)).toEqual([]);
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

			let schema = s.object({
				title: s.string(),
				description: s.string(),
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

			let schema = s.object({
				title: s.string(),
				required: s.string(),
			});

			let result = Markdown.frontmatter(input, schema);

			expect(isFailure(result)).toBe(true);
			if (isSuccess(result)) return;

			expect(result.error).toBeInstanceOf(MarkdownParseError);
		});
	});
});
