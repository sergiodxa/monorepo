/**
 * Tests the sponsors page through the real router, over a site cache that holds a
 * stored roster: the pitch always draws, and each list draws only when it names someone,
 * with current sponsors named and past ones listed by picture.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { MemoryCache } from "@sdxc/cache/memory";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { SponsorRoster } from "~/app/services/sponsors";

/** The cache every page reads the roster from, replaced per test. */
let cache = new MemoryCache();

vi.doMock("~/app/services/cache", () => ({ siteCache: () => cache }));

let { fetchApp } = await import("~/app/lib/test/router");
let { SPONSORS_CACHE_KEY } = await import("~/app/services/sponsors");

/** A sponsor whose every field is derived from their login. */
function sponsor(login: string) {
	return {
		login,
		name: `${login} the sponsor`,
		avatarUrl: `https://avatars.example.test/${login}`,
		url: `https://github.com/${login}`,
	};
}

/** Stores `roster` where the pages read it. */
async function store(roster: SponsorRoster) {
	await cache.write(SPONSORS_CACHE_KEY, roster);
}

beforeEach(() => {
	cache = new MemoryCache();
});

describe("GET /sponsors", () => {
	test("makes the case and links GitHub Sponsors while no sponsor is known", async () => {
		let response = await fetchApp("/sponsors");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("Fund the work behind sdxc");
		expect(body).toContain('href="https://github.com/sponsors/sergiodxa"');
		expect(body).not.toContain("Current sponsors");
		expect(body).not.toContain("Past sponsors");
	});

	test("names current sponsors and lists past ones by picture", async () => {
		await store({ current: [sponsor("ada"), sponsor("alan")], past: [sponsor("grace")] });

		let body = await (await fetchApp("/sponsors")).text();
		let current = body.slice(body.indexOf("Current sponsors"), body.indexOf("Past sponsors"));
		let past = body.slice(body.indexOf("Past sponsors"));

		expect(current).toContain("2 sponsors");
		expect(current).toContain("ada the sponsor");
		expect(current).toContain('href="https://github.com/alan"');
		expect(past).toContain("1 sponsor");
		expect(past).toContain('aria-label="grace the sponsor"');
		expect(past).toContain("https://avatars.example.test/grace");
	});

	test("leaves out the past list while every sponsor is current", async () => {
		await store({ current: [sponsor("ada")], past: [] });

		let body = await (await fetchApp("/sponsors")).text();

		expect(body).toContain("Current sponsors");
		expect(body).not.toContain("Past sponsors");
	});
});

describe("GET /", () => {
	test("names the current sponsors before the closing call, and none of the past ones", async () => {
		await store({ current: [sponsor("ada")], past: [sponsor("grace")] });

		let body = await (await fetchApp("/")).text();
		let named = body.indexOf("ada the sponsor");

		expect(named).toBeGreaterThan(-1);
		expect(named).toBeLessThan(body.indexOf('id="start"'));
		expect(body).not.toContain("grace the sponsor");
	});

	test("closes up around the band while nobody sponsors the work", async () => {
		let body = await (await fetchApp("/")).text();

		expect(body).not.toContain("People who fund this work");
		expect(body).not.toContain("current-sponsors");
	});
});

describe("GET /philosophy", () => {
	test("names the current sponsors and points at the sponsors page", async () => {
		await store({ current: [sponsor("ada")], past: [sponsor("grace")] });

		let body = await (await fetchApp("/philosophy")).text();

		expect(body).toContain("ada the sponsor");
		expect(body).not.toContain("grace the sponsor");
		expect(body).toContain('href="/sponsors"');
	});
});

describe("the footer", () => {
	test("names no sponsor, whoever funds the work", async () => {
		await store({ current: [sponsor("ada")], past: [] });

		let body = await (await fetchApp("/showcase")).text();
		let footer = body.slice(body.indexOf("<footer"));

		expect(footer).not.toContain("ada the sponsor");
		expect(footer).toContain('href="/sponsors"');
	});
});
