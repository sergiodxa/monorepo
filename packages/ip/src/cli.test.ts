/**
 * Tests for the `sdxc-ip` command line, driven through `invoke()`: the human and `--json`
 * reports, stdin input, and the exit codes for inside, outside and text that is not an address
 * or a range.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { cli } from "./cli.js";

describe("sdxc-ip classify", () => {
	test("prints a private IPv4 address and exits 0", async () => {
		let run = await invoke(cli, ["classify", "192.168.1.10"]);
		expect(run.code).toBe(0);
		expect(run.stderr).toBe("");
		expect(run.stdout).toBe(
			[
				"address         192.168.1.10",
				"version         4",
				"classification  private",
				"public          no",
				"",
			].join("\n"),
		);
	});

	test("prints an IPv6 address in canonical form", async () => {
		let run = await invoke(cli, ["classify", "2001:DB8::0:1"]);
		expect(run.code).toBe(0);
		expect(run.stdout).toContain("address         2001:db8::1\n");
		expect(run.stdout).toContain("classification  documentation\n");
	});

	test("names the IPv4 an IPv4-mapped address carries and judges it by that", async () => {
		let run = await invoke(cli, ["classify", "::ffff:10.0.0.1", "--json"]);
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			address: "::ffff:10.0.0.1",
			version: 6,
			classification: "private",
			public: false,
			embeddedIPv4: "10.0.0.1",
		});
	});

	test("reports a public address as public in JSON", async () => {
		let run = await invoke(cli, ["classify", "8.8.8.8", "--json"]);
		expect(JSON.parse(run.stdout)).toEqual({
			address: "8.8.8.8",
			version: 4,
			classification: "public",
			public: true,
			embeddedIPv4: null,
		});
	});

	test("reads the address from stdin", async () => {
		let run = await invoke(cli, ["classify"], { stdin: "127.0.0.1\n" });
		expect(run.code).toBe(0);
		expect(run.stdout).toContain("classification  loopback\n");
	});

	test("exits 2 for text that is not an address", async () => {
		let run = await invoke(cli, ["classify", "example.com"]);
		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain('Not an IP address: "example.com"');
	});
});

describe("sdxc-ip contains", () => {
	test("exits 0 when the range holds the address", async () => {
		let run = await invoke(cli, ["contains", "10.0.0.0/8", "10.1.2.3"]);
		expect(run.code).toBe(0);
		expect(run.stdout).toBe("10.1.2.3 is inside 10.0.0.0/8\n");
	});

	test("exits 1 when the address is outside", async () => {
		let run = await invoke(cli, ["contains", "10.0.0.0/8", "192.168.0.1"]);
		expect(run.code).toBe(1);
		expect(run.stdout).toBe("192.168.0.1 is outside 10.0.0.0/8\n");
	});

	test("treats an address of the other version as outside", async () => {
		let run = await invoke(cli, ["contains", "10.0.0.0/8", "::ffff:10.0.0.1"]);
		expect(run.code).toBe(1);
	});

	test("prints canonical text as JSON", async () => {
		let run = await invoke(cli, ["contains", "2001:DB8::/32", "2001:db8:0::1", "--json"]);
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			range: "2001:db8::/32",
			address: "2001:db8::1",
			contains: true,
		});
	});

	test("reads the address from stdin", async () => {
		let run = await invoke(cli, ["contains", "203.0.113.0/24", "-"], { stdin: "203.0.113.7\n" });
		expect(run.code).toBe(0);
	});

	test("exits 2 for a range with host bits set", async () => {
		let run = await invoke(cli, ["contains", "10.0.0.1/8", "10.0.0.2"]);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("has bits set past its prefix");
	});

	test("exits 2 for text that is not a range", async () => {
		let run = await invoke(cli, ["contains", "10.0.0.0", "10.0.0.2"]);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain('Not an IP range: "10.0.0.0"');
	});

	test("exits 2 for text that is not an address", async () => {
		let run = await invoke(cli, ["contains", "10.0.0.0/8", "nope"]);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain('Not an IP address: "nope"');
	});
});
