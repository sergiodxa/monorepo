/**
 * Tests Delta's notifications inbox through the real router: rows link to the runs and commits
 * they name, unread rows read as unread, Done and Save keep the visitor's flags in a cookie,
 * the bulk bar's Done offers Undo, and an emptied inbox says it is all caught up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { readHistory } from "~/app/services/delta/source";
import { fetchApp } from "~/app/test/router";
import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";

/** Delta's screen addresses. */
const href = demoAppHref("delta");

/** Where Delta's forms post. */
const action = demoAppActionHref("delta");

/** Fetches one of Delta's screens with the visitor's cookies. */
async function page(path: string, cookie?: string): Promise<{ status: number; body: string }> {
	let response = await fetchApp(href(path), { headers: cookie ? { Cookie: cookie } : {} });
	return { status: response.status, body: await response.text() };
}

/** Posts a form, answering the redirect and the cookies it set as one `Cookie` header. */
async function post(
	path: string,
	fields: Array<[string, string]>,
	cookie = "",
	headers: Record<string, string> = {},
): Promise<{ status: number; location: string | null; cookie: string }> {
	let response = await fetchApp(action(path), {
		method: "POST",
		body: new URLSearchParams(fields),
		headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers },
	});
	let jar = new Map(
		cookie
			.split(";")
			.map((pair) => pair.trim())
			.filter(Boolean)
			.map((pair) => [pair.split("=")[0]!, pair] as const),
	);
	for (let header of response.headers.getSetCookie()) {
		let pair = header.split(";")[0]!;
		let name = pair.split("=")[0]!;
		if (/Max-Age=0/.test(header)) jar.delete(name);
		else jar.set(name, pair);
	}
	return {
		status: response.status,
		location: response.headers.get("Location"),
		cookie: [...jar.values()].join("; "),
	};
}

/** The notification ids a page lists, in order. */
function rows(body: string): string[] {
	return [...body.matchAll(/data-notification="([^"]+)"/g)].map(([, id]) => id!);
}

let history = await readHistory();

describe("Delta's inbox", () => {
	test("links each row to the run, the real commit, the issue or the pull request it names", async () => {
		let { body, status } = await page("notifications");

		expect(status).toBe(200);
		expect(rows(body).length).toBeGreaterThan(4);
		expect(body).toContain(`href="${href("delta/actions/runs/812")}"`);
		expect(body).toContain(`href="${href(`delta/commit/${history.commits[0]!.sha}`)}"`);
		expect(body).toContain(`href="${href("delta/issues/48")}"`);
		expect(body).toContain(`href="${href("delta/pull/58")}"`);
		expect([...body.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
	});

	test("marks unread rows for a reader who can't see the dot", async () => {
		let { body } = await page("notifications");

		expect(body).toMatch(/data-notification="ci-812" data-unread/);
		expect(body).toContain("Unread. ");
		expect(body).toContain("5 unread notifications.");
	});

	test("says why each notification arrived, and filters by it", async () => {
		let { body } = await page("notifications?reason=mention");

		expect(rows(body).sort()).toEqual(["mention-42", "mention-head", "mention-readme"]);
		expect(body).toContain("Mentioned");
	});

	test("groups by repository when the address asks", async () => {
		let { body } = await page("notifications?group=repo");

		expect(body).toContain('data-inbox-group="sdxc/delta"');
		expect(body).not.toContain('data-inbox-group="Today"');
	});

	test("a row's Done answers 204 in the background and moves it to Done", async () => {
		let done = await post(
			"notifications/ci-812",
			[
				["intent", "done"],
				["on", "true"],
				["return", "notifications"],
			],
			"",
			{
				"X-Optimistic-Toggle": "true",
			},
		);

		expect(done.status).toBe(204);
		expect(rows((await page("notifications", done.cookie)).body)).not.toContain("ci-812");
		expect(rows((await page("notifications?filter=done", done.cookie)).body)).toEqual(["ci-812"]);
	});

	test("without script, Done redirects back to the view it was pressed in", async () => {
		let done = await post("notifications/mention-head", [
			["intent", "done"],
			["on", "true"],
			["return", "notifications?group=repo"],
		]);

		expect(done.status).toBe(303);
		expect(done.location).toBe(href("notifications?group=repo"));
	});

	test("Save keeps a row in Saved", async () => {
		let saved = await post("notifications/comment-added", [
			["intent", "save"],
			["on", "true"],
		]);

		expect(rows((await page("notifications?filter=saved", saved.cookie)).body)).toEqual([
			"comment-added",
		]);
	});

	test("the bulk Done says what it did and Undo brings every row back", async () => {
		let { body } = await page("notifications");
		let all = rows(body);
		let done = await post("notifications", [
			["intent", "done"],
			...all.map((id): [string, string] => ["ids", id]),
		]);

		expect(done.location).toMatch(/toast=inbox-done\./);
		let cleared = await page("notifications", done.cookie);
		expect(rows(cleared.body)).toEqual([]);
		expect(cleared.body).toContain("All caught up");

		let undone = await post("notifications/undo", [], done.cookie);
		expect(rows((await page("notifications", undone.cookie)).body)).toEqual(all);
	});

	test("ignores ids the seed doesn't hold, and a return page outside the inbox", async () => {
		let done = await post("notifications", [
			["intent", "done"],
			["ids", "nope"],
			["return", "delta/settings"],
		]);

		expect(done.location).toBe(href("notifications"));
		expect(done.cookie).toBe("");
	});

	test("Reset the demo brings the inbox back as seeded", async () => {
		let done = await post("notifications/ci-812", [
			["intent", "done"],
			["on", "true"],
		]);
		let reset = await post("reset", [], done.cookie);

		expect(reset.cookie).toBe("");
		expect(rows((await page("notifications", reset.cookie)).body)).toContain("ci-812");
	});
});
