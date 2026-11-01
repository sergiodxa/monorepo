/**
 * Tests for the `sdxc-jscontact` command line through `invoke()`: conversion between every
 * pair of formats from a file and from stdin, format detection, and validation's report and
 * exit codes, including unreadable input and usage errors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { isFailure } from "@sdxc/result";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { JCard, VCard } from "./vcard.js";

import { cli } from "./cli.js";
import { AUTHOR_JCARD, AUTHOR_VCARD } from "./fixtures/rfc7095.js";
import { BASIC_CARD } from "./fixtures/rfc9553.js";
import { fromVCard, parseVCard } from "./vcard.js";

import type { Issue } from "./index.js";

/** A Card with an email address that is not a string, invalid in two places. */
const INVALID_CARD = {
	"@type": "Card",
	version: "2.0",
	emails: { e1: { address: 42 } },
	kind: 7,
};

let directory = "";

beforeAll(async () => {
	directory = await mkdtemp(join(tmpdir(), "sdxc-jscontact-"));
	await writeFile(join(directory, "author.vcf"), AUTHOR_VCARD);
	await writeFile(join(directory, "card.json"), JSON.stringify(BASIC_CARD));
});

afterAll(async () => {
	await rm(directory, { recursive: true, force: true });
});

/** Runs `sdxc-jscontact` in the fixture directory, with `stdin` piped when given. */
function run(argv: string[], stdin?: string) {
	return invoke(cli, argv, { cwd: directory, ...(stdin === undefined ? {} : { stdin }) });
}

/** The author's vCard text as the library converts it. */
function authorCard() {
	let cards = parseVCard(AUTHOR_VCARD);
	if (isFailure(cards)) throw cards.error;
	return fromVCard(cards.data[0] as VCard);
}

describe("convert", () => {
	test("reads a vCard file, detected, and writes its Card", async () => {
		let { code, stdout, stderr } = await run(["convert", "author.vcf", "--to", "jscontact"]);

		expect(stderr).toBe("");
		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toEqual(authorCard());
	});

	test("reads a jCard on stdin and writes vCard text", async () => {
		let { code, stdout } = await run(["convert", "--to", "vcard"], JSON.stringify(AUTHOR_JCARD));

		expect(code).toBe(0);
		expect(stdout).toMatch(/^BEGIN:VCARD\r\nVERSION:4\.0\r\n/);
		expect(stdout).toContain("FN:Simon Perreault\r\n");
	});

	test("writes a Card as jCard", async () => {
		let { code, stdout } = await run(["convert", "card.json", "--to", "jcard"]);

		expect(code).toBe(0);
		let jcard = JSON.parse(stdout) as JCard;
		expect(jcard[0]).toBe("vcard");
		expect(jcard[1][0]).toEqual(["version", {}, "text", "4.0"]);
	});

	test("keeps a list a list: several vCards become an array of Cards", async () => {
		let text = `${AUTHOR_VCARD}${AUTHOR_VCARD}`;
		let { code, stdout } = await run(["convert", "-", "--to", "jscontact"], text);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toHaveLength(2);
	});

	test("reads the format --from names", async () => {
		let { code, stdout } = await run(
			["convert", "--from", "jcard", "--to", "jcard"],
			JSON.stringify([AUTHOR_JCARD]),
		);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toHaveLength(1);
	});

	test("exits 2 when the format cannot be detected", async () => {
		let { code, stdout, stderr } = await run(["convert", "--to", "vcard"], "Joe User");

		expect(code).toBe(2);
		expect(stdout).toBe("");
		expect(stderr).toMatch(/^Cannot tell the input's format; name it with --from/);
	});

	test("exits 2 on an invalid Card, naming its first problem", async () => {
		let { code, stderr } = await run(["convert", "--to", "vcard"], JSON.stringify(INVALID_CARD));

		expect(code).toBe(2);
		expect(stderr).toMatch(/^Card: Invalid JSContact Card at /);
		expect(stderr).toContain("Run validate to list every problem.");
	});

	test("exits 2 on vCard text that does not parse, naming the line", async () => {
		let { code, stderr } = await run(
			["convert", "--from", "vcard", "--to", "jscontact"],
			"BEGIN:VCARD\r\nnot a property\r\nEND:VCARD\r\n",
		);

		expect(code).toBe(2);
		expect(stderr).toMatch(/^Invalid vCard at line 2: /);
	});

	test("exits 2 on a missing file", async () => {
		let { code, stderr } = await run(["convert", "missing.vcf", "--to", "jscontact"]);

		expect(code).toBe(2);
		expect(stderr).toMatch(/^Cannot read missing\.vcf: /);
	});

	test("exits 2 on a format it does not know", async () => {
		let { code, stderr } = await run(["convert", "card.json", "--to", "csv"]);

		expect(code).toBe(2);
		expect(stderr).toContain("--to");
	});

	test("exits 2 when stdin is a terminal and no file is given", async () => {
		let { code, stderr } = await run(["convert", "--to", "vcard"]);

		expect(code).toBe(2);
		expect(stderr).toMatch(/^Pass a file, or pipe one on stdin/);
	});
});

describe("validate", () => {
	test("prints valid and exits 0 for a valid Card", async () => {
		let { code, stdout, stderr } = await run(["validate", "card.json"]);

		expect(code).toBe(0);
		expect(stdout).toBe("valid\n");
		expect(stderr).toBe("");
	});

	test("lists every problem and exits 1 for an invalid Card", async () => {
		let { code, stdout } = await run(["validate"], JSON.stringify(INVALID_CARD));

		expect(code).toBe(1);
		let lines = stdout.trimEnd().split("\n");
		expect(lines.length).toBeGreaterThanOrEqual(2);
		expect(lines.some((line) => line.startsWith("emails.e1.address: "))).toBe(true);
		expect(lines.some((line) => line.startsWith("kind: "))).toBe(true);
	});

	test("prefixes each problem of an array with its Card's index", async () => {
		let { code, stdout } = await run(
			["validate", "--json"],
			JSON.stringify([BASIC_CARD, INVALID_CARD]),
		);

		expect(code).toBe(1);
		let report = JSON.parse(stdout) as { valid: boolean; issues: Issue[] };
		expect(report.valid).toBe(false);
		expect(report.issues).toContainEqual({
			path: [1, "emails", "e1", "address"],
			message: expect.any(String),
		});
		expect(report.issues.every((issue) => issue.path[0] === 1)).toBe(true);
	});

	test("reports a valid Card as JSON", async () => {
		let { code, stdout } = await run(["validate", "card.json", "--json"]);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toEqual({ valid: true, issues: [] });
	});

	test("exits 2 when the input is not JSON", async () => {
		let { code, stdout, stderr } = await run(["validate", "author.vcf"]);

		expect(code).toBe(2);
		expect(stdout).toBe("");
		expect(stderr).toMatch(/^The input is not JSON: /);
	});
});
