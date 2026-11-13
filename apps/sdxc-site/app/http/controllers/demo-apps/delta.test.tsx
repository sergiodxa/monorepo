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

/** Posts a form to one of Delta's pages, as a browser without script would. */
async function post(
	path: string,
	fields: Record<string, string | string[]>,
	cookie?: string,
): Promise<Response> {
	let body = new URLSearchParams();
	for (let [name, value] of Object.entries(fields)) {
		for (let entry of [value].flat()) body.append(name, entry);
	}
	let [page = "", query] = path.split("?");
	let action = demoAppActionHref("delta")(page);
	return fetchApp(query === undefined ? action : `${action}?${query}`, {
		method: "POST",
		body,
		headers: cookie === undefined ? {} : { Cookie: cookie },
	});
}

/** The `name=value` pairs a response sets, as the next request's `Cookie` header. */
function cookiesOf(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((header) => header.split(";")[0])
		.join("; ");
}

/** Fetches one of Delta's screens as a visitor carrying cookies. */
async function pageWith(path: string, cookie: string): Promise<string> {
	return (await fetchApp(href(path), { headers: { Cookie: cookie } })).text();
}

describe("Delta's issues list", () => {
	/** The issue numbers a list page shows, in order. */
	function numbers(body: string): number[] {
		return [...body.matchAll(/data-issue="(\d+)"/g)].map(([, number]) => Number(number));
	}

	test("shows open issues by default, writing the query into its field", async () => {
		let { body, status } = await page("delta/issues");

		expect(status).toBe(200);
		expect(body).toContain('value="is:open"');
		expect(numbers(body)).toContain(54);
		expect(numbers(body)).not.toContain(39);
	});

	test("reads GitHub's grammar: state, labels, authors and free words", async () => {
		expect(numbers((await page("delta/issues?q=is%3Aclosed")).body)).toEqual([39, 37, 34, 31]);
		let bugs = numbers((await page("delta/issues?q=is%3Aopen+label%3Abug")).body);
		expect(bugs.length).toBeGreaterThan(0);
		expect(bugs).not.toContain(52);
		expect(numbers((await page("delta/issues?q=is%3Aopen+author%3Akenji")).body)).toEqual([54, 49]);
		expect(numbers((await page("delta/issues?q=avatar")).body)).toEqual([53, 51]);
	});

	test("narrows by a facet in the address, and counts each tab", async () => {
		let { body } = await page("delta/issues?q=is%3Aopen&label=diff");

		expect(numbers(body)).toEqual([49, 48]);
		expect(body).toMatch(/Closed[\s\S]{0,400}?>0</);
	});

	test("says nothing matches, offering to clear the filters", async () => {
		let { body } = await page("delta/issues?q=zzzz");

		expect(body).toContain("No issues match");
		expect(body).toContain("Clear filters");
	});

	test("the bulk bar closes every checked issue and comes back with one toast", async () => {
		let response = await post("delta/issues?q=is%3Aopen", {
			bulk: "1",
			intent: "close",
			ids: ["54", "53"],
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toMatch(/issues\?q=is%3Aopen&toast=issues-close\./);
		let body = await pageWith("delta/issues", cookiesOf(response));
		expect(numbers(body)).not.toContain(54);
		expect(numbers(body)).not.toContain(53);
	});
});

describe("Delta's issue", () => {
	test("opens with its body, its timeline and a citation of real lines", async () => {
		let { body, status } = await page("delta/issues/42");

		expect(status).toBe(200);
		expect(body).toContain('data-slot="delta-citation"');
		expect(body).toContain('data-anchor="readme-how"');
		expect(body).toMatch(/href="[^"]*README\.md\?L=\d+#L\d+"/);
	});

	test("a comment lands on the page, as the visitor's own, through a cookie", async () => {
		let response = await post("delta/issues/42", { intent: "comment", body: "Ship it." });

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toMatch(/issues\/42#comment-v-/);
		let body = await pageWith("delta/issues/42", cookiesOf(response));
		expect(body).toContain("Ship it.");
	});

	test("a picker replaces its field whole and the timeline says what changed", async () => {
		let response = await post("delta/issues/42?set=labels", { label: ["bug", "a11y"] });
		let body = await pageWith("delta/issues/42", cookiesOf(response));

		expect(body).toContain("added the");
		expect(body).toContain("removed the");
		expect(body).toMatch(/>accessibility</);
	});

	test("Close changes the state, and Reset forgets everything the visitor did", async () => {
		let closed = await post("delta/issues/53", { intent: "close", body: "" });
		let cookie = cookiesOf(closed);

		expect(await pageWith("delta/issues/53", cookie)).toContain("closed this as completed");
		let reset = await post("reset", {}, cookie);
		expect(reset.headers.getSetCookie().every((header) => /Max-Age=0/.test(header))).toBe(true);
		expect(reset.headers.getSetCookie().length).toBeGreaterThan(0);
	});

	test("a number no issue has answers the app's 404", async () => {
		expect((await page("delta/issues/9999")).status).toBe(404);
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
