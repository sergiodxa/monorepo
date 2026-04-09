import { describe, expect, test } from "bun:test";

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
