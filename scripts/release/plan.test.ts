/**
 * Release planning over an inline package graph: which packages a run ships, why each one is
 * there, in what order, and which exact versions their internal dependencies pin to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Published, ReleasePlan } from "./plan.js";
import type { Package } from "./workspace.js";

import { dependencyPins, isBootstrapVersion, isNew, planRelease, releaseVersion } from "./plan.js";
import { packageFromManifest } from "./workspace.js";

interface FixtureOptions {
	isPrivate?: boolean;
	devDependencies?: string[];
}

interface PlanOptions {
	published?: Map<string, Published | null>;
	force?: boolean;
}

/** A workspace package named `@sdxc/<dir>` whose internal dependencies are the given dirs. */
function pkg(dir: string, dependencies: string[] = [], options: FixtureOptions = {}): Package {
	return packageFromManifest(dir, {
		name: `@sdxc/${dir}`,
		version: "0.0.1",
		...(options.isPrivate ? { private: true } : {}),
		exports: { ".": "./src/index.ts" },
		dependencies: Object.fromEntries(dependencies.map((name) => [`@sdxc/${name}`, "workspace:*"])),
		devDependencies: Object.fromEntries(
			(options.devDependencies ?? []).map((name) => [`@sdxc/${name}`, "workspace:*"]),
		),
	});
}

/** The starter chain plus a private package and a devDependency-only dependent. */
const PACKAGES = [
	pkg("types"),
	pkg("result", ["types"]),
	pkg("duration", ["result"]),
	pkg("dates", ["duration", "result"]),
	pkg("crypto", ["result"]),
	pkg("jwt", ["duration"]),
	pkg("sample", ["crypto", "dates", "duration", "jwt"]),
	pkg("spec", ["duration", "result", "sample"]),
	pkg("internal", ["result"], { isPrivate: true }),
	pkg("tool", [], { devDependencies: ["result"] }),
];

/** Every public package at a dated version, so nothing counts as new unless overridden. */
function allPublished(
	overrides: Record<string, Published | null> = {},
): Map<string, Published | null> {
	let published = new Map<string, Published | null>();
	for (let member of PACKAGES) {
		if (member.isPrivate) continue;
		published.set(member.name, { version: "2026.9.1", gitHead: "a".repeat(40) });
	}
	for (let [name, value] of Object.entries(overrides)) published.set(name, value);
	return published;
}

function plan(touched: string[], options: PlanOptions = {}): ReleasePlan {
	return unwrap(
		planRelease({
			packages: PACKAGES,
			touched: new Set(touched),
			published: options.published ?? allPublished(),
			force: options.force ?? false,
			version: "2026.9.3",
		}),
	);
}

function reasons(result: ReleasePlan): Record<string, string> {
	return Object.fromEntries(result.members.map((member) => [member.name, member.reason]));
}

describe("releaseVersion", () => {
	test("is the UTC date without zero padding", () => {
		expect(releaseVersion(new Date("2026-09-03T23:30:00Z"))).toBe("2026.9.3");
		expect(releaseVersion(new Date("2026-09-04T00:10:00Z"))).toBe("2026.9.4");
		expect(releaseVersion(new Date("2026-01-05T12:00:00Z"))).toBe("2026.1.5");
		expect(releaseVersion(new Date("2026-12-25T12:00:00Z"))).toBe("2026.12.25");
	});
});

describe("isNew", () => {
	test("treats absent and bootstrap versions as new, dated ones as released", () => {
		expect(isNew(null)).toBe(true);
		expect(isNew("0.0.0-pre.1")).toBe(true);
		expect(isNew("0.0.0-pre.12")).toBe(true);
		expect(isNew("2026.9.3")).toBe(false);
		expect(isNew("0.0.1")).toBe(false);
	});

	test("recognises only the bootstrap placeholder shape", () => {
		expect(isBootstrapVersion("0.0.0-pre.1")).toBe(true);
		expect(isBootstrapVersion("0.0.0")).toBe(false);
		expect(isBootstrapVersion("1.0.0-pre.1")).toBe(false);
	});
});

