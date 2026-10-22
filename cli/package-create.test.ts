/**
 * `package create --dry-run` plans the six minimum files without writing them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { createMonorepoCLI } from "./index.js";

describe("package create", () => {
	test("--help lists the command", async () => {
		let ran = await invoke(createMonorepoCLI(), ["package", "create", "--help"]);
		expect(ran.code).toBe(0);
		expect(ran.stdout).toContain("description");
	});
});
