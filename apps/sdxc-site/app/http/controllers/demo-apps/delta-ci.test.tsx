/**
 * Tests Delta's CI through the real router: the runs list builds real commits and filters by
 * the address, a failed run cites real lines and opens its failed step, and the running job
 * streams the rest of its log as plain text, a line at a time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { readAnchors, readHistory } from "~/app/services/delta/source";
import { fetchApp } from "~/app/test/router";
import { demoAppHref } from "~/resources/views/demo-apps";

/** Delta's screen addresses. */
const href = demoAppHref("delta");

/** Fetches one of Delta's screens. */
async function page(path: string): Promise<{ status: number; body: string }> {
	let response = await fetchApp(href(path));
	return { status: response.status, body: await response.text() };
}

/** The text of an HTML attribute value as the page escapes it. */
function escaped(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

/** Text as the page escapes it inside an element, where quotes stay as typed. */
function escapedText(text: string): string {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** The run ids a runs list shows, in order. */
function runIds(body: string): number[] {
	return [...body.matchAll(/data-run="(\d+)"/g)].map(([, id]) => Number(id));
}

let history = await readHistory();
let anchors = await readAnchors();

describe("Delta's Actions list", () => {
	test("lists every run, each titled by a real commit and linking to its run", async () => {
		let { body, status } = await page("delta/actions");

		expect(status).toBe(200);
		expect(runIds(body).length).toBeGreaterThan(8);
		for (let id of runIds(body))
			expect(body).toContain(`href="${href(`delta/actions/runs/${id}`)}"`);
		for (let commit of history.commits.slice(0, 3))
			expect(body).toContain(escapedText(commit.subject));
		expect(body).toContain("Auto-refresh");
	});

	test("names a real sha for every pushed run", async () => {
		let { body } = await page("delta/actions");
		let shas = [...body.matchAll(/Commit ([0-9a-f]{7}) pushed/g)].map(([, sha]) => sha!);

		expect(shas.length).toBeGreaterThan(0);
		for (let sha of shas) {
			expect(history.commits.some((commit) => commit.sha.startsWith(sha))).toBe(true);
		}
	});

	test("filters by status, workflow and actor from the address", async () => {
		let failed = runIds((await page("delta/actions?status=failure")).body);
		let deploys = (await page("delta/actions?workflow=deploy")).body;
		let byInes = runIds((await page("delta/actions?actor=ines")).body);

		expect(failed).toEqual([812, 804]);
		expect(deploys).toContain("Deploy #813");
		expect(deploys).not.toContain("CI #812");
		expect(byInes).toEqual([811, 810]);
	});

	test("keeps one run in progress", async () => {
		expect(runIds((await page("delta/actions?status=in_progress")).body)).toEqual([815]);
	});

	test("says nothing matches, offering to clear the filters", async () => {
		let { body } = await page("delta/actions?status=cancelled&workflow=deploy");

		expect(runIds(body)).toEqual([]);
		expect(body).toContain("No runs match");
		expect(body).toContain(`href="${href("delta/actions")}"`);
	});
});

describe("Delta's run summary", () => {
	test("links every job of the graph, with the matrix as one group", async () => {
		let { body, status } = await page("delta/actions/runs/812");

		expect(status).toBe(200);
		for (let job of [1, 2, 3, 4, 5, 6]) {
			expect(body).toContain(`href="${href(`delta/actions/runs/812/job/${job}`)}"`);
		}
		expect(body).toContain("Matrix: Test · 3 of 3 jobs completed");
		expect([...body.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
	});

	test("keeps the workflow's path on one line in the summary, named whole on hover", async () => {
		let { body } = await page("delta/actions/runs/804");

		expect(body).toMatch(/title="\.github\/workflows\/deploy\.yml"[^>]*><bdi>/);
	});

	test("cites the real lines its findings are about", async () => {
		let { body } = await page("delta/actions/runs/812");
		let failure = anchors["ci-phone-scroll"];

		expect(failure?.status).toBe("current");
		if (failure?.status !== "current") return;
		expect(body).toContain(
			escaped(href(`delta/blob/main/${failure.path}?L=${failure.start}#L${failure.start}`)),
		);
		expect(body).toContain("expected 391 to be less than or equal to 375");
	});

	test("answers the app's 404 for a run or job it doesn't hold", async () => {
		expect((await page("delta/actions/runs/999")).status).toBe(404);
		expect((await page("delta/actions/runs/812/job/99")).status).toBe(404);
		expect((await page("delta/actions/runs/abc")).status).toBe(404);
	});
});

describe("Delta's job log", () => {
	test("opens the failed step and quotes the real assertion it failed on", async () => {
		let { body } = await page("delta/actions/runs/812/job/3");
		let failed = /<details[^>]*data-state="failure"[^>]*>/.exec(body)?.[0] ?? "";

		expect(failed).toContain("open");
		expect(body).toContain("AssertionError");
		expect(body).toContain("toBeLessThanOrEqual(375)");
	});

	test("streams a running step, with a Refresh link for a page without script", async () => {
		let { body } = await page("delta/actions/runs/815/job/4");

		expect(body).toMatch(
			/data-log-stream="[^"]*\/streams\/runs\/815\/job\/4\?step=5&amp;after=\d+"/,
		);
		expect(body).toContain(`href="${href("delta/actions/runs/815/job/4")}"`);
	});

	test("draws timestamps when the address asks", async () => {
		let { body } = await page("delta/actions/runs/812/job/3?ts=1");

		expect(body).toContain("data-timestamps");
		expect(body).toContain('aria-pressed="true"');
	});
});

describe("Delta's log stream", () => {
	test("answers the running step's next lines as plain text, a line at a time", async () => {
		let response = await fetchApp("/demo/apps/delta/streams/runs/815/job/4?after=14");
		let reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
		let first = await reader.read();
		await reader.cancel();

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(first.value).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z .*\n$/);
	});

	test("answers 404 for a part that isn't live", async () => {
		let response = await fetchApp("/demo/apps/delta/streams/runs/812/job/3");

		expect(response.status).toBe(404);
	});
});
