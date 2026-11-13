/**
 * Checks how a CI log is shaped before drawing: workflow markers read and removed, `##[group]`
 * folds nested with their line counts and errors, timestamps split and shown, and the tree
 * cut into chunks that never split a fold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	ansiAttributes,
	buildLogTree,
	chunkLogNodes,
	formatLogTime,
	readMarker,
	splitTimestamp,
} from "./log-lines.js";

/** The plain text of a node's spans. */
function textOf(node: { entry: { spans: { text: string }[] } }): string {
	return node.entry.spans.map((span) => span.text).join("");
}

describe("readMarker", () => {
	test("reads and removes a leading workflow marker", () => {
		expect(readMarker("##[error]Process completed with exit code 1.")).toEqual({
			marker: "danger",
			text: "Process completed with exit code 1.",
		});
		expect(readMarker("##[group]Run bun test").marker).toBe("group");
		expect(readMarker("##[endgroup]").marker).toBe("endgroup");
		expect(readMarker("##[warning]Deprecated").marker).toBe("warning");
	});

	test("keeps colour escapes in front of a marker and leaves unknown markers as text", () => {
		expect(readMarker("\u001b[36m##[command]bun install")).toEqual({
			marker: "command",
			text: "\u001b[36mbun install",
		});
		expect(readMarker("##[custom]text")).toEqual({ marker: undefined, text: "##[custom]text" });
		expect(readMarker("plain ##[error] later")).toEqual({
			marker: undefined,
			text: "plain ##[error] later",
		});
	});
});

describe("timestamps", () => {
	test("splits a runner's ISO prefix from the text", () => {
		expect(splitTimestamp("2026-11-13T09:00:01.1234567Z Run tests")).toEqual({
			ts: "2026-11-13T09:00:01.1234567Z",
			text: "Run tests",
		});
		expect(splitTimestamp("no time here")).toEqual({ text: "no time here" });
	});

	test("shows an ISO timestamp as its UTC time and anything else as given", () => {
		expect(formatLogTime("2026-11-13T09:00:01.123Z")).toBe("09:00:01");
		expect(formatLogTime("9:00 AM")).toBe("9:00 AM");
	});
});

describe("buildLogTree", () => {
	test("nests folds, drops their end lines, and counts their lines", () => {
		let tree = buildLogTree([
			{ n: 1, text: "Starting" },
			{ n: 2, text: "##[group]Install" },
			{ n: 3, text: "resolving" },
			{ n: 4, text: "##[group]Nested" },
			{ n: 5, text: "inner" },
			{ n: 6, text: "##[endgroup]" },
			{ n: 7, text: "done" },
			{ n: 8, text: "##[endgroup]" },
			{ n: 9, text: "After" },
		]);

		expect(tree.map((node) => [node.kind, node.entry.n])).toEqual([
			["line", 1],
			["group", 2],
			["line", 9],
		]);
		let install = tree[1]!;
		if (install.kind !== "group") throw new Error("expected a fold");
		expect(textOf(install)).toBe("Install");
		expect(install.lines).toBe(5);
		expect(install.children.map((node) => [node.kind, node.entry.n])).toEqual([
			["line", 3],
			["group", 4],
			["line", 7],
		]);
	});

	test("reads folds from the group field, closes a fold left open, and marks folds holding errors", () => {
		let tree = buildLogTree([
			{ n: 1, text: "Tests", group: "start" },
			{ n: 2, text: "##[error]1 failed" },
			{ n: 3, text: "", group: "end" },
			{ n: 4, text: "##[group]Unclosed" },
			{ n: 5, text: "tail" },
		]);

		let [tests, unclosed] = tree;
		expect(tests?.kind === "group" && tests.hasError).toBe(true);
		expect(tests?.kind === "group" && tests.children[0]!.entry.tone).toBe("danger");
		expect(unclosed?.kind === "group" && unclosed.hasError).toBe(false);
		expect(unclosed?.kind === "group" && unclosed.children.length).toBe(1);
	});

	test("carries an ANSI style from one line to the next", () => {
		let tree = buildLogTree([
			{ n: 1, text: "\u001b[31mred" },
			{ n: 2, text: "still red\u001b[0m" },
		]);
		expect(tree[1]!.entry.spans).toEqual([{ text: "still red", fg: "red" }]);
	});
});

describe("chunkLogNodes", () => {
	test("cuts siblings into runs of about the given size without splitting a fold", () => {
		let lines = Array.from({ length: 10 }, (_, index) => ({ n: index + 1, text: `line ${index}` }));
		let tree = buildLogTree([
			...lines.slice(0, 3),
			{ n: 11, text: "##[group]Fold" },
			...lines.slice(3, 8).map((line) => ({ ...line, n: line.n + 20 })),
			{ n: 30, text: "##[endgroup]" },
			...lines.slice(8),
		]);

		let chunks = chunkLogNodes(tree, 4);
		expect(chunks.map((chunk) => chunk.map((node) => node.entry.n))).toEqual([
			[1, 2, 3, 11],
			[9, 10],
		]);
	});
});

describe("ansiAttributes", () => {
	test("names each set style once", () => {
		expect(ansiAttributes({ fg: "red", bg: "black", bold: true, underline: true })).toEqual({
			"data-fg": "red",
			"data-bg": "black",
			"data-b": "",
			"data-u": "",
		});
		expect(ansiAttributes({})).toEqual({});
	});
});
