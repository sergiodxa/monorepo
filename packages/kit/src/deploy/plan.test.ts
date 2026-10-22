/**
 * Tests how `sdxc deploy` reads the app's pending-migration listing, recognizes the usage errors
 * an app without a command prints, and words where production stands after a failed deploy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ExecError } from "@sdxc/cli";
import { describe, expect, test } from "vite-plus/test";

import { deployFailure, formatPlan, isUnknown, migrates, parsePending } from "./plan.js";

describe("parsePending", () => {
	test("reads one name per line and ignores blank lines", () => {
		expect(parsePending("0001_init.sql\n\n  0002_tags.sql  \n")).toEqual([
			"0001_init.sql",
			"0002_tags.sql",
		]);
		expect(parsePending("")).toEqual([]);
	});
});

describe("isUnknown", () => {
	test("matches the usage error for a missing command or flag only", () => {
		let command = new ExecError("exited", {
			command: ["bun"],
			code: 2,
			stderr: 'Unknown command "deploy" for app',
		});
		let flag = new ExecError("exited", {
			command: ["bun"],
			code: 2,
			stderr: "Unknown flag --pending",
		});
		let crashed = new ExecError("exited", {
			command: ["bun"],
			code: 1,
			stderr: 'Unknown command "deploy" for app',
		});

		expect(isUnknown(command, "command")).toBe(true);
		expect(isUnknown(command, "flag")).toBe(false);
		expect(isUnknown(flag, "flag")).toBe(true);
		expect(isUnknown(crashed, "command")).toBe(false);
		expect(isUnknown(new Error("spawn failed"), "command")).toBe(false);
	});
});

describe("migrates", () => {
	test("runs the migration step for pending or unlisted migrations", () => {
		expect(migrates({ status: "pending", names: ["0001_init.sql"] })).toBe(true);
		expect(migrates({ status: "unlisted" })).toBe(true);
		expect(migrates({ status: "pending", names: [] })).toBe(false);
		expect(migrates({ status: "skipped", reason: "--skip migrate" })).toBe(false);
	});
});

describe("formatPlan", () => {
	test("lists every pending migration under the step", () => {
		let plan = formatPlan({
			app: "blog",
			build: true,
			migrations: { status: "pending", names: ["0001_init.sql", "0002_tags.sql"] },
			deploy: true,
		});

		expect(plan).toBe(
			[
				"App:        blog",
				"Build:      built just now",
				"Migrations: 2 pending",
				"  0001_init.sql",
				"  0002_tags.sql",
				"Deploy:     the app's deploy command",
				"",
			].join("\n"),
		);
	});
});

describe("deployFailure", () => {
	test("says which schema production runs the previous version on", () => {
		expect(deployFailure({ status: "pending", names: ["0002_tags.sql"] })).toContain(
			"migrations 0002_tags.sql were applied",
		);
		expect(deployFailure({ status: "unlisted" })).toContain("may run the previous version");
		expect(deployFailure({ status: "skipped", reason: "--skip migrate" })).toContain(
			"production still runs the previous version",
		);
	});
});
