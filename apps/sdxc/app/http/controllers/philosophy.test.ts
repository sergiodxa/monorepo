/**
 * Tests for `GET /philosophy` and `GET /showcase` — the two pages that argue for the
 * collection rather than document it. Both quote numbers, and a number typed into
 * prose is the failure these assertions are here to catch: each one is checked against
 * the manifests it is supposed to have been counted from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/lib/test/router";
import { readPackageFacts } from "~/app/services/packages";
import { listShowcase } from "~/app/services/showcase";

describe("GET /philosophy", () => {
	test("renders the six pillars", async () => {
		let response = await fetchApp("/philosophy");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("1. Failure is a value");
		expect(body).toContain("2. The platform is the baseline");
		expect(body).toContain("3. Implement the spec");
		expect(body).toContain("4. One contract, adapters at the edge");
		expect(body).toContain("5. Own the core, depend at the rim");
		expect(body).toContain("6. Written for Remix, usable without it");
	});

	test("counts the collection rather than quoting a written-down number", async () => {
		let facts = readPackageFacts();
		let body = await (await fetchApp("/philosophy")).text();

		expect(body).toContain(`${facts.remixTargeted} of them depend on`);
		expect(body).toContain(`${facts.standalone} of the`);
		expect(body).toContain(`So ${facts.frameworkFree} of the ${facts.published}`);
		expect(body).not.toContain("$packageCount");
		expect(body).not.toContain("$remixCount");
		expect(body).not.toContain("$standaloneCount");
		expect(body).not.toContain("$frameworkFreeCount");
	});

	test("says what the packages are written for rather than selling neutrality", async () => {
		let body = await (await fetchApp("/philosophy")).text();

		expect(body).toContain("written for Remix on Cloudflare Workers");
		expect(body).not.toContain("no framework required");
	});

	test("tells the reader what was taken back, in its own words", async () => {
		let body = await (await fetchApp("/philosophy")).text();

		expect(body).toContain("What was tried and undone");
		expect(body).toContain("service container");

		/* The page argues from the decision itself, so a reader owes nothing to a record id. */
		expect(body).not.toContain("ADR-");
		expect(body).not.toContain("docs/adr");
	});
});

describe("GET /showcase", () => {
	test("lists exactly the five curated applications", async () => {
		let response = await fetchApp("/showcase");
		let body = await response.text();

		expect(response.status).toBe(200);

		for (let entry of listShowcase()) expect(body).toContain(entry.title);
		expect(body).not.toContain("pkmn");
	});

	test("quotes each application's count from its own manifest", async () => {
		let body = await (await fetchApp("/showcase")).text();

		for (let entry of listShowcase()) {
			expect(body).toContain(`${entry.packageCount} packages`);
		}
	});

	test("labels an application with no deployment instead of hiding it", async () => {
		let body = await (await fetchApp("/showcase")).text();

		expect(body).toContain("Source only");
		expect(body).toContain("https://uptime.sergiodxa.com");
		expect(body).toContain("https://books.sergiodxa.com");
	});
});

describe("the sponsors block", () => {
	test("draws nothing at all while the list cannot be read", async () => {
		for (let path of ["/philosophy", "/showcase", "/"]) {
			let body = await (await fetchApp(path)).text();

			expect(body).not.toContain("People who fund this work");
			expect(body).not.toContain("Sponsor this work");
		}
	});
});

describe("the author's credit under a documentation page", () => {
	test("links the author, their X account and the sponsors page", async () => {
		for (let path of ["/docs", "/api", "/api/result"]) {
			let body = await (await fetchApp(path)).text();
			let note = body.slice(body.indexOf("Written by"), body.indexOf("</main>"));

			expect(note, path).toContain('href="https://sergiodxa.com"');
			expect(note, path).toContain('href="https://x.com/sergiodxa"');
			expect(note, path).toContain('href="/sponsors"');
		}
	});
});

describe("the footer's author column", () => {
	test("links the blog, X and the sponsors page while no sponsor is known", async () => {
		for (let path of ["/philosophy", "/showcase", "/"]) {
			let body = await (await fetchApp(path)).text();

			expect(body).toContain('href="https://sergiodxa.com"');
			expect(body).toContain('href="https://x.com/sergiodxa"');
			expect(body).toContain('href="/sponsors"');
		}
	});
});

describe("a package's used-by line", () => {
	test("names applications the showcase also lists", async () => {
		let body = await (await fetchApp("/api/result")).text();
		let titles = listShowcase().map((entry) => entry.title);

		expect(body).toContain("Used by");

		let tail = body.slice(body.indexOf("Used by"));
		let listed = tail.slice(0, tail.indexOf("</dd>"));
		let named = (listed.match(/>([^<>]+)<\/span>/) ?? ["", ""])[1] ?? "";

		expect(named).not.toBe("");
		for (let name of named.split(", ")) expect(titles).toContain(name);
	});
});
