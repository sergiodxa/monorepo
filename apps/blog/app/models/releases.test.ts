/**
 * Tests the weekly releases post against a migrated in-memory D1: the week's post is written
 * once with its package list as Markdown, a second write for the same week leaves the first
 * as it stands, and the post is found by `kind:release` like any other kind.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vite-plus/test";

import { RELEASE_TITLE, releaseContent } from "~/app/models/releases";
import { PostSearch } from "~/app/models/search";
import { testDatabase } from "~/app/test/database";
import { seedAuthor } from "~/app/test/fixtures";
import { bindModels } from "~/app/test/models";

/** A week's summary with two packages. */
const SUMMARY = {
	slug: "2026-w42",
	packages: [
		{ name: "@sdxc/result", url: "https://www.npmjs.com/package/@sdxc/result" },
		{ name: "remix-utils", url: "https://www.npmjs.com/package/remix-utils" },
	],
};

let db: Database;
let author: string;

beforeEach(async () => {
	db = await testDatabase();
	author = await seedAuthor(db);
});

describe("releaseContent", () => {
	test("lists every package as a Markdown link, in order", () => {
		expect(releaseContent(SUMMARY.packages)).toBe(
			[
				"- [@sdxc/result](https://www.npmjs.com/package/@sdxc/result)",
				"- [remix-utils](https://www.npmjs.com/package/remix-utils)",
			].join("\n"),
		);
	});
});

describe("Releases.publishWeek", () => {
	test("writes the week's post published now, titled and listing its packages", async () => {
		let models = bindModels(db);
		let id = unwrap(await models.releases.publishWeek(SUMMARY, author));

		let post = await models.releases.findBySlug("2026-w42");
		expect(post?.id).toBe(id);
		expect(post?.published_at).toBeNull();
		expect(post?.meta.title).toBe(RELEASE_TITLE);
		expect(post?.meta.content).toBe(releaseContent(SUMMARY.packages));
		expect(post?.meta.packages).toEqual(SUMMARY.packages);
	});

	test("leaves a week's existing post as the author left it", async () => {
		let models = bindModels(db);
		let id = unwrap(await models.releases.publishWeek(SUMMARY, author));
		unwrap(await models.releases.update(id ?? "", { meta: { content: "Edited." } }));

		expect(unwrap(await models.releases.publishWeek(SUMMARY, author))).toBeNull();
		expect((await models.releases.findAll()).map((post) => post.meta.content)).toEqual(["Edited."]);
	});

	test("never recreates a week whose post was deleted", async () => {
		let models = bindModels(db);
		let id = unwrap(await models.releases.publishWeek(SUMMARY, author));
		await models.releases.tombstone(id ?? "");

		expect(unwrap(await models.releases.publishWeek(SUMMARY, author))).toBeNull();
		expect(await models.releases.findBySlug("2026-w42")).toBeNull();
	});

	test("is found by kind:release under its permalink", async () => {
		unwrap(await bindModels(db).releases.publishWeek(SUMMARY, author));

		let hits = await PostSearch.query(db, { query: "kind:release remix" });
		expect(hits.map((hit) => [hit.kind, hit.url])).toEqual([["release", "/releases/2026-w42"]]);
	});
});
