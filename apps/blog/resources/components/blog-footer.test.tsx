// @vitest-environment happy-dom

/**
 * Tests the blog footer's markup: each column a named navigation landmark with its heading,
 * the feeds and the Fediverse handle a reader follows, and the link to the CMS dashboard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { ACTOR_ID } from "~/config/activitypub";
import { BlogFooter, FEDIVERSE_HANDLE, FOOTER_TRACKS } from "~/resources/components/blog-footer";
import routes from "~/routes/web";

/** The footer's HTML, parsed so a test queries elements rather than matching strings. */
async function renderFooter() {
	let html = await renderToString(<BlogFooter />);
	let template = document.createElement("template");
	template.innerHTML = html;
	return template.content;
}

describe("BlogFooter", () => {
	test("labels every column as a navigation landmark headed by its title", async () => {
		let footer = await renderFooter();
		let landmarks = Array.from(footer.querySelectorAll("nav"));

		expect(landmarks.map((nav) => nav.getAttribute("aria-label"))).toEqual(
			FOOTER_TRACKS.flat().map((column) => column.title),
		);
		for (let nav of landmarks) {
			expect(nav.querySelector("h2")?.textContent).toBe(nav.getAttribute("aria-label"));
		}
	});

	test("stacks Elsewhere under Support in the last of four tracks", async () => {
		let footer = await renderFooter();
		let tracks = Array.from(footer.querySelector("footer")?.children ?? []).filter(
			(child) => child.querySelector("nav") !== null,
		);

		expect(tracks).toHaveLength(4);
		expect(
			Array.from(tracks[3]?.querySelectorAll("nav") ?? []).map((nav) =>
				nav.getAttribute("aria-label"),
			),
		).toEqual(["Support", "Elsewhere"]);
	});

	test("links the global feeds and the Fediverse actor", async () => {
		let footer = await renderFooter();
		let follow = footer.querySelector('nav[aria-label="Follow"]');
		let hrefs = Array.from(follow?.querySelectorAll("a") ?? []).map((a) => a.getAttribute("href"));

		expect(hrefs).toEqual([
			routes.rss.feed.href(),
			routes.atom.feed.href(),
			routes.jsonFeed.feed.href(),
			ACTOR_ID,
		]);
		expect(FEDIVERSE_HANDLE).toBe("@hello@sergiodxa.com");
		expect(follow?.querySelector(`a[href="${ACTOR_ID}"]`)?.textContent).toBe(FEDIVERSE_HANDLE);
	});

	test("marks only the author's off-site profiles as rel=me", async () => {
		let footer = await renderFooter();
		let rels = Array.from(footer.querySelectorAll("a[rel~='me']")).map((a) =>
			a.getAttribute("href"),
		);

		expect(rels).toEqual([
			"https://x.com/sergiodxa",
			"https://github.com/sergiodxa",
			"https://sdxc.sergiodxa.com",
		]);
	});

	test("links the CMS dashboard", async () => {
		let footer = await renderFooter();

		expect(footer.querySelector(`a[href="${routes.cms.dashboard.href()}"]`)?.textContent).toBe(
			"Dashboard",
		);
	});
});
