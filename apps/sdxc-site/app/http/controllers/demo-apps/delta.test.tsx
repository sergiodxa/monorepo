/**
 * Tests Delta, the code-host demo, through the real router against whatever history the build
 * read: the home lists every top-level entry with its last commit, a file paints the lines its
 * `?L=` cites and blames every line, the finder ranks paths, and the commits list is real.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { hasHiddenLines } from "~/app/services/delta/hunks";
import { fileHunks, fileLinesAt, readHistory, readTree } from "~/app/services/delta/source";
import { fetchApp } from "~/app/test/router";
import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";
import { listFolder } from "~/resources/views/demo-apps/delta/data";

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

let tree = await readTree();
let history = await readHistory();

/** A commit and a modified file in it whose hunks leave lines of the file hidden. */
async function expandable(): Promise<{ sha: string; path: string } | undefined> {
	for (let commit of history.commits) {
		for (let file of commit.files) {
			if (file.oldPath !== undefined || !file.deletions || !file.additions) continue;
			if (file.additions + file.deletions > 400) continue;
			let lines = await fileLinesAt(commit.sha, file.path);
			let hunks = await fileHunks(commit.sha, file.path);
			if (lines !== undefined && hunks !== undefined && hasHiddenLines(hunks, lines)) {
				return { sha: commit.sha, path: file.path };
			}
		}
	}
	return undefined;
}

