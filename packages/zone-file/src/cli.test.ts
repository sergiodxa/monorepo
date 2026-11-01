/**
 * Tests for the `sdxc-zone-file` command line: what `validate`, `parse` and `format` print on
 * each stream and the exit code they answer for a clean zone, a zone with bad lines, an
 * `$INCLUDE`, piped stdin, JSON records and a missing file, driven through `invoke()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { Rejection, Zone } from "./types.js";

import { cli } from "./cli.js";

const VALID = `$ORIGIN example.com.
$TTL 3600
@    IN MX 10 Mail
www  300 IN A 192.0.2.1
`;

const BROKEN = `$ORIGIN example.com.
bad  IN A 999.1.1.1
ok   IN A 192.0.2.1
txt  IN TXT ( "a"
  "b
`;

/** The directory each test runs in, holding `valid.zone`, `broken.zone` and an include. */
const FIXTURE = { dir: "" };

beforeEach(async () => {
	FIXTURE.dir = await mkdtemp(join(tmpdir(), "sdxc-zone-file-"));
	await writeFile(join(FIXTURE.dir, "valid.zone"), VALID, "utf8");
	await writeFile(join(FIXTURE.dir, "broken.zone"), BROKEN, "utf8");
	await writeFile(join(FIXTURE.dir, "hosts.zone"), "api IN A 192.0.2.9\n", "utf8");
	await writeFile(
		join(FIXTURE.dir, "main.zone"),
		"$ORIGIN example.com.\n$INCLUDE hosts.zone\n$INCLUDE missing.zone\n",
		"utf8",
	);
});

afterEach(async () => {
	await rm(FIXTURE.dir, { recursive: true, force: true });
});

/** Runs `sdxc-zone-file` in the fixture directory with no terminal attached. */
function run(argv: string[], stdin?: string) {
	return invoke(cli, argv, { cwd: FIXTURE.dir, stdin, interactive: false });
}

