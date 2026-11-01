/**
 * Tests for the `sdxc-user-agent` command line through `invoke()`: one string from the argument,
 * one per line of stdin in input order, the `--json` lines, and the usage error for a terminal
 * on stdin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { cli } from "./cli.js";
import { parse } from "./parse.js";

const CHROME_ON_WINDOWS =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const SAFARI_ON_IPHONE =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

describe("parse", () => {
	test("prints the parts of the string given as the argument", async () => {
		let { code, stdout, stderr } = await invoke(cli, ["parse", SAFARI_ON_IPHONE]);

		expect(stderr).toBe("");
		expect(code).toBe(0);
		expect(stdout).toBe("Safari 17.4\tWebKit 605.1.15\tiOS 17.4\tmobile Apple iPhone\n");
	});

	test("prints - for every part a string does not reveal", async () => {
		let { code, stdout } = await invoke(cli, ["parse", "curl/8.4.0"]);

		expect(code).toBe(0);
		expect(stdout).toBe("-\t-\t-\t-\n");
	});

	test("reads one string per stdin line, skipping blank lines, in input order", async () => {
		let { code, stdout } = await invoke(cli, ["parse"], {
			stdin: `${SAFARI_ON_IPHONE}\r\n\n${CHROME_ON_WINDOWS}\n`,
		});

		expect(code).toBe(0);
		expect(stdout.split("\n")).toEqual([
			"Safari 17.4\tWebKit 605.1.15\tiOS 17.4\tmobile Apple iPhone",
			"Chrome 122.0.0.0\tBlink 537.36\tWindows 10\tdesktop",
			"",
		]);
	});

	test("prints the parsed string as one JSON object", async () => {
		let { code, stdout } = await invoke(cli, ["parse", CHROME_ON_WINDOWS, "--json"]);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toEqual(parse(CHROME_ON_WINDOWS));
	});

	test("prints one JSON object per stdin line", async () => {
		let { code, stdout } = await invoke(cli, ["parse", "-", "--json"], {
			stdin: `${CHROME_ON_WINDOWS}\n${SAFARI_ON_IPHONE}\n`,
		});

		expect(code).toBe(0);
		expect(
			stdout
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line)),
		).toEqual([parse(CHROME_ON_WINDOWS), parse(SAFARI_ON_IPHONE)]);
	});

	test("prints nothing for empty stdin", async () => {
		let { code, stdout } = await invoke(cli, ["parse"], { stdin: "" });

		expect(code).toBe(0);
		expect(stdout).toBe("");
	});

	test("exits 2 when stdin is a terminal and no string is given", async () => {
		let { code, stdout, stderr } = await invoke(cli, ["parse"]);

		expect(code).toBe(2);
		expect(stdout).toBe("");
		expect(stderr).toContain("Pass a User-Agent string");
	});
});
