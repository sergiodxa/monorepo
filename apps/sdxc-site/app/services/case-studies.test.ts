/**
 * Tests for the case studies: every item in production and every demo has one, each
 * reads under the schema with the sections a reader can link to, and every slug is unique
 * across kinds, since one slug names one address under `/showcase`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { Markdown } from "@sdxc/markdown";
import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	CASE_STUDY_OPTIONS,
	darkScreenshotSrc,
	filterOf,
	listCaseStudySlugs,
	listShowcaseItems,
	matchesFilter,
	readCaseStudy,
	readCaseStudySource,
	readFilter,
	screenshotSrc,
	showcaseHref,
} from "~/app/services/case-studies";
import { findDemoKind, LEGACY_LANDING_SLUGS, listDemoKinds } from "~/app/services/demos";
import { kindChips, kindLabel } from "~/app/services/showcase-kinds";
import { APPLICATIONS, PRODUCTION_LANDINGS } from "~/resources/content/apps";

/** The slugs of everything in production: the applications, then the landings they serve. */
const PRODUCTION_SLUGS = [
	...APPLICATIONS.map((application) => application.directory),
	...PRODUCTION_LANDINGS.map((landing) => landing.slug),
];

/** Every slug the showcase answers: everything in production, then every demo. */
const SLUGS = [...PRODUCTION_SLUGS, ...listDemoKinds().map((demo) => demo.slug)];

/** The site's static files, where each case study's screenshots are served from. */
const PUBLIC = join(import.meta.dirname, "..", "..", "public");

describe("slugs", () => {
	test("are unique across applications, landings, docs sites and apps", () => {
		expect(new Set(SLUGS).size).toBe(SLUGS.length);
	});

	test("name each landing after its product, with its old name kept for redirects", () => {
		for (let [old, next] of Object.entries(LEGACY_LANDING_SLUGS)) {
			expect(findDemoKind(old)).toBeNull();
			expect(findDemoKind(next)).toBe("landing");
		}
	});
});

