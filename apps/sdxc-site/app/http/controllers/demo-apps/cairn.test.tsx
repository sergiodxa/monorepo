/**
 * Tests Cairn, the issue tracker demo, through the real router: filters, grouping and the
 * open issue live in the address, every edit posts to the page it was made on and comes back
 * remembered in the visitor's own cookies, the bulk bar edits many at once, a new issue opens
 * beside its team's list, the burn-up counts the visitor's edits, and personal pages never cache.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";
import { demoAppActionHref, demoAppFrameHref, demoAppHref } from "~/resources/views/demo-apps";

/** Cairn's addresses. */
const href = demoAppHref("cairn");

/** Cairn's frame addresses. */
const frame = demoAppFrameHref("cairn");

/** Where Cairn's create and reset forms post. */
const action = demoAppActionHref("cairn");

/**
 * Posts a form as a browser without scripts does, carrying the visitor's cookies.
 *
 * @param url The address the form posts to.
 * @param fields The form's fields, a field repeated by listing it twice.
 * @param cookie The visitor's `Cookie` header.
 */
async function post(url: string, fields: Array<[string, string]>, cookie = ""): Promise<Response> {
	return await fetchApp(url, {
		method: "POST",
		body: new URLSearchParams(fields),
		headers: { cookie },
	});
}

/** Turns a response's `Set-Cookie` headers into the `Cookie` header the next request sends. */
function cookiesFrom(response: Response, previous = ""): string {
	let jar = new Map(
		previous
			.split(";")
			.map((pair) => pair.trim())
			.filter(Boolean)
			.map((pair) => [pair.split("=")[0]!, pair] as const),
	);
	for (let header of response.headers.getSetCookie()) {
		let pair = header.split(";")[0]!;
		let [name = ""] = pair.split("=");
		if (/Max-Age=0/.test(header)) jar.delete(name);
		else jar.set(name, pair);
	}
	return [...jar.values()].join("; ");
}

/** A page's HTML as the visitor with `cookie` sees it. */
async function page(path: string, cookie = ""): Promise<string> {
	return await (await fetchApp(href(path), { headers: { cookie } })).text();
}

/** The ids of the rows a list shows, in order. */
function rows(body: string): string[] {
	return [...body.matchAll(/<li data-issue="([A-Z]+-\d+)"/g)].map(([, id]) => id!);
}

/** The rows under one group heading of a list. */
function group(body: string, key: string): string[] {
	let start = body.indexOf(`data-group="${key}"`);
	if (start === -1) return [];
	let end = body.indexOf("data-group=", start + 10);
	return rows(body.slice(start, end === -1 ? undefined : end));
}

describe("Cairn lists", () => {
	test("My issues lists only the signed-in person's issues, grouped by status", async () => {
		let body = await page("");
		expect(rows(body)).toContain("WEB-118");
		expect(rows(body)).not.toContain("WEB-124");
		expect(group(body, "started")).toEqual(["WEB-140", "WEB-118"]);
	});

	test("filters, grouping and density are read from the address", async () => {
		let todo = await page("team/web?status=todo");
		expect(rows(todo).length).toBeGreaterThan(0);
		expect(group(todo, "started")).toEqual([]);

		let byPriority = await page("team/web?group=priority");
		expect(group(byPriority, "1")).toEqual(["WEB-124", "WEB-139", "WEB-140"]);

		let comfortable = await page("team/web?density=comfortable");
		expect(comfortable).toContain("--cairn-row-height: 2.875rem");

		let none = await page("team/web?q=zebra");
		expect(rows(none)).toEqual([]);
		expect(none).toContain("No issues match");
	});

	test('the Assignee filter names the signed-in person "My issues"', async () => {
		let body = await page("team/web");
		let menu = body.slice(body.indexOf('id="cairn-issues-facet-assignee"'));
		expect(menu).toMatch(/value="ilse"[\s\S]*?My issues/);
		expect(menu.slice(0, menu.indexOf("</fieldset>"))).not.toContain(">Ilse Varga<");
	});

	test("an open issue sits beside the list, which keeps its filters in every row link", async () => {
		let body = await page("team/web?label=bug&issue=WEB-124");
		expect(body).toContain('data-issue-detail="WEB-124"');
		expect(body).toContain("Wallet buttons jump when the page finishes loading");
		expect(body).toContain(`href="${href("team/web?label=bug&amp;issue=WEB-140")}"`);
	});

	test("saved views and projects narrow the list to their scope", async () => {
		let urgent = await page("views/urgent");
		expect(rows(urgent)).toContain("WEB-124");
		expect(rows(urgent)).not.toContain("WEB-136");

		let project = await page("projects/offline-drafts");
		expect(new Set(rows(project))).toEqual(new Set(["WEB-130", "WEB-131", "WEB-132", "WEB-133"]));
	});
});

