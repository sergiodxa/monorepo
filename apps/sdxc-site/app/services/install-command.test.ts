/**
 * Covers the reading of one authored npm install line, which is what lets a page carry a
 * single command and offer every package manager's spelling of it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { parseInstallCommand } from "~/app/services/install-command";

describe("parseInstallCommand", () => {
	test("reads the packages an add installs", () => {
		expect(parseInstallCommand("npm add @sdxc/result @sdxc/response")).toEqual({
			packages: ["@sdxc/result", "@sdxc/response"],
			dev: false,
		});
	});

	test("reads install and i as add", () => {
		expect(parseInstallCommand("npm install @sdxc/http")?.packages).toEqual(["@sdxc/http"]);
		expect(parseInstallCommand("npm i @sdxc/http")?.packages).toEqual(["@sdxc/http"]);
	});

	test("reads every spelling of the dev-dependency flag", () => {
		expect(parseInstallCommand("npm install --save-dev @sdxc/spec")).toEqual({
			packages: ["@sdxc/spec"],
			dev: true,
		});
		expect(parseInstallCommand("npm add -D @sdxc/spec")?.dev).toBe(true);
	});

	test("leaves a global install to be printed as written", () => {
		expect(parseInstallCommand("npm add -g @sdxc/kit")).toBeNull();
		expect(parseInstallCommand("npm install --global @sdxc/kit")).toBeNull();
	});

	test("leaves a line that installs nothing to be printed as written", () => {
		expect(parseInstallCommand("npm run build")).toBeNull();
		expect(parseInstallCommand("npm add")).toBeNull();
		expect(parseInstallCommand("bun add @sdxc/http")).toBeNull();
	});
});
