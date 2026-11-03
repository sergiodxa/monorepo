/**
 * The `@sdxc/icons` gallery end to end: which controller each address reaches, the credit
 * to Lucide every visitor sees, the filter, the symbols the tiles draw from, and the
 * icon page, frame and markdown twin drawn from the same entry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseDocument } from "@sdxc/html/document";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

/** The gallery at `path`, parsed. */
async function gallery(path: string) {
	return unwrap(parseDocument(await (await fetchApp(path)).text()));
}

/** The grid item holding the tile for `name`. */
function tile(page: Awaited<ReturnType<typeof gallery>>, name: string) {
	return page.querySelector(`a[data-icon-name="${name}"]`)?.parentElement ?? null;
}

describe("GET /api/icons", () => {
	test("draws the gallery in place of the README, crediting Lucide", async () => {
		let response = await fetchApp("/api/icons");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("These icons are Lucide’s");
		expect(body).toContain('href="https://lucide.dev/sponsor"');
		expect(body).toContain('href="https://lucide.dev/license"');
		expect(body).toContain('href="/api/icons/heart"');
	});

	test("draws every tile from symbols the page carries, needing no file of its own", async () => {
		let body = await (await fetchApp("/api/icons")).text();

		expect(body).toContain('<symbol id="lucide-heart" viewBox="0 0 24 24">');
		expect(body).toContain('<use href="#lucide-heart"');
		expect(body.match(/<symbol id="lucide-heart"/g)).toHaveLength(1);
	});

	test("hides the icons ?q= leaves out, keeping every tile for the live filter", async () => {
		let page = await gallery("/api/icons?q=heart+crack");

		expect(tile(page, "heart-crack")?.hasAttribute("hidden")).toBe(false);
		expect(tile(page, "zap")?.hasAttribute("hidden")).toBe(true);
	});

	test("draws the customization an address names, and carries it to each icon's page", async () => {
		let page = await gallery("/api/icons?size=32&stroke=1.5&color=%23FF0000");
		let grid = page.querySelector("#icon-grid");

		expect(grid?.getAttribute("style")).toContain("--icon-size: 32px");
		expect(grid?.getAttribute("style")).toContain("--icon-color: #ff0000");
		expect(page.querySelector('a[data-icon-name="heart"]')?.getAttribute("href")).toBe(
			"/api/icons/heart?size=32&stroke=1.5&color=%23ff0000",
		);
	});

	test("falls back to the default for a value out of range, keeping the rest", async () => {
		let page = await gallery("/api/icons?size=900&stroke=1.5");
		let style = page.querySelector("#icon-grid")?.getAttribute("style") ?? "";

		expect(style).toContain("--icon-size: 24px");
		expect(style).toContain("--icon-stroke-width: 1.5");
	});

	test("tells the reader when nothing matches and links back to every icon", async () => {
		let body = await (await fetchApp("/api/icons?q=zzzz")).text();
		expect(body).toContain("No icon matches");
	});
});

describe("GET /api/icons/:icon", () => {
	test("passes the customization in the address to both snippets", async () => {
		let page = await gallery("/api/icons/heart?size=32&absolute=1");
		let code = Array.from(page.querySelectorAll("pre code"), (node) => node.textContent);

		expect(code).toContain(
			'import { HeartIcon } from "@sdxc/icons";\n\n<HeartIcon size={32} absoluteStrokeWidth aria-hidden="true" />',
		);
	});

	test("shows both ways to render the icon and links it on lucide.dev", async () => {
		let response = await fetchApp("/api/icons/heart");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("HeartIcon");
		expect(body).toContain('href="https://lucide.dev/icons/heart"');
	});

	test("answers 404 for a name the package has no icon for", async () => {
		expect((await fetchApp("/api/icons/trash-2")).status).toBe(404);
	});

	test("serves the same icon as markdown", async () => {
		let response = await fetchApp("/api/icons/heart.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body.startsWith("# heart\n")).toBe(true);
		expect(body).toContain("<path ");
	});
});

describe("GET /frames/icons/:icon", () => {
	test("answers a frame load with the detail alone", async () => {
		let response = await fetchApp("/frames/icons/heart", { headers: { "X-Remix-Frame": "true" } });
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain('data-slot="icon-detail-preview"');
		expect(body).not.toContain("<html");
	});

	test("sends a tab that opens the address to the icon's page", async () => {
		let response = await fetchApp("/frames/icons/heart");
		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe("/api/icons/heart");
	});
});

describe("GET /sitemap.xml", () => {
	test("lists the gallery once and every icon's page", async () => {
		let body = await (await fetchApp("/sitemap.xml")).text();

		expect(body.match(/\/api\/icons<\/loc>/g)).toHaveLength(1);
		expect(body).toContain("/api/icons/heart</loc>");
	});
});
