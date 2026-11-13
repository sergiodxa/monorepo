/**
 * Tests the readers behind Delta's extractor on what git prints: log records into commits with
 * no email kept, numstat renames, patches made relative and capped per file, porcelain blame
 * compacted to runs, content anchors resolved or outdated, and the size budget.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	LOG_FORMAT,
	capPatch,
	checkBudget,
	compactBlame,
	expandRename,
	parseLog,
	parseNumstat,
	readMessage,
	resolveAnchor,
} from "~/scripts/delta";

/** A folder standing in for Delta's own. */
const ROOT = "apps/site/delta/";

/** A sha made of one repeated hex digit, so tests never depend on real history. */
function sha(digit: string): string {
	return digit.repeat(40);
}

/** One `git log --format=LOG_FORMAT` record. */
function record(fields: { sha: string; parents?: string; subject: string; body?: string }): string {
	return `\x1e${fields.sha}\x1f${fields.parents ?? ""}\x1fAda Lovelace\x1f2026-11-12T10:00:00Z\x1f${fields.subject}\x1f${fields.body ?? ""}\n`;
}

describe("LOG_FORMAT", () => {
	test("asks git for names and never for an email", () => {
		expect(LOG_FORMAT).toContain("%an");
		expect(LOG_FORMAT).not.toMatch(/%a[eE]|%c[eE]/);
	});
});

describe("parseLog", () => {
	test("reads every record in order with its parents and message", () => {
		let commits = parseLog(
			record({ sha: sha("a"), parents: `${sha("b")}`, subject: "feat(x): Add a", body: "Why." }) +
				record({ sha: sha("b"), subject: "feat(x): Start" }),
		);

		expect(commits.map((commit) => commit.sha)).toEqual([sha("a"), sha("b")]);
		expect(commits[0]).toMatchObject({
			parents: [sha("b")],
			author: "Ada Lovelace",
			subject: "feat(x): Add a",
			body: "Why.",
		});
		expect(commits[1]!.parents).toEqual([]);
	});

	test("keeps a body that spans paragraphs whole", () => {
		let [commit] = parseLog(record({ sha: sha("c"), subject: "s", body: "One.\n\nTwo.\n" }));

		expect(commit!.body).toBe("One.\n\nTwo.");
	});
});

describe("readMessage", () => {
	test("turns Co-Authored-By trailers into names and drops their emails", () => {
		let message = readMessage(
			"Body.\n\nCo-Authored-By: Grace Hopper <grace@example.com>\nCo-authored-by: Alan Turing <alan@example.org>",
		);

		expect(message.coAuthors).toEqual(["Grace Hopper", "Alan Turing"]);
		expect(message.body).toBe("Body.");
	});

	test("removes every other trailer carrying an email, and keeps trailers without one", () => {
		let message = readMessage(
			"Body.\n\nSigned-off-by: Ada <ada@example.com>\nRelease-Note-For: abc123",
		);

		expect(message.body).toBe("Body.\n\nRelease-Note-For: abc123");
		expect(message.body).not.toContain("@");
		expect(message.coAuthors).toEqual([]);
	});

	test("names a co-author once when two trailers repeat them", () => {
		let message = readMessage(
			"Co-Authored-By: Ada <a@example.com>\nCo-Authored-By: Ada <a@example.com>",
		);

		expect(message.coAuthors).toEqual(["Ada"]);
	});
});

describe("expandRename", () => {
	test("expands a braced rename inside a folder", () => {
		expect(expandRename("delta/{old.ts => new.ts}")).toEqual(["delta/old.ts", "delta/new.ts"]);
	});

	test("expands a rename that adds a folder", () => {
		expect(expandRename("delta/{ => screens}/blob.tsx")).toEqual([
			"delta/blob.tsx",
			"delta/screens/blob.tsx",
		]);
	});

	test("expands a bare rename and leaves a plain path alone", () => {
		expect(expandRename("a.ts => b.ts")).toEqual(["a.ts", "b.ts"]);
		expect(expandRename("a.ts")).toEqual(["a.ts", "a.ts"]);
	});
});

describe("parseNumstat", () => {
	test("reads counts relative to the root, renames with their old path, binaries as null", () => {
		let files = parseNumstat(
			[
				`12\t3\t${ROOT}shell.tsx`,
				`0\t0\t${ROOT}{a.ts => b.ts}`,
				`-\t-\t${ROOT}logo.png`,
				`4\t1\tapps/site/other/file.ts`,
				"",
			].join("\n"),
			ROOT,
		);

		expect(files).toEqual([
			{ path: "shell.tsx", additions: 12, deletions: 3 },
			{ path: "b.ts", oldPath: "a.ts", additions: 0, deletions: 0 },
			{ path: "logo.png", additions: null, deletions: null },
		]);
	});
});

