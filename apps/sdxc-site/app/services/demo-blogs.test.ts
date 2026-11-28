/**
 * Tests how a demo blog's posts are ordered and related: neighbours in publishing order,
 * related posts by shared tags, series in reading order, tag counts, year groups and search.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { DemoBlogPost } from "~/app/services/demo-blogs";

import {
	countTags,
	findFeaturedPost,
	findNeighbourPosts,
	findRelatedPosts,
	groupByYear,
	listSeries,
	searchPosts,
} from "~/app/services/demo-blogs";

/** The fields a test sets on a post; the rest are filled with neutral values. */
interface PostFields {
	slug: string;
	date: string;
	tags?: string[];
	text?: string;
	featured?: boolean;
	series?: string;
	part?: number;
}

/** A post with only what a test sets. */
function post(fields: PostFields): DemoBlogPost {
	return {
		slug: fields.slug,
		date: fields.date,
		title: fields.slug,
		description: "",
		kind: "articles",
		tags: fields.tags ?? [],
		path: `articles/${fields.slug}`,
		minutes: 1,
		text: fields.text ?? "",
		body: null,
		updated: undefined,
		url: undefined,
		featured: fields.featured,
		series: fields.series,
		part: fields.part,
	};
}

/** Four posts, newest first, as `listPosts` returns them. */
const POSTS = [
	post({ slug: "d", date: "2026-03-01", tags: ["css", "http"], series: "S", part: 2 }),
	post({ slug: "c", date: "2026-02-01", tags: ["http"], text: "a note about caching" }),
	post({ slug: "b", date: "2025-12-01", tags: ["css"], featured: true, series: "S", part: 1 }),
	post({ slug: "a", date: "2025-11-01", tags: ["databases"] }),
];

describe("findNeighbourPosts", () => {
	test("finds the older and newer post in publishing order, null at the ends", () => {
		expect(findNeighbourPosts(POSTS, "articles/c")).toEqual({ older: POSTS[2], newer: POSTS[0] });
		expect(findNeighbourPosts(POSTS, "articles/d").newer).toBeNull();
		expect(findNeighbourPosts(POSTS, "articles/a").older).toBeNull();
	});
});

describe("findRelatedPosts", () => {
	test("ranks by shared tags then recency, leaving out a post sharing none", () => {
		let related = findRelatedPosts(POSTS, POSTS[0]!);
		expect(related.map((entry) => entry.slug)).toEqual(["c", "b"]);
		expect(findRelatedPosts(POSTS, POSTS[3]!)).toEqual([]);
	});
});

describe("listSeries", () => {
	test("orders a series by part, first part first", () => {
		expect(listSeries(POSTS, "S").map((entry) => entry.slug)).toEqual(["b", "d"]);
		expect(listSeries(POSTS, undefined)).toEqual([]);
	});
});

describe("countTags", () => {
	test("counts each tag, the most used first and ties by name", () => {
		expect(countTags(POSTS)).toEqual([
			{ tag: "css", count: 2 },
			{ tag: "http", count: 2 },
			{ tag: "databases", count: 1 },
		]);
	});
});

describe("groupByYear", () => {
	test("groups posts by year, newest year first", () => {
		expect(groupByYear(POSTS).map((group) => [group.year, group.posts.length])).toEqual([
			["2026", 2],
			["2025", 2],
		]);
	});
});

describe("findFeaturedPost", () => {
	test("leads with the newest featured post, else the newest post", () => {
		expect(findFeaturedPost(POSTS)?.slug).toBe("b");
		expect(findFeaturedPost(POSTS.filter((entry) => !entry.featured))?.slug).toBe("d");
		expect(findFeaturedPost([])).toBeNull();
	});
});

describe("searchPosts", () => {
	test("matches every word anywhere, titles first, and nothing for a blank query", () => {
		expect(searchPosts(POSTS, "caching").map((entry) => entry.slug)).toEqual(["c"]);
		expect(searchPosts(POSTS, "a").map((entry) => entry.slug)[0]).toBe("a");
		expect(searchPosts(POSTS, "caching css")).toEqual([]);
		expect(searchPosts(POSTS, "   ")).toEqual([]);
	});
});
