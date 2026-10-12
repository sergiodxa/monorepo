/**
 * Tests the Topics model against a migrated in-memory D1: the seeded kind topics, canonical
 * query storage that makes equal searches collide, and the guard keeping a kind's topic at the
 * slug and query its fixed routes read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import { KINDS, POST_KINDS } from "~/app/models/kinds";
import { PostSearch } from "~/app/models/search";
import { isBuiltInTopic, tagQuery } from "~/app/models/topics";
import { testDatabase } from "~/app/test/database";
import { bindModels } from "~/app/test/models";

let db: Database;

beforeEach(async () => {
	db = await testDatabase();
});

describe("PostSearch.canonical", () => {
	test("writes every spelling of one search as the same text", () => {
		let spellings = [
			"tag:Remix kind:Tutorials",
			"  kind:tutorial   tag:remix ",
			"kind:TUTORIAL AND tag:REMIX",
		];
		let written = spellings.map((text) => unwrap(PostSearch.canonical(text)));
		expect(new Set(written)).toEqual(new Set(["kind:tutorial tag:remix"]));
	});

	test("reads a filter's alias as its name and a language's name as its tag", () => {
		expect(unwrap(PostSearch.canonical("locale:Spanish"))).toBe("lang:es");
		expect(unwrap(PostSearch.canonical("kind:likes OR kind:bookmark"))).toBe("kind:bookmark");
	});

	test("sorts clauses and keeps order:, quotes and exclusions", () => {
		expect(unwrap(PostSearch.canonical(`Remix "Route Pattern" -legacy order:asc`))).toBe(
			`"route pattern" -legacy remix order:asc`,
		);
		expect(unwrap(PostSearch.canonical(`tag:"React Router"`))).toBe(`tag:"react router"`);
	});

	test("refuses a blank search and one with nothing to find", () => {
		expect(isFailure(PostSearch.canonical("   "))).toBe(true);
		expect(isFailure(PostSearch.canonical("-legacy"))).toBe(true);
	});
});

describe("Topics", () => {
	test("the migration seeds one topic per kind, its query canonical", async () => {
		let topics = await bindModels(db).topics.findAll();
		let seeded = topics.filter((topic) => isBuiltInTopic(topic.slug));

		for (let kind of KINDS) {
			let topic = seeded.find((row) => row.slug === POST_KINDS[kind].topic);
			expect(topic, `the ${kind} topic`).toBeDefined();
			expect(topic?.query).toBe(unwrap(PostSearch.canonical(`kind:${kind}`)));
		}
		expect(seeded.find((row) => row.slug === "articles")).toMatchObject({
			title: "Articles",
			description: "These are my articles.",
		});
	});

	test("stores the query canonical, so an equal search collides on the unique index", async () => {
		let topics = bindModels(db).topics;
		let created = unwrap(
			await topics.create({ slug: "remix", title: "  Remix ", query: "tag:Remix  order:DESC" }),
		);
		expect(created).toMatchObject({
			title: "Remix",
			query: "tag:remix order:desc",
			description: "",
		});

		let duplicate = await topics.create({
			slug: "remix-2",
			title: "Again",
			query: "tag:REMIX order:desc",
		});
		expect(isFailure(duplicate)).toBe(true);

		expect((await topics.findByQuery("TAG:remix order:desc"))?.slug).toBe("remix");
		expect((await topics.findBy({ slug: "remix" }))?.id).toBe(created.id);
	});

	test("refuses a slug unfit for a URL, a blank title, and a query that cannot run", async () => {
		let topics = bindModels(db).topics;
		expect(isFailure(await topics.create({ slug: "Not OK", title: "T", query: "remix" }))).toBe(
			true,
		);
		expect(isFailure(await topics.create({ slug: "ok", title: " ", query: "remix" }))).toBe(true);
		expect(isFailure(await topics.create({ slug: "ok", title: "T", query: "-remix" }))).toBe(true);
	});

	test("a kind's topic edits its title and description, never its slug, query or existence", async () => {
		let topics = bindModels(db).topics;
		let articles = await topics.findBy({ slug: "articles" });
		if (articles === null) throw new Error("the migration seeds the articles topic");

		let edited = await topics.update(articles.id, {
			title: "Essays",
			description: "Longer **thoughts**.",
			query: "kind:Articles",
		});
		expect(isSuccess(edited)).toBe(true);

		expect(isFailure(await topics.update(articles.id, { slug: "essays" }))).toBe(true);
		expect(isFailure(await topics.update(articles.id, { query: "kind:tutorial" }))).toBe(true);
		expect(isFailure(await topics.delete(articles.id))).toBe(true);
		expect(await topics.findBy({ slug: "articles" })).toMatchObject({
			title: "Essays",
			query: "kind:article",
		});
	});

	test("an author's topic moves, requeries and deletes freely", async () => {
		let topics = bindModels(db).topics;
		let topic = unwrap(await topics.create({ slug: "remix", title: "Remix", query: "tag:remix" }));
		expect(isSuccess(await topics.update(topic.id, { slug: "remix-v3", query: "remix@3" }))).toBe(
			true,
		);
		expect(isSuccess(await topics.delete(topic.id))).toBe(true);
	});

	test("finds the topic listing each tag in one read, by the tag's canonical query", async () => {
		let topics = bindModels(db).topics;
		unwrap(await topics.create({ slug: "react-router", title: "RR", query: 'tag:"React Router"' }));
		unwrap(
			await topics.create({
				slug: "remix-tutorials",
				title: "R",
				query: "tag:remix kind:tutorial",
			}),
		);

		let found = await topics.findForTags(["react router", "remix", 'say "hi"']);
		expect([...found.entries()].map(([tag, topic]) => [tag, topic.slug])).toEqual([
			["react router", "react-router"],
		]);
		expect(tagQuery('say "hi"')).toBeNull();
	});
});