describe("Cairn edits", () => {
	test("a status pick posts to the page it was made on and comes back remembered", async () => {
		let from = href("team/web?issue=WEB-121");
		let response = await post(from, [
			["issue", "WEB-121"],
			["status", "done"],
		]);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(from);
		let cookie = cookiesFrom(response);
		expect(cookie).toMatch(/^cairn\.i\.WEB-121=done\.3\.ilse\.\d+$/);

		let body = await page("team/web?issue=WEB-121", cookie);
		expect(group(body, "done")).toContain("WEB-121");
		expect(body).toContain("moved this to Done");
		expect(body).toContain('data-state="saved"');
	});

	test("an edit at Cairn's own path wins over an older one a previous visit left at /demo", async () => {
		let fresh = "cairn.i.WEB-121=todo.3.ilse.1794519000";
		let stale = "cairn.i.WEB-121=done.3.ilse.1794500000";
		let body = await page("team/web", `${fresh}; ${stale}`);
		expect(group(body, "todo")).toContain("WEB-121");
		expect(group(body, "done")).not.toContain("WEB-121");
	});

	test("one edit keeps the fields another edit set", async () => {
		let from = href("team/web?issue=WEB-121");
		let first = cookiesFrom(
			await post(from, [
				["issue", "WEB-121"],
				["status", "started"],
			]),
		);
		let second = cookiesFrom(
			await post(
				from,
				[
					["issue", "WEB-121"],
					["priority", "1"],
				],
				first,
			),
			first,
		);
		expect(second).toMatch(/cairn\.i\.WEB-121=started\.1\.ilse\./);

		let unassigned = cookiesFrom(
			await post(
				from,
				[
					["issue", "WEB-121"],
					["assignee", "none"],
				],
				second,
			),
			second,
		);
		expect(unassigned).toMatch(/cairn\.i\.WEB-121=started\.1\.-\./);
	});

	test("a field sent twice reads as its last value, as a board drop and a menu send it", async () => {
		let from = href("team/web/board");
		let response = await post(from, [
			["issue", "WEB-130"],
			["status", "todo"],
			["status", "review"],
		]);
		expect(response.headers.get("Location")).toBe(from);
		expect(cookiesFrom(response)).toMatch(/cairn\.i\.WEB-130=review\./);
	});

	test("a card dropped before another keeps that place on the board, and a menu move keeps it too", async () => {
		let column = (body: string, status: string) => {
			let start = body.indexOf(`data-sortable-list="${status}"`);
			let end = body.indexOf("data-sortable-list=", start + 1);
			let slice = body.slice(start, end === -1 ? undefined : end);
			return [...slice.matchAll(/data-sortable-item="([A-Z]+-\d+)"/g)].map(([, id]) => id!);
		};
		let before = column(await page("team/web/board"), "todo");
		let [first, , third] = before;

		let cookie = cookiesFrom(
			await post(href("team/web/board"), [
				["issue", third!],
				["status", "todo"],
				["before", first!],
			]),
		);
		expect(column(await page("team/web/board", cookie), "todo").slice(0, 2)).toEqual([
			third,
			first,
		]);

		let moved = cookiesFrom(
			await post(
				href("team/web/board"),
				[
					["issue", third!],
					["priority", "4"],
				],
				cookie,
			),
			cookie,
		);
		expect(column(await page("team/web/board", moved), "todo")[0]).toBe(third);

		let last = cookiesFrom(
			await post(
				href("team/web/board"),
				[
					["issue", first!],
					["status", "started"],
					["before", ""],
				],
				moved,
			),
			moved,
		);
		expect(column(await page("team/web/board", last), "started").at(-1)).toBe(first);
	});

	test("My issues posts under its other address, which answers the same list", async () => {
		let response = await post(href("my?issue=WEB-118"), [
			["issue", "WEB-118"],
			["status", "done"],
		]);
		expect(response.headers.get("Location")).toBe(href("my?issue=WEB-118"));
		expect(rows(await page("my"))).toEqual(rows(await page("")));
	});

	test("an unknown issue, a value no menu offers, or a page with no screen is refused", async () => {
		expect(
			(
				await post(href("team/web"), [
					["issue", "WEB-999"],
					["status", "done"],
				])
			).status,
		).toBe(400);
		expect(
			(
				await post(href("team/web"), [
					["issue", "WEB-121"],
					["status", "lost"],
				])
			).status,
		).toBe(400);
		expect(
			(
				await post(href("team/web"), [
					["issue", "WEB-121"],
					["assignee", "nobody"],
				])
			).status,
		).toBe(400);
		expect(
			(
				await post(href("nowhere"), [
					["issue", "WEB-121"],
					["status", "done"],
				])
			).status,
		).toBe(400);
	});

	test("the bulk bar edits every checked issue and names what it did once", async () => {
		let from = href("team/web?status=todo");
		let response = await post(from, [
			["bulk", "1"],
			["ids", "WEB-124"],
			["ids", "WEB-135"],
			["intent", "status-done"],
		]);
		let location = response.headers.get("Location") ?? "";
		expect(location).toMatch(
			/^\/demo\/apps\/cairn\/team\/web\?status=todo&toast=bulk-status-done\./,
		);
		let cookie = cookiesFrom(response);
		expect(cookie).toContain("cairn.i.WEB-124=done");
		expect(cookie).toContain("cairn.i.WEB-135=done");
		expect(await page(location.replace("/demo/apps/cairn/", ""), cookie)).toContain(
			"Issues marked done",
		);
	});

	test("a comment joins the issue's feed and lands on itself", async () => {
		let from = href("issue/WEB-140");
		let response = await post(from, [
			["issue", "WEB-140"],
			["intent", "comment"],
			["body", "Fixed by disabling Apply while the request runs."],
		]);
		expect(response.headers.get("Location")).toMatch(/\/issue\/WEB-140#comment-v-/);
		let body = await page("issue/WEB-140", cookiesFrom(response));
		expect(body).toContain("Fixed by disabling Apply while the request runs.");
	});
});

describe("Cairn create", () => {
	test("a titled issue opens beside its team's list with the next id", async () => {
		let response = await post(action("new"), [
			["title", "Rate-limit the export endpoint"],
			["description", "Ten a minute per account."],
			["team", "plat"],
			["status", "todo"],
			["priority", "2"],
			["assignee", "jonah"],
			["project", ""],
		]);
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(href("team/plat?issue=PLT-216"));

		let body = await page("team/plat?issue=PLT-216", cookiesFrom(response));
		expect(body).toContain("Rate-limit the export endpoint");
		expect(body).toContain("Ten a minute per account.");
	});

	test("an untitled issue answers the form again with everything typed and what to fix", async () => {
		let response = await post(action("new"), [
			["title", "  "],
			["description", "Keep this text."],
			["team", "web"],
			["status", "started"],
			["priority", "1"],
			["assignee", "mei"],
			["project", "checkout-v2"],
		]);
		let body = await response.text();
		expect(response.status).toBe(400);
		expect(body).toContain("Give the issue a title, then create it again.");
		expect(body).toContain("Keep this text.");
		expect(body).toMatch(/<option value="mei" selected/);
	});
});

describe("Cairn screens", () => {
	test("pages drawn for one visitor are never cached, and Reset clears them", async () => {
		let edited = cookiesFrom(
			await post(href("team/web"), [
				["issue", "WEB-121"],
				["status", "done"],
			]),
		);
		let personal = await fetchApp(href("team/web"), { headers: { cookie: edited } });
		expect(personal.headers.get("ETag")).toBeNull();

		let reset = await post(action("reset"), [], edited);
		let cleared = reset.headers.getSetCookie();
		expect(cleared).toContainEqual(
			expect.stringMatching(/^cairn\.i\.WEB-121=; Path=\/demo\/apps\/cairn; Max-Age=0/),
		);
		expect(cleared).toContainEqual(
			expect.stringMatching(/^cairn\.i\.WEB-121=; Path=\/demo; Max-Age=0/),
		);
	});

	test("every cookie is sent only under Cairn's own path, which its frames sit under too", async () => {
		let response = await post(href("team/web"), [
			["issue", "WEB-121"],
			["status", "done"],
		]);
		expect(response.headers.getSetCookie()).toEqual([
			expect.stringMatching(/^cairn\.i\.WEB-121=[^;]+; Path=\/demo\/apps\/cairn;/),
		]);
		expect(frame("cycles/web-24/stats")).toBe("/demo/apps/cairn/frames/cycles/web-24/stats");
		expect((await fetchApp(frame("cycles/web-24/stats"))).status).toBe(200);
	});

	test("the roadmap draws late projects with a tail and keeps closed ones on their own tab", async () => {
		let items = (body: string) => [...body.matchAll(/data-slot="roadmap-item"/g)].length;
		let active = await page("roadmap");
		expect(items(active)).toBe(6);
		expect([...active.matchAll(/data-slot="roadmap-late"/g)]).toHaveLength(2);

		let closed = await page("roadmap?show=closed");
		expect(items(closed)).toBe(2);
		expect(closed).not.toContain('data-slot="roadmap-late"');
	});

	test("a cycle's frames answer, and the burn-up counts the visitor's edits", async () => {
		expect((await fetchApp(frame("cycles/web-24/stats"))).status).toBe(200);
		expect((await fetchApp(frame("cycles/web-99/chart"))).status).toBe(404);

		let before = await (await fetchApp(frame("cycles/web-24/stats"))).text();
		let cookie = cookiesFrom(
			await post(href("team/web"), [
				["issue", "WEB-124"],
				["status", "done"],
			]),
		);
		let after = await (
			await fetchApp(frame("cycles/web-24/stats"), { headers: { cookie } })
		).text();
		let completed = (body: string) => /(\d+) of \d+ points/.exec(body)?.[1];
		expect(Number(completed(after))).toBe(Number(completed(before)) + 2);
	});

	test("the inbox opens an issue beside it and counts what is unread", async () => {
		let body = await page("inbox?issue=PLT-214");
		expect(body).toContain('data-issue-detail="PLT-214"');
		expect(body).toContain("2 unread");
	});
});

/** A page's answer for one of its frames, as a targeted link, form or reload asks for it. */
async function frameOf(path: string, target: string, cookie = ""): Promise<string> {
	let response = await fetchApp(href(path), {
		headers: { cookie, "X-Remix-Frame": "true", "X-Remix-Target": target },
	});
	expect(response.status).toBe(200);
	expect(response.headers.get("Vary")).toContain("X-Remix-Target");
	return await response.text();
}

describe("Cairn frames", () => {
	test("a list screen answers its view frame with the list and the open issue, and no shell", async () => {
		let view = await frameOf("team/web?issue=WEB-121", "cairn-view");
		expect(rows(view)).toContain("WEB-121");
		expect(view).toContain('data-issue-detail="WEB-121"');
		expect(view).not.toContain('data-slot="app-shell"');
		expect(view).not.toContain('id="cairn-sidebar"');
	});

	test("the issue frame answers only the open issue", async () => {
		let issue = await frameOf("team/web?issue=WEB-121", "cairn-issue");
		expect(issue).toContain('data-issue-detail="WEB-121"');
		expect(rows(issue)).toEqual([]);
		expect(issue).not.toContain('data-slot="filter-bar"');
	});

	test("a board answers its board frame with the cards, and its sheet frame with only the sheet", async () => {
		let board = await frameOf("team/web/board?issue=WEB-130", "cairn-board");
		expect(board).toContain('data-sortable-item="WEB-130"');
		expect(board).toContain('id="cairn-issue-sheet"');
		expect(board).not.toContain('data-slot="app-shell"');

		let sheet = await frameOf("team/web/board?issue=WEB-130", "cairn-sheet");
		expect(sheet).toContain('id="cairn-issue-sheet"');
		expect(sheet).not.toContain("data-sortable-item=");
		expect(await frameOf("team/web/board", "cairn-sheet")).not.toContain("cairn-issue-sheet");
	});

	test("the roadmap answers its timeline frame per tab", async () => {
		let closed = await frameOf("roadmap?show=closed", "cairn-roadmap");
		expect([...closed.matchAll(/data-slot="roadmap-item"/g)]).toHaveLength(2);
		expect(closed).not.toContain('data-slot="app-shell"');
	});

	test("a post aimed at the view frame redirects to the page, which answers that frame with the edit", async () => {
		let from = href("team/web?issue=WEB-121");
		let response = await fetchApp(from, {
			method: "POST",
			body: new URLSearchParams([
				["issue", "WEB-121"],
				["status", "done"],
			]),
			headers: { "X-Remix-Frame": "true", "X-Remix-Target": "cairn-view" },
		});
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(from);

		let view = await frameOf("team/web?issue=WEB-121", "cairn-view", cookiesFrom(response));
		expect(group(view, "done")).toContain("WEB-121");
		expect(view).not.toContain('data-slot="app-shell"');
	});

	test("every in-app link and form names the frame it reloads, and still works as a plain page", async () => {
		let list = await page("team/web?issue=WEB-121");
		expect(list).toMatch(/<a href="[^"]*issue=WEB-124"[^>]*data-rmx-target="cairn-issue"/);
		expect(list).toMatch(
			/<form id="cairn-issues-form" method="get"[^>]*data-rmx-target="cairn-view"/,
		);
		expect(list).toMatch(/<form id="cairn-props-WEB-121"[^>]*data-rmx-target="cairn-view"/);
		expect(list).toMatch(
			/aria-label="Next issue"[^>]*data-rmx-target="cairn-issue"|data-rmx-target="cairn-issue"[^>]*aria-label="Next issue"/,
		);

		let plain = await page("team/web");
		expect(plain).toMatch(/<a href="[^"]*issue=WEB-124"[^>]*data-rmx-target="cairn-view"/);

		let board = await page("team/web/board");
		expect(board).toMatch(
			/<form[^>]*data-sortable-form="WEB-130"[^>]*data-rmx-target="cairn-board"|<form[^>]*data-rmx-target="cairn-board"[^>]*data-sortable-form="WEB-130"/,
		);
		expect(board).toMatch(/<a href="[^"]*issue=WEB-130"[^>]*data-rmx-target="cairn-sheet"/);

		let roadmap = await page("roadmap");
		expect(roadmap).toMatch(
			/href="\/demo\/apps\/cairn\/roadmap\?show=closed"[^>]*data-rmx-target="cairn-roadmap"/,
		);
	});
});
