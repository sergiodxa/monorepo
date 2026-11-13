/**
 * Tests Delta's dashboard through the real router: it answers what needs the signed-in
 * person (their open pull requests, their issues, the failed runs), then shows the repository
 * as their settings left it and its newest real commits.
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

/** Fetches the dashboard with the visitor's cookies. */
async function dashboard(cookie = ""): Promise<string> {
	let response = await fetchApp(href(), { headers: cookie ? { Cookie: cookie } : {} });
	expect(response.status).toBe(200);
	return await response.text();
}

/** Posts a settings form and answers the cookies it leaves. */
async function post(path: string, fields: Array<[string, string]> = []): Promise<string> {
	let response = await fetchApp(demoAppActionHref("delta")(path), {
		method: "POST",
		body: new URLSearchParams(fields),
	});
	return response.headers
		.getSetCookie()
		.map((header) => header.split(";")[0]!)
		.join("; ");
}

/** The section of the page a heading id labels. */
function section(body: string, id: string): string {
	return new RegExp(`<section aria-labelledby="${id}"[\\s\\S]*?</section>`).exec(body)?.[0] ?? "";
}

let history = await readHistory();

describe("Delta's dashboard", () => {
	test("lists the signed-in person's open pull requests with who they wait on", async () => {
		let pulls = section(await dashboard(), "delta-dash-pulls");

		expect(pulls).toContain(`href="${href("delta/pull/58")}"`);
		expect(pulls).toContain(`href="${href("delta/pull/57")}"`);
		expect(pulls).not.toContain(`href="${href("delta/pull/56")}"`);
		expect(pulls).toMatch(/Waiting on|Approved by|Changes requested by/);
	});

	test("lists the open issues assigned to them, and says so when nobody waits on a review", async () => {
		let body = await dashboard();

		expect(section(body, "delta-dash-issues")).toMatch(/href="[^"]*\/delta\/issues\/\d+"/);
		expect(section(body, "delta-dash-reviews")).toContain("Nobody is waiting on your review.");
	});

	test("lists every failed run, linking to it", async () => {
		let runs = section(await dashboard(), "delta-dash-runs");

		expect(runs).toContain(`href="${href("delta/actions/runs/812")}"`);
		expect(runs).toContain(`href="${href("delta/actions/runs/804")}"`);
		expect(runs).not.toContain(`href="${href("delta/actions/runs/815")}"`);
	});

	test("ends with the repository and its newest real commits", async () => {
		let body = await dashboard();

		expect(section(body, "delta-repos")).toContain(`href="${href("delta")}"`);
		expect(section(body, "delta-recent")).toContain(
			`href="${href(`delta/commit/${history.commits[0]!.sha}`)}"`,
		);
		expect([...body.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
	});

	test("marks the repository archived, and offers Restore once it's deleted", async () => {
		let archived = await dashboard(await post("delta/settings/archive"));
		let deleted = await dashboard(
			await post("delta/settings/delete", [["confirmation", "sdxc/delta"]]),
		);

		expect(section(archived, "delta-repos")).toContain("Archived");
		expect(section(deleted, "delta-repos")).toContain("Restore repository");
		expect(section(deleted, "delta-repos")).not.toContain(`href="${href("delta")}"`);
	});
});
