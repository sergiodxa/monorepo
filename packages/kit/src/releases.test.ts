/**
 * The kit's release rule over a mocked npm registry: a package at a release is its newest dated
 * version on or before that date, `latest` without one, and a project's release is the newest
 * date among its `@sdxc/*` pins.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";

import { projectRelease, REGISTRY, resolveRelease, scopedPackageOf } from "./releases.js";
import { registryDocument } from "./testing.js";

/** The versions the mocked registry publishes per package. */
const PUBLISHED: Record<string, string[]> = {
	"@sdxc/jobs": ["0.0.0-pre.1", "2026.9.4", "2026.10.1", "2026.10.14"],
	"@sdxc/cli": ["2026.9.20"],
};

const SERVER = setupServer(
	http.get(`${REGISTRY}/*`, ({ request }) => {
		let name = decodeURIComponent(new URL(request.url).pathname.slice(1));
		let versions = PUBLISHED[name];
		if (versions === undefined) return HttpResponse.json({}, { status: 404 });
		return HttpResponse.json(registryDocument(name, versions));
	}),
);

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterAll(() => SERVER.close());

describe("resolveRelease", () => {
	test("pins each package to its newest version on or before the release", async () => {
		let pins = unwrap(await resolveRelease(["@sdxc/jobs", "@sdxc/cli"], "2026.10.12"));

		expect(Object.fromEntries(pins)).toEqual({
			"@sdxc/cli": "2026.9.20",
			"@sdxc/jobs": "2026.10.1",
		});
	});

	test("takes latest without a release", async () => {
		let pins = unwrap(await resolveRelease(["@sdxc/jobs"], null));

		expect(pins.get("@sdxc/jobs")).toBe("2026.10.14");
	});

	test("fails on a package with nothing that old, and one npm does not have", async () => {
		let early = await resolveRelease(["@sdxc/cli"], "2026.9.4");
		let missing = await resolveRelease(["@sdxc/nope"], null);

		expect(isFailure(early) && early.error.message).toBe(
			"@sdxc/cli has no release on or before 2026.9.4",
		);
		expect(isFailure(missing) && missing.error.message).toBe("@sdxc/nope is not published on npm");
	});
});

describe("projectRelease", () => {
	test("is the newest dated @sdxc/* pin, ranges and other packages aside", () => {
		expect(
			projectRelease([
				{ "@sdxc/jobs": "2026.10.1", remix: "3.0.0" },
				{ "@sdxc/cli": "^2026.10.12", "@sdxc/ui": "workspace:*", other: "2027.1.1" },
				undefined,
			]),
		).toBe("2026.10.12");
		expect(projectRelease([{ remix: "3.0.0" }])).toBeNull();
	});
});

describe("scopedPackageOf", () => {
	test.each([
		["@sdxc/jwt", "@sdxc/jwt"],
		["@sdxc/auth/remix/context", "@sdxc/auth"],
		["remix/router", null],
		["@sdxc/", null],
	])("%s comes from %s", (specifier, expected) => {
		expect(scopedPackageOf(specifier)).toBe(expected);
	});
});
