/**
 * Drives `sdxc-typeid` through `invoke()`: the ids `new` mints, what `parse` reports for valid
 * and invalid TypeIDs in both output forms, and `encode` round-tripping a stored UUID, with
 * the exit code each outcome maps to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { cli } from "./cli.js";

import { TypeID } from "./index.js";

/** A UUIDv7 and the `user` TypeID that encodes it. */
const UUID = "01890a5d-ac96-774b-bcce-b302099a8057";
const TYPEID = "user_01h455vb4pex5vsknk084sn02q";

describe("new", () => {
	test("prints one UUIDv7-backed id under the prefix", async () => {
		let run = await invoke(cli, ["new", "user"]);

		expect(run.code).toBe(0);
		let id = run.stdout.trim();
		expect(TypeID.isValid(id, "user")).toBe(true);
		expect(TypeID.fromString(id).toDate()).toBeInstanceOf(Date);
	});

	test("prints -n ids in the order they sort", async () => {
		let run = await invoke(cli, ["new", "session", "-n", "5"]);

		expect(run.code).toBe(0);
		let ids = run.stdout.trimEnd().split("\n");
		expect(ids).toHaveLength(5);
		expect(new Set(ids).size).toBe(5);
		expect(ids.every((id) => TypeID.isValid(id, "session"))).toBe(true);
		expect([...ids].sort()).toEqual(ids);
	});

	test("exits 2 on a prefix that breaks the rules", async () => {
		let run = await invoke(cli, ["new", "User"]);

		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain('Invalid prefix "User"');
	});

	test("exits 2 on a count below one", async () => {
		let run = await invoke(cli, ["new", "user", "--count", "0"]);

		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
	});
});

describe("parse", () => {
	test("prints the prefix, suffix, UUID and creation time", async () => {
		let run = await invoke(cli, ["parse", TYPEID]);

		expect(run).toMatchObject({
			code: 0,
			stderr: "",
			stdout: [
				"prefix:    user",
				"suffix:    01h455vb4pex5vsknk084sn02q",
				`uuid:      ${UUID}`,
				"timestamp: 2023-06-30T03:34:18.518Z",
				"",
			].join("\n"),
		});
	});

	test("prints the parts as JSON", async () => {
		let run = await invoke(cli, ["parse", TYPEID, "--json"]);

		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			valid: true,
			prefix: "user",
			suffix: "01h455vb4pex5vsknk084sn02q",
			uuid: UUID,
			timestamp: "2023-06-30T03:34:18.518Z",
		});
	});

	test("reports no timestamp for a suffix that is not UUIDv7", async () => {
		let id = TypeID.fromUUID("org", "8e03978e-40d5-43e8-bc93-6894a57f9324" as never).toString();
		let run = await invoke(cli, ["parse", id, "--json"]);

		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toMatchObject({ prefix: "org", timestamp: null });
	});

	test("exits 1 with the reason on an invalid TypeID", async () => {
		let run = await invoke(cli, ["parse", "user_nope"]);

		expect(run.code).toBe(1);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("Suffix should have 26 characters, got 4");
	});

	test("reports an invalid TypeID as JSON", async () => {
		let run = await invoke(cli, ["parse", "_01h455vb4pex5vsknk084sn02q", "--json"]);

		expect(run.code).toBe(1);
		expect(JSON.parse(run.stdout)).toEqual({
			valid: false,
			error: expect.stringContaining("Prefix cannot be empty"),
		});
	});

	test("exits 2 without a TypeID", async () => {
		let run = await invoke(cli, ["parse"]);

		expect(run.code).toBe(2);
	});
});

describe("encode", () => {
	test("prints the TypeID for a UUID", async () => {
		let run = await invoke(cli, ["encode", "user", UUID]);

		expect(run).toMatchObject({ code: 0, stdout: `${TYPEID}\n`, stderr: "" });
	});

	test("exits 2 on a UUID that is not canonical", async () => {
		let run = await invoke(cli, ["encode", "user", UUID.toUpperCase()]);

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Invalid UUID");
	});

	test("exits 2 on a prefix that breaks the rules", async () => {
		let run = await invoke(cli, ["encode", "_user", UUID]);

		expect(run.code).toBe(2);
		expect(run.stderr).toContain('Invalid prefix "_user"');
	});
});
