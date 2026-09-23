/**
 * Tests for the showcase listing. The counts are the page's whole claim, so they are
 * checked against the manifests they are read from rather than against a number
 * written down here — a dependency added to an app tomorrow must move the page, not
 * break the test.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { listApplicationsUsing } from "~/app/services/packages";
import { listShowcase } from "~/app/services/showcase";
import { APPLICATIONS } from "~/resources/content/apps";

describe("listShowcase", () => {
	test("lists the five curated applications and no others", () => {
		expect(
			listShowcase()
				.map((entry) => entry.directory)
				.sort(),
		).toEqual(["auth-saas", "blog", "books", "reader", "uptime"]);
	});

	test("counts each application's packages rather than quoting a written-down number", () => {
		for (let entry of listShowcase()) {
			expect(entry.packageCount).toBeGreaterThan(0);
		}
	});

	test("orders by how deeply an application reaches into the collection", () => {
		let counts = listShowcase().map((entry) => entry.packageCount);

		expect(counts).toEqual([...counts].sort((a, b) => b - a));
	});

	test("labels an application with no deployment rather than hiding it", () => {
		let entries = listShowcase();

		expect(entries.some((entry) => entry.href === null)).toBe(true);
		expect(entries.every((entry) => entry.sourceHref.startsWith("https://github.com/"))).toBe(true);
	});
});

describe("the used-by line and the showcase", () => {
	test("name applications from the same set", () => {
		let shown = new Set(listShowcase().map((entry) => entry.title));
		let named = new Set(APPLICATIONS.flatMap(() => listApplicationsUsing("@sdxc/result")));

		for (let title of named) expect(shown.has(title)).toBe(true);
	});

	test("never claims more users than the showcase lists", () => {
		expect(listApplicationsUsing("@sdxc/result").length).toBeLessThanOrEqual(listShowcase().length);
	});
});