describe("case studies", () => {
	test("exist for every application and demo, and nothing else", () => {
		expect(listCaseStudySlugs()).toEqual([...SLUGS].sort());
	});

	test.each(SLUGS)("%s reads under the schema with its linkable sections", async (slug) => {
		let source = await readCaseStudySource(slug);
		expect(source, `resources/content/showcase/${slug}.md`).not.toBeNull();
		let parsed = Markdown.parse(source ?? "", CASE_STUDY_OPTIONS);
		expect(isSuccess(parsed) ? null : parsed.error.message).toBeNull();
		if (!isSuccess(parsed)) return;

		let { frontmatter } = parsed.data;
		let ids = frontmatter.shots.map((shot) => shot.id);
		expect(frontmatter.summary.length).toBeLessThanOrEqual(200);
		expect(
			frontmatter.tagline.length,
			"a tagline the social card sets on one or two lines",
		).toBeLessThanOrEqual(44);
		expect(
			existsSync(join(PUBLIC, "showcase", slug, "card.png")),
			"the social card's screenshot",
		).toBe(true);
		expect(ids.length).toBeGreaterThanOrEqual(5);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain(frontmatter.cover);
		expect(
			frontmatter.shots.filter((shot) => shot.highlight !== undefined).length,
		).toBeGreaterThanOrEqual(3);

		let body = (source ?? "").replace(/^---[\s\S]*?\n---\n/, "");
		let headings = [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1] ?? "");
		expect(
			body.slice(0, body.search(/^## /m)).trim().length,
			"a lede before the first heading",
		).toBeGreaterThan(200);
		expect(headings).toContain("The brief");
		let features = headings.filter(
			(heading) => !["The brief", "Takes after", "Where to start reading"].includes(heading),
		);
		expect(features.length).toBeGreaterThanOrEqual(3);
		if (findDemoKind(slug) !== null) expect(headings).toContain("Takes after");
		expect(body).not.toMatch(/\]\(\/demo\//);

		let prose = body.replace(/```[\s\S]*?```/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "");
		expect(prose.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(900);

		for (let id of ids) {
			let uses = body.split(`(/showcase/${slug}/${id}.webp`).length - 1;
			expect(uses, `${id} in the body`).toBe(id === frontmatter.cover ? 0 : 1);
		}
		let images = [...body.matchAll(/!\[[^\]]*\]\(([^ )]+)/g)].map((match) => match[1]);
		for (let src of images) expect(ids.map((id) => screenshotSrc(slug, id))).toContain(src);
	});

	test.each(SLUGS)(
		"%s has every screenshot its front matter lists, light and dark",
		async (slug) => {
			let result = await readCaseStudy(slug);
			if (!isSuccess(result) || result.data === null) throw new Error(`${slug} did not read`);
			for (let src of result.data.item.shots) {
				expect(existsSync(join(PUBLIC, src)), src).toBe(true);
				expect(existsSync(join(PUBLIC, darkScreenshotSrc(src))), darkScreenshotSrc(src)).toBe(true);
			}
		},
	);
});

describe("listShowcaseItems", () => {
	test("leads with everything in production, each linking to where it runs", async () => {
		let items = await listShowcaseItems();
		let production = items.filter((item) => item.kind === "production");

		expect(items.slice(0, production.length)).toEqual(production);
		expect(production.map((item) => item.slug).sort()).toEqual([...PRODUCTION_SLUGS].sort());
	});

	test("lists a product landing as a production landing, its source in the app serving it", async () => {
		let wakaba = (await listShowcaseItems()).find((item) => item.slug === "wakaba");

		expect(wakaba).toMatchObject({
			kind: "production",
			category: "landing",
			liveHref: "https://sergiodxa.com/apps/wakaba",
			sourceHref:
				"https://github.com/sergiodxa/monorepo/tree/main/apps/blog/resources/views/wakaba",
		});
	});

	test("links every demo to its address under its case study", async () => {
		for (let item of await listShowcaseItems()) {
			if (item.kind === "demo") expect(item.liveHref).toBe(`/showcase/${item.slug}/demo`);
			expect(item.href).toBe(`/showcase/${item.slug}`);
			expect(item.sourceHref).toMatch(
				/^https:\/\/github\.com\/sergiodxa\/monorepo\/tree\/main\/apps\//,
			);
		}
	});
});

describe("kindLabel", () => {
	test("names what an item is, kind and category together", () => {
		expect(kindLabel({ kind: "production", category: "app" })).toBe("Production app");
		expect(kindLabel({ kind: "production", category: "landing" })).toBe("Production landing");
		expect(kindLabel({ kind: "demo", category: "docs" })).toBe("Docs demo");
		expect(kindChips({ kind: "production", category: "app", live: true })).toEqual([
			"In production",
			"App",
		]);
		expect(kindChips({ kind: "production", category: "app", live: false })).toEqual([
			"Source only",
			"App",
		]);
		expect(kindChips({ kind: "demo", category: "landing", live: true })).toEqual([
			"Demo",
			"Landing",
		]);
		expect(filterOf({ kind: "production", category: "landing" })).toBe("production");
		expect(filterOf({ kind: "demo", category: "app" })).toBe("app");
	});
});

describe("darkScreenshotSrc", () => {
	test("names the dark capture beside the light one", () => {
		expect(darkScreenshotSrc(screenshotSrc("wayfern", "results"))).toBe(
			"/showcase/wayfern/results-dark.webp",
		);
	});
});

describe("filters", () => {
	test("read ?kind= and fall back to everything", () => {
		expect(readFilter("landing")).toBe("landing");
		expect(readFilter("nonsense")).toBe("all");
		expect(readFilter(null)).toBe("all");
	});

	test("put every demo under demo and each under its own kind", async () => {
		let items = await listShowcaseItems();
		let demos = items.filter((item) => matchesFilter(item, "demo"));

		expect(demos.every((item) => item.kind === "demo")).toBe(true);
		expect(items.filter((item) => matchesFilter(item, "production")).length).toBe(
			PRODUCTION_SLUGS.length,
		);
		expect(demos.length).toBe(listDemoKinds().length);
	});

	test("keep a product landing out of the landing demos", async () => {
		let landings = (await listShowcaseItems()).filter((item) => matchesFilter(item, "landing"));

		expect(landings.map((item) => item.slug)).toContain("keel");
		expect(landings.map((item) => item.slug)).not.toContain("wakaba");
	});

	test("name their own address", () => {
		expect(showcaseHref()).toBe("/showcase");
		expect(showcaseHref("all")).toBe("/showcase");
		expect(showcaseHref("demo")).toBe("/showcase?kind=demo");
	});
});
