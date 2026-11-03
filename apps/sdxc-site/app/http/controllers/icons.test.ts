/**
 * The `@sdxc/icons` gallery end to end: which controller each address reaches, the credit
 * to Lucide every visitor sees, the filter, the versioned sprite's cache policy, and the
 * icon page, frame and markdown twin drawn from the same entry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LUCIDE_VERSION } from "@sdxc/icons";
import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

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

	test("points every tile into the sprite of the version it ships", async () => {
		let body = await (await fetchApp("/api/icons")).text();
		expect(body).toContain(`/api/icons/sprite.svg?v=${LUCIDE_VERSION}#heart`);
	});

	test("keeps only the icons matching ?q=", async () => {
		let body = await (await fetchApp("/api/icons?q=heart+crack")).text();
		expect(body).toContain('href="/api/icons/heart-crack"');
		expect(body).not.toContain('href="/api/icons/zap"');
	});

	test("tells the reader when nothing matches and links back to every icon", async () => {
		let body = await (await fetchApp("/api/icons?q=zzzz")).text();
		expect(body).toContain("No icon matches");
	});
});

describe("GET /api/icons/sprite.svg", () => {
	test("is immutable under the version the build ships", async () => {
		let response = await fetchApp(`/api/icons/sprite.svg?v=${LUCIDE_VERSION}`);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("image/svg+xml");
		expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
		expect(body.startsWith('<svg xmlns="http://www.w3.org/2000/svg">')).toBe(true);
		expect(body).toContain('<symbol id="heart" viewBox="0 0 24 24">');
	});

	test("answers any other version on a short policy, so an old address never pins new icons", async () => {
		let stale = await fetchApp("/api/icons/sprite.svg?v=0.0.1");
		let bare = await fetchApp("/api/icons/sprite.svg");

		expect(stale.headers.get("cache-control")).toBe("public, max-age=3600");
		expect(bare.headers.get("cache-control")).toBe("public, max-age=3600");
		expect(await stale.text()).toContain('<symbol id="heart"');
	});
});

describe("GET /api/icons/:icon", () => {
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
		expect(body).not.toContain("sprite.svg");
	});
});