describe("sdxc-zone-file validate", () => {
	test("reports a clean zone on stdout and exits 0", async () => {
		let { code, stdout, stderr } = await run(["validate", "valid.zone"]);

		expect(code).toBe(0);
		expect(stdout).toBe("valid.zone: 2 records, no problems\n");
		expect(stderr).toBe("");
	});

	test("names every problem with its lines and exits 1", async () => {
		let { code, stdout, stderr } = await run(["validate", "broken.zone"]);

		expect(code).toBe(1);
		expect(stdout).toBe("");
		expect(stderr).toContain('broken.zone:2: Invalid A record data: "999.1.1.1" (invalid-data)');
		expect(stderr).toContain("broken.zone:4-6: A quoted string cannot span lines (malformed)");
		expect(stderr).toContain("2 problems in broken.zone");
	});

	test("prints the report as JSON with --json", async () => {
		let { code, stdout } = await run(["validate", "broken.zone", "--json"]);
		let report = JSON.parse(stdout) as { valid: boolean; records: number; rejected: Rejection[] };

		expect(code).toBe(1);
		expect(report.valid).toBe(false);
		expect(report.records).toBe(1);
		expect(report.rejected.map((entry) => entry.line)).toEqual([2, 4]);
	});

	test("reads $INCLUDE files beside the zone and names the one it cannot read", async () => {
		let { code, stderr } = await run(["validate", "main.zone"]);

		expect(code).toBe(1);
		expect(stderr).toMatch(/main\.zone:3: .+ \(include\)/);
	});

	test("reads stdin when the zone is absent or -", async () => {
		let absent = await run(["validate", "--origin", "example.com"], "www IN A 192.0.2.1\n");
		let dash = await run(["validate", "-"], "www IN A 192.0.2.1\n");

		expect(absent.code).toBe(0);
		expect(absent.stdout).toBe("<stdin>: 1 record, no problems\n");
		expect(dash.code).toBe(0);
	});

	test("exits 2 for a file it cannot read", async () => {
		let { code, stderr } = await run(["validate", "nope.zone"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Cannot read nope.zone");
	});

	test("exits 2 for a --ttl that is not seconds", async () => {
		let { code } = await run(["validate", "valid.zone", "--ttl", "1h"]);

		expect(code).toBe(2);
	});
});

describe("sdxc-zone-file parse", () => {
	test("prints one tab-separated line per record", async () => {
		let { code, stdout } = await run(["parse", "valid.zone"]);

		expect(code).toBe(0);
		expect(stdout).toBe(
			"example.com\t3600\tIN\tMX\t10 mail.example.com.\n" +
				"www.example.com\t300\tIN\tA\t192.0.2.1\n",
		);
	});

	test("applies --origin and --ttl to a zone that states neither", async () => {
		let { stdout } = await run(
			["parse", "--origin", "example.org", "--ttl", "60"],
			"www IN CNAME @\n",
		);

		expect(stdout).toBe("www.example.org\t60\tIN\tCNAME\texample.org.\n");
	});

	test("prints the zone as JSON with --json", async () => {
		let { code, stdout } = await run(["parse", "valid.zone", "--json"]);
		let zone = JSON.parse(stdout) as Zone;

		expect(code).toBe(0);
		expect(zone.origin).toBe("example.com");
		expect(zone.records[1]).toMatchObject({ name: "www.example.com", type: "A", line: 4 });
		expect(zone.rejected).toEqual([]);
	});

	test("prints the records it read and exits 1 for the entries it could not", async () => {
		let { code, stdout, stderr } = await run(["parse", "broken.zone"]);

		expect(code).toBe(1);
		expect(stdout).toBe("ok.example.com\t-\tIN\tA\t192.0.2.1\n");
		expect(stderr).toContain("broken.zone:2:");
	});
});

describe("sdxc-zone-file format", () => {
	test("writes a zone file normalized and relative to its origin", async () => {
		let { code, stdout } = await run(["format", "valid.zone", "--relative", "--ttl", "3600"]);

		expect(code).toBe(0);
		expect(stdout).toBe(
			"$ORIGIN example.com.\n$TTL 3600\n@\tIN\tMX\t10 mail\nwww\t300\tIN\tA\t192.0.2.1\n",
		);
	});

	test("writes JSON records, a bare array or a zone object", async () => {
		let records = [{ name: "example.com", ttl: 300, type: "A", address: "192.0.2.1" }];
		let array = await run(["format"], JSON.stringify(records));
		let object = await run(
			["format", "--relative"],
			JSON.stringify({ origin: "example.com", ttl: 300, records }),
		);

		expect(array.code).toBe(0);
		expect(array.stdout).toBe("example.com.\t300\tIN\tA\t192.0.2.1\n");
		expect(object.stdout).toBe("$ORIGIN example.com.\n$TTL 300\n@\tIN\tA\t192.0.2.1\n");
	});

	test("reads back what parse --json printed", async () => {
		let parsed = await run(["parse", "valid.zone", "--json"]);
		let { code, stdout } = await run(["format", "--relative"], parsed.stdout);

		expect(code).toBe(0);
		expect(stdout).toBe(
			"$ORIGIN example.com.\n@\t3600\tIN\tMX\t10 mail\nwww\t300\tIN\tA\t192.0.2.1\n",
		);
	});

	test("refuses records whose fields do not fit their type", async () => {
		let records = [
			{ name: "a.example.com", type: "A", address: "999.1.1.1" },
			{ name: "t.example.com", type: "TXT", text: "hi" },
		];
		let { code, stdout, stderr } = await run(["format"], JSON.stringify(records));

		expect(code).toBe(1);
		expect(stdout).toBe("");
		expect(stderr).toContain("records[0] (A): Invalid A record data");
		expect(stderr).toContain("records[1] (TXT): missing fields for its type");
	});

	test("exits 2 for JSON that is not records", async () => {
		let { code, stderr } = await run(["format"], '{ "records": [{ "type": "A" }] }');

		expect(code).toBe(2);
		expect(stderr).toContain("is not a list of records");
	});

	test("writes nothing for a zone file with entries it could not read", async () => {
		let { code, stdout, stderr } = await run(["format", "broken.zone"]);

		expect(code).toBe(1);
		expect(stdout).toBe("");
		expect(stderr).toContain("broken.zone:2:");
	});
});
