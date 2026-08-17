/**
 * Unit tests for the Post repository. Exercises `Post.isPublishedAt`, verifying
 * that a null publish date counts as published and that unix-second timestamps in
 * the past are treated as published while future ones are treated as preview.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { Post } from "./post";

describe("Post.isPublishedAt", () => {
	test("treats null as published", () => {
		expect(Post.isPublishedAt(null)).toBe(true);
	});

	test("treats past unix-second timestamps as published", () => {
		let publishedAt = String(Math.floor(Date.now() / 1000) - 60);

		expect(Post.isPublishedAt(publishedAt)).toBe(true);
	});

	test("treats future unix-second timestamps as preview", () => {
		let publishedAt = String(Math.floor(Date.now() / 1000) + 60);

		expect(Post.isPublishedAt(publishedAt)).toBe(false);
	});
});
