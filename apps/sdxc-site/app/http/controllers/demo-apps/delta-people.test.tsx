/**
 * Tests Delta's org page and profiles through the real router: the org pins its hosted
 * repository and the packages behind it, lists its members, and each profile counts the real
 * author's contributions from git and switches years with plain links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { readHistory } from "~/app/services/delta/source";
import { fetchApp } from "~/app/test/router";
import { demoAppHref } from "~/resources/views/demo-apps";

/** Delta's screen addresses. */
const href = demoAppHref("delta");

/** Fetches one of Delta's screens. */
async function page(path: string): Promise<{ status: number; body: string }> {
	let response = await fetchApp(href(path));
	return { status: response.status, body: await response.text() };
}

/** The days a contribution graph marks with any contribution, by their date. */
function busyDays(body: string): string[] {
	return [...body.matchAll(/<td\b[^>]*>/g)].flatMap(([tag]) => {
		let level = /data-level="(\d)"/.exec(tag)?.[1];
		let date = /data-date="([\d-]+)"/.exec(tag)?.[1];
		return level !== undefined && level !== "0" && date !== undefined ? [date] : [];
	});
}

let history = await readHistory();

describe("Delta's org page", () => {
	test("pins the hosted repository first, and the packages behind it as their docs", async () => {
		let { body, status } = await page("sdxc");

		expect(status).toBe(200);
		expect(body).toContain(`href="${href("delta")}"`);
		expect(body).toContain('href="/api/ui"');
		expect(body).toContain("sdxc/highlight");
		expect([...body.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
	});

	test("lists every member with a link to their profile", async () => {
		let { body } = await page("sdxc");

		for (let handle of ["sergiodxa", "mara", "tlindqvist", "ines", "kenji", "priya"]) {
			expect(body).toContain(`href="${href(`u/${handle}`)}"`);
		}
	});

	test("shows recent activity from real commits and runs", async () => {
		let { body } = await page("sdxc");

		expect(body).toContain(`href="${href(`delta/commit/${history.commits[0]!.sha}`)}"`);
		expect(body).toMatch(/ran (CI|Deploy|Browser tests) #\d+/);
	});
});

describe("Delta's profiles", () => {
	test("count the real author's contributions on the days git says", async () => {
		let { body, status } = await page("u/sergiodxa");
		let days = new Set(history.commits.map((commit) => commit.date.slice(0, 10)));

		expect(status).toBe(200);
		expect(new Set(busyDays(body))).toEqual(days);
		expect(body).toContain(`${history.commits.length} contribution`);
		expect([...body.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
	});

	test("switch years with plain links, marking the year shown", async () => {
		let { body } = await page("u/kenji?year=2025");

		expect(body).toMatch(/href="[^"]*\/u\/kenji\?year=2025"[^>]*aria-current="page"/);
		expect(body).toContain(`href="${href("u/kenji")}"`);
		expect(body).toMatch(/contributions in 2025/);
		expect(busyDays(body).every((date) => date.startsWith("2025-"))).toBe(true);
	});

	test("draw a seeded member's graph the same on every request", async () => {
		let first = busyDays((await page("u/mara")).body);
		let second = busyDays((await page("u/mara")).body);

		expect(first.length).toBeGreaterThan(50);
		expect(second).toEqual(first);
	});

	test("ignore a year nobody contributed in, showing the last twelve months", async () => {
		let { body } = await page("u/sergiodxa?year=1999");

		expect(body).toContain("in the last year");
	});

	test("answer the app's 404 for a handle no member has", async () => {
		expect((await page("u/nobody")).status).toBe(404);
		expect((await page("sdxc/extra")).status).toBe(404);
	});
});
