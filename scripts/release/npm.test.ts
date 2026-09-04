/**
 * The registry reading behind the release: a packument answers with the `latest` version and
 * its `gitHead`, falls back to the highest version when no `latest` tag exists (a package whose
 * only version is the bootstrap placeholder under another tag), and ranks the versions this
 * repository publishes the way SemVer does. Covered here without touching the network.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { highestVersion, parsePackument } from "./npm.js";

describe("parsePackument", () => {
	test("reads the latest tag's version and its gitHead", () => {
		let packument = {
			"dist-tags": { latest: "2026.9.4", alpha: "0.0.0-pre.1" },
			versions: { "0.0.0-pre.1": { gitHead: "000" }, "2026.9.4": { gitHead: "abc" } },
		};

		expect(unwrap(parsePackument(packument))).toEqual({ version: "2026.9.4", gitHead: "abc" });
	});

	test("falls back to the highest version when no latest tag exists, as after a bootstrap", () => {
		let packument = {
			"dist-tags": { alpha: "0.0.0-pre.1" },
			versions: { "0.0.0-pre.1": {} },
		};

		expect(unwrap(parsePackument(packument))).toEqual({ version: "0.0.0-pre.1", gitHead: null });
	});

	test("treats a packument without versions as never published", () => {
		expect(unwrap(parsePackument({ versions: {} }))).toBeNull();
		expect(unwrap(parsePackument({ name: "@sdxc/types" }))).toBeNull();
	});

	test("rejects a response that is not a packument", () => {
		let text = parsePackument("nope");
		let nothing = parsePackument(null);

		expect(isFailure(text)).toBe(true);
		if (isFailure(text)) expect(text.error.message).toContain("Unexpected registry response");
		expect(isFailure(nothing)).toBe(true);
	});
});

describe("highestVersion", () => {
	test("orders dated versions numerically and ranks a placeholder below every one of them", () => {
		expect(highestVersion(["2026.9.4", "0.0.0-pre.1", "2026.10.1", "2026.9.30"])).toBe("2026.10.1");
		expect(highestVersion(["0.0.0-pre.1", "2026.9.4"])).toBe("2026.9.4");
	});

	test("orders pre-release identifiers numerically and below the release they precede", () => {
		expect(highestVersion(["0.0.0-pre.10", "0.0.0-pre.9", "0.0.0-pre.2"])).toBe("0.0.0-pre.10");
		expect(highestVersion(["0.0.0-pre.1", "0.0.0"])).toBe("0.0.0");
	});
});
