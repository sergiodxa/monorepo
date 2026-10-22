/**
 * Tests for which packages a week of releases counts. The rule that matters is the
 * republish exclusion: a package bumped only because a dependency changed is in the release
 * body but did nothing a reader would want to hear about.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import type { GitHubRelease } from "~/app/services/releases/github";
import type { ReleaseSource } from "~/config/releases";

import {
	changedPackages,
	releasedPackages,
	weeklyReleaseSummary,
} from "~/app/services/releases/packages";
import {
	MONOREPO_FIRST_BODY,
	MONOREPO_MIXED_BODY,
	MONOREPO_SINGLE_BODY,
	PACKAGE_BODY,
} from "~/app/test/github-releases";
import { RELEASE_SOURCES } from "~/config/releases";

/** A release of `repository` with `body`, published inside any window the tests use. */
function release(repository: string, body: string, tag = "v1.0.0"): GitHubRelease {
	return {
		repository,
		tag,
		url: `https://github.com/${repository}/releases/tag/${tag}`,
		publishedAt: new Date("2026-10-14T12:00:00Z"),
		body,
	};
}

describe("changedPackages", () => {
	test("leaves out a section whose only content is a republish line", () => {
		expect(changedPackages(MONOREPO_MIXED_BODY, "@sdxc")).toEqual([
			"@sdxc/activitypub",
			"@sdxc/cloudflare-mocks",
		]);
	});

	test("leaves out a republish-only last section followed by the compare footer", () => {
		let body =
			"## @sdxc/xml\nRepublished because `@sdxc/result` changed.\n\nCompare: https://github.com/sergiodxa/monorepo/compare/a...b\n";
		expect(changedPackages(body, "@sdxc")).toEqual([]);
	});

	test("counts a section changed besides its republish line", () => {
		let body =
			"## @sdxc/cache\nRepublished because `@sdxc/logger` changed.\n- fix: expire entries on time\n";
		expect(changedPackages(body, "@sdxc")).toEqual(["@sdxc/cache"]);
	});

	test("counts the last section before the compare footer", () => {
		expect(changedPackages(MONOREPO_SINGLE_BODY, "@sdxc")).toEqual(["@sdxc/spec"]);
	});

	test("counts a first release as a change", () => {
		expect(changedPackages(MONOREPO_FIRST_BODY, "@sdxc")).toEqual(["@sdxc/crypto", "@sdxc/result"]);
	});

	test("ignores headings outside the scope and empty sections", () => {
		let body = "## What's Changed\n- something\n\n## @sdxc/empty\n\n## @other/pkg\n- feat: x\n";
		expect(changedPackages(body, "@sdxc")).toEqual([]);
	});

	test("reads a body written with CRLF line endings", () => {
		let body =
			"## @sdxc/a\r\nRepublished because `@sdxc/b` changed.\r\n\r\n## @sdxc/b\r\n- fix: y\r\n";
		expect(changedPackages(body, "@sdxc")).toEqual(["@sdxc/b"]);
	});
});

describe("releasedPackages", () => {
	test("counts a single-package release as its package, linked to npm", () => {
		expect(
			releasedPackages([release("sergiodxa/remix-utils", PACKAGE_BODY)], RELEASE_SOURCES),
		).toEqual([{ name: "remix-utils", url: "https://www.npmjs.com/package/remix-utils" }]);
	});

	test("lists each package once across releases and repositories, sorted by name", () => {
		let packages = releasedPackages(
			[
				release("sergiodxa/remix-auth", "", "v4.2.0"),
				release("sergiodxa/monorepo", MONOREPO_MIXED_BODY, "v2026.10.12"),
				release("sergiodxa/monorepo", "## @sdxc/activitypub\n- fix: z\n", "v2026.10.13"),
				release("sergiodxa/remix-auth", "", "v4.2.1"),
				release("sergiodxa/monorepo", MONOREPO_SINGLE_BODY, "v2026.10.14"),
			],
			RELEASE_SOURCES,
		);

		expect(packages).toEqual([
			{ name: "@sdxc/activitypub", url: "https://www.npmjs.com/package/@sdxc/activitypub" },
			{
				name: "@sdxc/cloudflare-mocks",
				url: "https://www.npmjs.com/package/@sdxc/cloudflare-mocks",
			},
			{ name: "@sdxc/spec", url: "https://www.npmjs.com/package/@sdxc/spec" },
			{ name: "remix-auth", url: "https://www.npmjs.com/package/remix-auth" },
		]);
	});

	test("links a package npm lacks to its repository", () => {
		let sources: ReleaseSource[] = [
			{ kind: "package", repository: "sergiodxa/tool", name: "tool", registry: "github" },
		];

		expect(releasedPackages([release("sergiodxa/tool", "")], sources)).toEqual([
			{ name: "tool", url: "https://github.com/sergiodxa/tool" },
		]);
	});

	test("ignores a release from a repository that is not a source", () => {
		expect(
			releasedPackages([release("someone/else", MONOREPO_SINGLE_BODY)], RELEASE_SOURCES),
		).toEqual([]);
	});
});

describe("weeklyReleaseSummary", () => {
	test("pairs the slug with the week's packages", () => {
		let summary = weeklyReleaseSummary(
			"2026-w42",
			[release("sergiodxa/monorepo", MONOREPO_SINGLE_BODY)],
			RELEASE_SOURCES,
		);

		expect(summary).toEqual({
			slug: "2026-w42",
			packages: [{ name: "@sdxc/spec", url: "https://www.npmjs.com/package/@sdxc/spec" }],
		});
	});

	test("answers null for a week of republishes only", () => {
		let body = "## @sdxc/api-client\nRepublished because `@sdxc/trace-context` changed.\n";
		expect(
			weeklyReleaseSummary("2026-w42", [release("sergiodxa/monorepo", body)], RELEASE_SOURCES),
		).toBeNull();
	});

	test("answers null for a week without releases", () => {
		expect(weeklyReleaseSummary("2026-w42", [], RELEASE_SOURCES)).toBeNull();
	});
});
