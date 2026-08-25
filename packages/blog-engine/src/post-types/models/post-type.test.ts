/**
 * Unit tests for {@link PostType.validate}: accepted definitions, slug rules,
 * reserved paths, and reserved/duplicate field keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { PostType, type PostTypeInput } from "./post-type";

function base(overrides: Partial<PostTypeInput> = {}): PostTypeInput {
	return {
		name: "recipe",
		path: "recipes",
		label: "Recipes",
		fields: [{ key: "ingredients", label: "Ingredients", kind: "textarea", required: true }],
		...overrides,
	};
}

describe("PostType.validate", () => {
	test("accepts a well-formed definition", () => {
		expect(() => PostType.validate(base())).not.toThrow();
	});

	test("rejects a non-slug name or path", () => {
		expect(() => PostType.validate(base({ name: "Bad Name" }))).toThrow();
		expect(() => PostType.validate(base({ path: "Bad Path" }))).toThrow();
	});

	test("rejects reserved paths", () => {
		expect(() => PostType.validate(base({ path: "cms" }))).toThrow();
		expect(() => PostType.validate(base({ path: "auth" }))).toThrow();
	});

	test("rejects reserved and duplicate field keys", () => {
		expect(() =>
			PostType.validate(
				base({ fields: [{ key: "title", label: "Title", kind: "text", required: true }] }),
			),
		).toThrow();
		expect(() =>
			PostType.validate(
				base({
					fields: [
						{ key: "a", label: "A", kind: "text", required: false },
						{ key: "a", label: "A2", kind: "text", required: false },
					],
				}),
			),
		).toThrow();
	});
});