describe("planRelease", () => {
	test("marks a touched package changed and pulls in every public dependent", () => {
		expect(reasons(plan(["@sdxc/types"]))).toEqual({
			"@sdxc/types": "changed",
			"@sdxc/result": "dependency",
			"@sdxc/duration": "dependency",
			"@sdxc/dates": "dependency",
			"@sdxc/crypto": "dependency",
			"@sdxc/jwt": "dependency",
			"@sdxc/sample": "dependency",
			"@sdxc/spec": "dependency",
		});
	});

	test("cascades through dependencies only, so a devDependency-only dependent stays out", () => {
		expect(plan(["@sdxc/result"]).order).not.toContain("@sdxc/tool");
	});

	test("never includes a private package, even when touched or dependent", () => {
		expect(plan(["@sdxc/internal"])).toEqual({ version: "2026.9.3", members: [], order: [] });
		expect(plan(["@sdxc/result"]).order).not.toContain("@sdxc/internal");
	});

	test("treats a package absent from npm or at a bootstrap version as new", () => {
		let published = allPublished({
			"@sdxc/tool": null,
			"@sdxc/crypto": { version: "0.0.0-pre.1", gitHead: null },
		});

		expect(reasons(plan([], { published }))).toEqual({
			"@sdxc/tool": "new",
			"@sdxc/crypto": "new",
			"@sdxc/sample": "dependency",
			"@sdxc/spec": "dependency",
		});
	});

	test("ranks new above changed and changed above dependency", () => {
		let published = allPublished({ "@sdxc/result": null });

		expect(reasons(plan(["@sdxc/types", "@sdxc/result"], { published }))["@sdxc/result"]).toBe(
			"new",
		);
		expect(reasons(plan(["@sdxc/types", "@sdxc/duration"]))["@sdxc/duration"]).toBe("changed");
	});

	test("force ships every public package, as changed unless it is new", () => {
		let published = allPublished({ "@sdxc/tool": null });
		let result = plan([], { published, force: true });

		expect(result.order).toHaveLength(9);
		expect(reasons(result)["@sdxc/tool"]).toBe("new");
		expect(reasons(result)["@sdxc/spec"]).toBe("changed");
		expect(result.order).not.toContain("@sdxc/internal");
	});

	test("plans nothing when nothing changed and everything is published", () => {
		expect(plan([])).toEqual({ version: "2026.9.3", members: [], order: [] });
	});

	test("orders every member after the members it depends on, members following the order", () => {
		let result = plan(["@sdxc/types"]);
		let position = new Map(result.order.map((name, index) => [name, index]));

		expect(result.members.map((member) => member.name)).toEqual(result.order);
		for (let member of PACKAGES) {
			if (!position.has(member.name)) continue;
			for (let dependency of member.dependencies) {
				if (!position.has(dependency)) continue;
				expect(position.get(dependency)).toBeLessThan(position.get(member.name) ?? -1);
			}
		}
	});

	test("fails on a dependency cycle among the members, naming it", () => {
		let result = planRelease({
			packages: [pkg("a", ["b"]), pkg("b", ["a"])],
			touched: new Set(["@sdxc/a"]),
			published: allPublished(),
			force: false,
			version: "2026.9.3",
		});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("Dependency cycle: ");
	});
});

describe("dependencyPins", () => {
	test("pins members to the release version and the rest to their npm version", () => {
		let spec = PACKAGES.find((member) => member.name === "@sdxc/spec");
		let published = allPublished({
			"@sdxc/duration": { version: "2026.9.1", gitHead: null },
			"@sdxc/result": { version: "2026.8.30", gitHead: null },
		});

		expect(spec).toBeDefined();
		if (!spec) return;
		expect(
			unwrap(dependencyPins(spec, ["@sdxc/spec", "@sdxc/sample"], "2026.9.3", published)),
		).toEqual({
			"@sdxc/duration": "2026.9.1",
			"@sdxc/result": "2026.8.30",
			"@sdxc/sample": "2026.9.3",
		});
	});

	test("refuses a dependency that is neither a member nor on npm", () => {
		let spec = PACKAGES.find((member) => member.name === "@sdxc/spec");
		let published = allPublished({ "@sdxc/result": null });

		expect(spec).toBeDefined();
		if (!spec) return;
		let result = dependencyPins(spec, ["@sdxc/spec"], "2026.9.3", published);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("@sdxc/result");
	});
});