describe("capPatch", () => {
	/** One file's patch with `lines` added lines. */
	let filePatch = (path: string, lines: number) =>
		[
			`diff --git a/${ROOT}${path} b/${ROOT}${path}`,
			"index 1111111..2222222 100644",
			`--- a/${ROOT}${path}`,
			`+++ b/${ROOT}${path}`,
			`@@ -0,0 +1,${lines} @@`,
			...Array.from({ length: lines }, (_, line) => `+line ${line} mentions ${ROOT}inside`),
			"",
		].join("\n");

	test("makes header paths relative and leaves the code lines as written", () => {
		let patch = capPatch(filePatch("a.ts", 2), ROOT, 64 * 1024);

		expect(patch.dropped).toEqual([]);
		expect(patch.text).toContain("diff --git a/a.ts b/a.ts");
		expect(patch.text).toContain("+++ b/a.ts");
		expect(patch.text).toContain(`+line 0 mentions ${ROOT}inside`);
	});

	test("drops a file past the limit and keeps the others", () => {
		let patch = capPatch(filePatch("small.ts", 2) + filePatch("huge.ts", 400), ROOT, 2048);

		expect(patch.dropped).toEqual(["huge.ts"]);
		expect(patch.text).toContain("a/small.ts");
		expect(patch.text).not.toContain("huge.ts");
	});

	test("answers an empty patch for output with no file", () => {
		expect(capPatch("", ROOT, 1024)).toEqual({ text: "", dropped: [] });
	});
});

describe("compactBlame", () => {
	test("joins runs of lines one commit changed, and keeps names, dates and summaries", () => {
		let output = [
			`${sha("a")} 1 1 2`,
			"author Ada Lovelace",
			"author-mail <ada@example.com>",
			"author-time 1762941600",
			"summary feat(x): Add a",
			"filename delta/a.ts",
			"\tline one",
			`${sha("a")} 2 2`,
			"\tline two",
			`${sha("b")} 3 3 1`,
			"author Grace Hopper",
			"author-mail <grace@example.com>",
			"author-time 1762855200",
			"summary fix(x): Fix b",
			"filename delta/a.ts",
			"\tline three",
			`${sha("a")} 3 4 1`,
			"\tline four",
		].join("\n");

		let reading = compactBlame(output);

		expect(reading.ranges).toEqual([
			{ start: 1, end: 2, sha: sha("a") },
			{ start: 3, end: 3, sha: sha("b") },
			{ start: 4, end: 4, sha: sha("a") },
		]);
		expect(reading.commits.map((commit) => commit.subject)).toEqual([
			"feat(x): Add a",
			"fix(x): Fix b",
		]);
		expect(JSON.stringify(reading)).not.toContain("@");
		expect(reading.commits[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});
});

describe("resolveAnchor", () => {
	let text = "one\ntwo\nfunction ReviewPane() {\n\treturn null;\n}\n";

	test("finds the first line holding the match and spans from it", () => {
		expect(
			resolveAnchor({ id: "a", path: "x.ts", match: "function ReviewPane(", span: 3 }, text),
		).toEqual({ id: "a", path: "x.ts", status: "current", start: 3, end: 5 });
	});

	test("marks an anchor whose code is gone as outdated, with its excerpt from the older file", () => {
		let anchor = resolveAnchor(
			{ id: "a", path: "x.ts", match: "function OldPane(", span: 2 },
			text,
			{ sha: sha("c"), text: "function OldPane() {\n\treturn 1;\n}" },
		);

		expect(anchor).toEqual({
			id: "a",
			path: "x.ts",
			status: "outdated",
			sha: sha("c"),
			start: 1,
			excerpt: ["function OldPane() {", "\treturn 1;"],
		});
	});

	test("marks an anchor into a missing file as outdated", () => {
		expect(resolveAnchor({ id: "a", path: "gone.ts", match: "x" }, undefined).status).toBe(
			"outdated",
		);
	});
});

describe("checkBudget", () => {
	test("sums the documents' bytes and says whether they fit", () => {
		expect(checkBudget({ a: "12345", b: "é" }, 7)).toEqual({ bytes: 7, within: true });
		expect(checkBudget({ a: "12345678" }, 7).within).toBe(false);
	});
});
