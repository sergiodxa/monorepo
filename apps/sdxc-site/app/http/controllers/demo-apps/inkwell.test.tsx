/**
 * Tests the Inkwell demo through the real router: its list filters the fixtures from the
 * address, an empty search shows the no-results state with the toolbar kept, every frame a
 * screen streams answers, and each form lands on the screen and toast a CMS answers with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { withoutToastNonce } from "~/app/test/demo-apps";
import { fetchApp } from "~/app/test/router";
import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";
import inkwell from "~/resources/views/demo-apps/inkwell";

/** Inkwell's addresses. */
const href = demoAppHref("inkwell");

/** Where Inkwell's forms post. */
const action = demoAppActionHref("inkwell");

/**
 * Posts a form to Inkwell and returns where the redirect points.
 *
 * @param page The page path the form posts under.
 * @param fields The submitted fields, repeated names as repeated pairs.
 * @returns The response status and its `Location`.
 */
async function post(page: string, fields: Array<[string, string]>) {
	let response = await fetchApp(action(page), {
		method: "POST",
		body: new URLSearchParams(fields),
	});
	return { status: response.status, location: response.headers.get("Location") };
}

/**
 * Fetches one of Inkwell's screens as HTML.
 *
 * @param page The page path, with its query string.
 * @returns The rendered body.
 */
async function screen(page: string): Promise<string> {
	return await (await fetchApp(href(page))).text();
}

describe("Inkwell screens", () => {
	test("the drafts tab lists only drafts and marks the Drafts view current", async () => {
		let body = await screen("posts?status=draft");

		expect(body).toContain("On slow reading");
		expect(body).toContain("Field notes from the coast");
		expect(body).not.toContain("The letterpress year</a>");
		expect(body).toMatch(/aria-current="page"[^>]*>[\s\S]{0,400}Drafts/);
	});

	test("an author facet narrows the list to that author's posts", async () => {
		let body = await screen("posts?author=tomas");

		expect(body).toContain("The letterpress year");
		expect(body).not.toContain("Margins and marginalia</a>");
	});

	test("a search that matches nothing keeps the toolbar and offers Clear filters", async () => {
		let body = await screen("posts?q=typewriter");

		expect(body).toContain("No posts match");
		expect(body).toContain("typewriter");
		expect(body).toContain('aria-label="Filter posts"');
		expect(body).toContain("Clear filters");
		expect(body).not.toContain('aria-label="Posts"');
	});

	test("quick edit opens the post in a sheet that keeps its place in the list", async () => {
		let body = await screen("posts?status=published&quick=the-letterpress-year");

		expect(body).toContain('id="quick-edit"');
		expect(body).toContain('value="The letterpress year"');
		expect(body).toMatch(/2\s*\/\s*5/);
	});

	test("an edited live post offers Update, and a live post with nothing new says Published", async () => {
		expect(await screen("posts/the-letterpress-year")).toMatch(/value="update"[^>]*>Update</);
		expect(await screen("posts/a-conversation-with-a-bookbinder")).toMatch(
			/disabled[^>]*>Published</,
		);
		expect(await screen("posts/on-slow-reading")).toMatch(/value="publish"[^>]*>Publish</);
	});

	test("pages starts empty with one action", async () => {
		let body = await screen("pages");

		expect(body).toContain("No pages yet");
		expect(body).toContain(`href="${href("pages/new")}"`);
	});

	test("the media list layout and attachment sheet live in the address", async () => {
		let body = await screen("media?view=list&item=tide-pool");

		expect(body).toContain('id="attachment"');
		expect(body).toContain("A tide pool ringed with dark rock");
		expect(body).toContain(`href="${href("media?view=list&amp;item=bindery")}"`);
	});
});

