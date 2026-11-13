/**
 * Tests Delta's repository settings through the real router: General saves explicitly and
 * keeps every character of a refused save, features save as they switch, the branch rule
 * saves whole, and archive and delete answer with Undo and lose nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";
import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";

/** Delta's screen addresses. */
const href = demoAppHref("delta");

/** Where Delta's forms post. */
const action = demoAppActionHref("delta");

/** Fetches one of Delta's screens with the visitor's cookies. */
async function page(path: string, cookie = ""): Promise<{ status: number; body: string }> {
	let response = await fetchApp(href(path), { headers: cookie ? { Cookie: cookie } : {} });
	return { status: response.status, body: await response.text() };
}

/** Posts a form, answering its status, redirect, body and the cookies it leaves. */
async function post(
	path: string,
	fields: Array<[string, string]>,
	cookie = "",
	headers: Record<string, string> = {},
): Promise<{ status: number; location: string | null; body: string; cookie: string }> {
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
		body: await response.text(),
		cookie: [...jar.values()].join("; "),
	};
}

/** A General save's fields. */
function general(name: string, description = "A demo.", website = ""): Array<[string, string]> {
	return [
		["intent", "general"],
		["name", name],
		["description", description],
		["website", website],
	];
}

describe("Delta's settings", () => {
	test("open on General beside the section nav, with one h1", async () => {
		let { body, status } = await page("delta/settings");

		expect(status).toBe(200);
		expect(body).toContain('name="name"');
		expect(body).toContain(`href="${href("delta/settings/branches")}"`);
		expect([...body.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
	});

	test("save General explicitly and show what was saved", async () => {
		let saved = await post("delta/settings", general("delta-next", "Renamed for the demo."));

		expect(saved.status).toBe(303);
		expect(saved.location).toMatch(/\/delta\/settings\/general\?toast=settings-saved\./);
		let { body } = await page("delta/settings/general", saved.cookie);
		expect(body).toContain('value="delta-next"');
		expect(body).toContain("Renamed for the demo.");
	});

	test("refuse a name with spaces, keeping every field as typed and saying why", async () => {
		let refused = await post("delta/settings", general("my repo", "Kept as typed.", "sdxc.dev"));

		expect(refused.status).toBe(400);
		expect(refused.body).toContain('value="my repo"');
		expect(refused.body).toContain("Kept as typed.");
		expect(refused.body).toContain('value="sdxc.dev"');
		expect(refused.body).toContain('aria-invalid="true"');
		expect(refused.body).toContain("without spaces");
		expect(refused.body).toContain("starts with https://");
		expect(refused.cookie).toBe("");
	});

	test("answer a refused save aimed at main with that frame alone", async () => {
		let refused = await post("delta/settings", general(""), "", {
			"X-Remix-Frame": "true",
			"X-Remix-Target": "main",
		});

		expect(refused.status).toBe(400);
		expect(refused.body).not.toContain('data-slot="app-shell"');
		expect(refused.body).toContain("data-main-screen");
		expect(refused.body).toContain("Enter a name for the repository.");
	});

	test("save a feature switch as it flips, without a toast", async () => {
		let saved = await post("delta/settings", [
			["intent", "features"],
			["issues", "on"],
			["wiki", "on"],
		]);

		expect(saved.location).toBe(href("delta/settings/general"));
		let { body } = await page("delta/settings", saved.cookie);
		expect(body).toMatch(/name="wiki"[^>]*checked|checked[^>]*name="wiki"/);
		expect(body).not.toMatch(/name="projects"[^>]*checked|checked[^>]*name="projects"/);
	});

	test("save the protection rule on main whole", async () => {
		let saved = await post("delta/settings/branches", [
			["intent", "protection"],
			["reviews", "2"],
			["linear", "on"],
		]);

		expect(saved.location).toMatch(/toast=protection-saved\./);
		let { body } = await page("delta/settings/branches", saved.cookie);
		expect(body).toMatch(/<option[^>]*value="2"[^>]*selected/);
		expect(body).not.toMatch(/name="checks"[^>]*checked|checked[^>]*name="checks"/);
	});

	test("archive with Undo, and say the repository is read-only until then", async () => {
		let archived = await post("delta/settings/archive", []);

		expect(archived.location).toMatch(/toast=repo-archived\./);
		expect((await page("delta/settings", archived.cookie)).body).toContain(
			"This repository is archived",
		);
		let undone = await post("delta/settings/unarchive", [], archived.cookie);
		expect((await page("delta/settings", undone.cookie)).body).not.toContain(
			"This repository is archived",
		);
	});

	test("delete only once the full name is typed, then offer Undo", async () => {
		let wrong = await post("delta/settings/delete", [["confirmation", "delta"]]);
		let deleted = await post("delta/settings/delete", [["confirmation", "sdxc/delta"]]);

		expect(wrong.location).toBe(href("delta/settings/general"));
		expect(wrong.cookie).toBe("");
		expect(deleted.location).toMatch(/\/demo\/apps\/delta\?toast=repo-deleted\./);
		let restored = await post("delta/settings/restore", [], deleted.cookie);
		expect(restored.location).toMatch(/toast=repo-restored\./);
	});

	test("Reset the demo brings every setting back", async () => {
		let saved = await post("delta/settings", general("delta-next"));
		let reset = await post("reset", [], saved.cookie);

		expect(reset.cookie).toBe("");
		expect((await page("delta/settings", reset.cookie)).body).toContain('value="delta"');
	});

	test("answer the app's 404 for a settings page it doesn't have", async () => {
		expect((await page("delta/settings/nope")).status).toBe(404);
	});
});