describe("Delta's repository home", () => {
	test("lists every top-level file and folder, each linked", async () => {
		let { body, status } = await page("delta");

		expect(status).toBe(200);
		for (let entry of listFolder(tree.files, "") ?? []) {
			let path =
				entry.kind === "folder" ? `delta/tree/main/${entry.path}` : `delta/blob/main/${entry.path}`;
			expect(body, entry.path).toContain(`href="${href(path)}"`);
		}
	});

	test("opens with the latest commit to touch Delta, and renders the README one level down", async () => {
		let { body } = await page("delta");
		let latest = history.commits[0];

		if (latest !== undefined) expect(body).toContain(escaped(latest.subject));
		expect(body).toContain("How a Worker shows git history");
		expect([...body.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
	});

	test("an unknown folder answers the app's 404", async () => {
		expect((await page("delta/tree/main/no-such-folder")).status).toBe(404);
	});
});

describe("Delta's file view", () => {
	test("numbers every line and marks the file the tree follows", async () => {
		let file = tree.files.find((candidate) => candidate.path === "shell.tsx")!;
		let { body } = await page("delta/blob/main/shell.tsx");

		expect(body).toContain('data-delta-path="shell.tsx"');
		expect(body).toContain('id="L1"');
		expect(body).toContain(`id="L${file.lines}"`);
		expect(body).not.toContain(`id="L${file.lines + 1}"`);
	});

	test("paints the lines `?L=` cites without script", async () => {
		let { body } = await page("delta/blob/main/shell.tsx?L=12-18");

		expect(body).toContain('data-selection="12-18"');
	});

	test("pins its permalink to the commit the build read", async () => {
		let { body } = await page("delta/blob/main/shell.tsx");

		expect(body).toContain(href(`delta/blob/${tree.head}/shell.tsx`));
	});

	test("serves the same file at the pinned sha, and says so for a commit it holds no files for", async () => {
		expect((await page(`delta/blob/${tree.head}/shell.tsx`)).status).toBe(200);
		let older = history.commits.find((commit) => commit.sha !== tree.head);
		if (older === undefined) return;

		let { body, status } = await page(`delta/blob/${older.sha.slice(0, 7)}/shell.tsx`);
		expect(status).toBe(200);
		expect(body).toMatch(/aren(&#39;|&#x27;|')t in the build/);
	});

	test("blames every line with a commit the history knows", async () => {
		let { body } = await page("delta/blame/main/shell.tsx");
		let subjects = history.commits.map((commit) => escaped(commit.subject));

		expect(subjects.some((subject) => body.includes(subject))).toBe(true);
	});

	test("an unknown file or ref answers the app's 404", async () => {
		expect((await page("delta/blob/main/no-such-file.ts")).status).toBe(404);
		expect((await page("delta/blob/not-a-ref/shell.tsx")).status).toBe(404);
	});
});

describe("Delta's Go to file", () => {
	test("lists every file before anything is typed", async () => {
		let { body } = await page("delta/find/main");

		for (let file of tree.files) expect(body).toContain(href(`delta/blob/main/${file.path}`));
	});

	test("ranks paths against the query and marks the matched characters", async () => {
		let { body } = await page("delta/find/main?q=shl");
		let results =
			/<section aria-labelledby="delta-find-results"[\s\S]*?<\/section>/.exec(body)?.[0] ?? "";

		expect(results).toContain(href("delta/blob/main/shell.tsx"));
		expect(results).not.toContain(href("delta/blob/main/README.md"));
		expect(results).toContain("<mark");
	});

	test("says nothing matches, quoting the query", async () => {
		let { body } = await page("delta/find/main?q=zzzzqqq");

		expect(body).toContain("No file matches");
		expect(body).toContain("zzzzqqq");
	});
});

describe("Delta's commits", () => {
	test("lists every commit in the history, newest day first, each linking to its page", async () => {
		let { body } = await page("delta/commits/main");
		let days = [...body.matchAll(/data-day="(\d{4}-\d{2}-\d{2})"/g)].map(([, day]) => day!);

		expect(days).toEqual([...days].sort().reverse());
		for (let commit of history.commits) {
			expect(body).toContain(`href="${href(`delta/commit/${commit.sha}`)}"`);
		}
	});

	test("names authors and never an email", async () => {
		let { body } = await page("delta/commits/main");

		expect(body).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
	});

	test("a commit's page shows its subject and a diff card for every file it changed", async () => {
		let commit = history.commits[0];
		if (commit === undefined) return;
		let { body, status } = await page(`delta/commit/${commit.sha.slice(0, 10)}`);

		expect(status).toBe(200);
		expect(body).toContain(escaped(commit.subject));
		for (let file of commit.files) {
			expect(body).toContain(`data-slot="diff-file" data-path="${escaped(file.path)}"`);
		}
	});

	test("keeps the split view in the address", async () => {
		let commit = history.commits[0];
		if (commit === undefined) return;
		let { body } = await page(`delta/commit/${commit.sha}?diff=split`);

		expect(body).toContain('data-view="split"');
		expect(body).toContain('aria-current="page"');
	});

	test("widens a file's context from its own lines, linking each press back to the page", async () => {
		let found = await expandable();
		if (found === undefined) return;
		let before = await page(`delta/commit/${found.sha}`);
		let after = await page(
			`delta/commit/${found.sha}?expand=${encodeURIComponent(`${found.path}:20`)}`,
		);

		let headers = (body: string) => [...body.matchAll(/@@ -\d+,?\d* \+\d+,?\d* @@/g)].length;
		expect(headers(after.body)).toBeLessThanOrEqual(headers(before.body));
		expect(after.body).not.toBe(before.body);
		expect(before.body).toContain(`expand=${encodeURIComponent(found.path)}%3A20`);
	});

	test("draws a large file closed behind Load diff, and its frame answers the lines", async () => {
		let commit = history.commits.find((candidate) =>
			candidate.files.some((file) => (file.additions ?? 0) + (file.deletions ?? 0) > 400),
		);
		if (commit === undefined) return;
		let { body } = await page(`delta/commit/${commit.sha}`);
		expect(body).toContain("data-large");
		expect(body).toContain("Load diff");
		let frame = /"(\/demo\/apps\/delta\/frames\/diff\/commit\/[^"]+)"/.exec(body)?.[1];
		expect(frame).toBeDefined();
		let response = await fetchApp(frame!.replaceAll("&amp;", "&"));
		expect(response.status).toBe(200);
		expect(await response.text()).toContain('data-slot="diff-hunks"');
	});

	test("an unknown commit answers the app's 404", async () => {
		expect((await page("delta/commit/0000000000")).status).toBe(404);
	});
});

describe("Delta's forms", () => {
	test("Reset the demo redirects home with its toast", async () => {
		let response = await fetchApp(demoAppActionHref("delta")("reset"), {
			method: "POST",
			body: new URLSearchParams(),
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toMatch(/toast=reset/);
	});
});
