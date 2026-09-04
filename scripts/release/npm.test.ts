/**
 * The registry reading behind the release: a packument answers with the `latest` version and
 * its `gitHead`, falls back to the highest version when no `latest` tag exists (a package whose
 * only version is the bootstrap placeholder under another tag), and ranks the versions this
 * repository publishes the way SemVer does, and a mocked registry answers the two endpoints
 * `viewPackage` reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { highestVersion, parsePackument, publishedFromDistTags, viewPackage } from "./npm.js";

const REGISTRY_URL = "https://registry.npmjs.org";

const SERVER = setupServer();

beforeAll(() => {
	SERVER.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
	SERVER.resetHandlers();
});

afterAll(() => {
	SERVER.close();
});

/**
 * The two endpoints `viewPackage` reads, each answering with one fixed status and body. Both
 * are matched by a wildcard because a scoped name is one path segment holding an encoded
 * slash, and the dist-tags handler comes first so it wins over the packument's wildcard.
 */
function registryAnswers(packument: () => Response, distTags: () => Response): void {
	SERVER.use(
		http.get(`${REGISTRY_URL}/-/package/*`, () => distTags()),
		http.get(`${REGISTRY_URL}/*`, () => packument()),
	);
}

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

describe("publishedFromDistTags", () => {
	test("reads the latest tag, which the registry sets on a first publish whatever the tag sent", () => {
		expect(publishedFromDistTags({ alpha: "0.0.0-pre.1", latest: "0.0.0-pre.1" })).toEqual({
			version: "0.0.0-pre.1",
			gitHead: null,
		});
		expect(publishedFromDistTags({ latest: "2026.9.4", alpha: "0.0.0-pre.1" })).toEqual({
			version: "2026.9.4",
			gitHead: null,
		});
	});

	test("falls back to the highest tagged version without a latest tag", () => {
		expect(publishedFromDistTags({ alpha: "0.0.0-pre.1", beta: "0.0.0-pre.2" })).toEqual({
			version: "0.0.0-pre.2",
			gitHead: null,
		});
	});

	test("treats a package without tags as never published", () => {
		expect(publishedFromDistTags({})).toBeNull();
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

describe("viewPackage", () => {
	test("reads the packument the registry serves for a published package", async () => {
		registryAnswers(
			() =>
				HttpResponse.json({
					"dist-tags": { latest: "2026.9.4" },
					versions: { "2026.9.4": { gitHead: "abc" } },
				}),
			() => HttpResponse.json({ latest: "2026.9.4" }),
		);

		expect(unwrap(await viewPackage("@sdxc/jwt"))).toEqual({
			version: "2026.9.4",
			gitHead: "abc",
		});
	});

	test("falls back to the dist-tags of a package whose packument still lags", async () => {
		registryAnswers(
			() => HttpResponse.json({ message: "Not found" }, { status: 404 }),
			() => HttpResponse.json({ alpha: "0.0.0-pre.1" }),
		);

		expect(unwrap(await viewPackage("@sdxc/jwt"))).toEqual({
			version: "0.0.0-pre.1",
			gitHead: null,
		});
	});

	test("reads a package the registry has never seen as unpublished, 401 dist-tags included", async () => {
		registryAnswers(
			() => HttpResponse.json({ message: "Not found" }, { status: 404 }),
			() => HttpResponse.json({ message: "Unauthorized" }, { status: 401 }),
		);

		expect(unwrap(await viewPackage("@sdxc/i18n"))).toBeNull();
	});

	test("fails on a status that says neither published nor absent", async () => {
		registryAnswers(
			() => HttpResponse.json({ message: "Service Unavailable" }, { status: 503 }),
			() => HttpResponse.json({ message: "Unauthorized" }, { status: 401 }),
		);

		let result = await viewPackage("@sdxc/jwt");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("503");
	});
});