describe("Inkwell frames", () => {
	/**
	 * Every frame address a page names, from its frames' sources and its Retry link's
	 * `data-rmx-src`, with HTML's escaped ampersands read back.
	 */
	function frameAddresses(body: string): string[] {
		let found = body.match(/\/demo\/frames\/apps\/inkwell\/[^"'\s<>\\]+/g) ?? [];
		return found.map((address) => address.replaceAll("&amp;", "&"));
	}

	test("every frame a screen renders answers 200 with a fragment that has no h1", async () => {
		let addresses = new Set<string>();
		for (let page of inkwell.screens) {
			for (let address of frameAddresses(await screen(page))) addresses.add(address);
		}

		expect([...addresses].map((address) => new URL(address, "https://sdxc.test").pathname)).toEqual(
			expect.arrayContaining([
				"/demo/frames/apps/inkwell/home/stats",
				"/demo/frames/apps/inkwell/home/drafts",
				"/demo/frames/apps/inkwell/home/scheduled",
				"/demo/frames/apps/inkwell/home/activity",
				"/demo/frames/apps/inkwell/home/comments",
				"/demo/frames/apps/inkwell/posts/on-slow-reading/history",
				"/demo/frames/apps/inkwell/posts/the-letterpress-year/quick",
				"/demo/frames/apps/inkwell/media/winter-train/attachment",
			]),
		);
		for (let address of addresses) {
			let response = await fetchApp(address);
			let body = await response.text();
			expect(response.status, address).toBe(200);
			expect(body, address).not.toMatch(/<h1[\s>]/);
		}
	});

	test("the quick-edit form saves back to the list its frame names", async () => {
		let body = await (
			await fetchApp("/demo/frames/apps/inkwell/posts/how-we-edit/quick?tag=Notebook")
		).text();

		expect(body).toContain(`action="${action("posts/how-we-edit/quick")}"`);
		expect(body).toContain('name="back" value="?tag=Notebook"');
		expect(body).toContain('value="How we edit"');
	});

	test("Retry reloads only the comments frame", async () => {
		let body = await (await fetchApp("/demo/frames/apps/inkwell/home/comments")).text();

		expect(body).toContain('data-rmx-target="inkwell-comments"');
		expect(body).toContain('data-rmx-src="/demo/frames/apps/inkwell/home/comments"');
	});

	test("an unknown part or record answers 404", async () => {
		for (let part of [
			"home/nothing",
			"posts/no-such-post/history",
			"media/no-such-file/attachment",
		]) {
			expect((await fetchApp(`/demo/frames/apps/inkwell/${part}`)).status, part).toBe(404);
		}
	});
});

describe("Inkwell forms", () => {
	test("bulk publish returns to the same filtered list with its toast", async () => {
		let result = await post("posts", [
			["intent", "publish"],
			["post", "on-slow-reading"],
			["post", "field-notes-from-the-coast"],
			["back", "?status=draft&quick=x&evil=1"],
		]);

		expect(result.status).toBe(303);
		expect(withoutToastNonce(result.location)).toBe(
			`${href("posts")}?status=draft&toast=posts-published`,
		);
	});

	test("bulk delete offers Undo in its toast", async () => {
		let result = await post("posts", [
			["intent", "delete"],
			["post", "how-we-edit"],
		]);
		let body = await (await fetchApp(result.location!)).text();

		expect(withoutToastNonce(result.location)).toBe(`${href("posts")}?toast=posts-deleted`);
		expect(body).toContain("Posts deleted");
		expect(body).toContain("Undo");
	});

	test("an unknown bulk action is rejected", async () => {
		let result = await post("posts", [["intent", "archive"]]);

		expect(result.status).toBe(400);
	});

	test("publishing a draft greets the editor with Post published", async () => {
		let result = await post("posts/on-slow-reading", [
			["intent", "publish"],
			["title", "On slow reading"],
		]);

		expect(withoutToastNonce(result.location)).toBe(
			`${href("posts/on-slow-reading")}?toast=post-published`,
		);
	});

	test("⌘S on a live post updates it", async () => {
		let result = await post("posts/the-letterpress-year", [["title", "The letterpress year"]]);

		expect(withoutToastNonce(result.location)).toBe(
			`${href("posts/the-letterpress-year")}?toast=post-updated`,
		);
	});

	test("an empty title answers the editor again with everything typed and the issue", async () => {
		let response = await fetchApp(action("posts/the-letterpress-year"), {
			method: "POST",
			body: new URLSearchParams([
				["intent", "update"],
				["title", "  "],
				["excerpt", "A year of ink under the fingernails"],
				["body", "The press arrived in a borrowed van."],
				["status", "draft"],
				["author", "ingrid"],
				["tags", "Essays"],
			]),
		});
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain('aria-invalid="true"');
		expect(body).toContain("Give the post a title, then save again.");
		expect(body).toContain("A year of ink under the fingernails");
		expect(body).toContain("The press arrived in a borrowed van.");
		expect(body).toMatch(/value="draft"[^>]*checked/);
		expect(body).toMatch(/value="ingrid"[^>]*checked/);
		expect([...body.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
	});

	test("an empty quick-edit title keeps the sheet open on the same list with the choices made", async () => {
		let response = await fetchApp(action("posts/how-we-edit/quick"), {
			method: "POST",
			body: new URLSearchParams([
				["title", ""],
				["slug", "our-house-style"],
				["status", "draft"],
				["author", "priya"],
				["back", "?tag=Notebook"],
			]),
		});
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain('id="quick-edit"');
		expect(body).toContain("Give the post a title, then update it again.");
		expect(body).toContain('value="our-house-style"');
		expect(body).toMatch(/value="priya"[^>]*selected/);
		expect(body).toContain(`href="${href("posts")}?tag=Notebook&amp;quick=`);
	});

	test("quick edit returns to the list it came from", async () => {
		let result = await post("posts/how-we-edit/quick", [
			["title", "How we edit"],
			["status", "published"],
			["author", "jules"],
			["back", "?tag=Notebook"],
		]);

		expect(withoutToastNonce(result.location)).toBe(
			`${href("posts")}?tag=Notebook&toast=post-updated`,
		);
	});

	test("an unknown post or file is rejected", async () => {
		expect((await post("posts/no-such-post", [["title", "x"]])).status).toBe(400);
		expect((await post("media/no-such-file", [["alt", "x"]])).status).toBe(400);
	});

	test("saving an attachment keeps its sheet open", async () => {
		let result = await post("media/tide-pool", [
			["alt", "A tide pool"],
			["back", "list"],
		]);

		expect(withoutToastNonce(result.location)).toBe(
			`${href("media")}?item=tide-pool&view=list&toast=attachment-saved`,
		);
	});

	test("settings sections save with one toast", async () => {
		expect(
			withoutToastNonce((await post("settings/publishing", [["feedCount", "20"]])).location),
		).toBe(`${href("settings/publishing")}?toast=settings-saved`);
		expect(
			withoutToastNonce(
				(
					await post("settings/team", [
						["email", "ana@example.com"],
						["role", "editor"],
					])
				).location,
			),
		).toBe(`${href("settings/team")}?toast=invite-sent`);
	});
});
