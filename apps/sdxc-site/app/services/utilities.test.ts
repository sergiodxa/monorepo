/**
 * Covers the generated `@sdxc/u` document the site serves. The extraction that built
 * it is tested where it lives; this is the other half — that every page a URL can ask
 * for is in the document, shaped the way the page reads it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { findUtility, listUtilityFamilies, readUtility } from "~/app/services/utilities";

describe("listUtilityFamilies", () => {
	test("groups every published utility under the subpath it is imported from", async () => {
		let families = await listUtilityFamilies();
		let names = families.flatMap((family) => family.utilities.map((utility) => utility.name));

		expect(families).toHaveLength(13);
		expect(names).toHaveLength(297);
		expect(new Set(names).size).toBe(names.length);
	});
});

describe("findUtility", () => {
	test("finds a utility by the name its URL carries", async () => {
		expect(await findUtility("p")).toEqual({ name: "p", family: "size", module: "p" });
		expect(await findUtility("nothing")).toBeNull();
	});
});

describe("readUtility", () => {
	test("titles a page after the property its first example emits", async () => {
		let reference = await readUtility("p");

		expect(reference?.property).toBe("padding");
		expect(reference?.family).toBe("size");
		expect(reference?.signature).toBe("u.p(...values: SpacingValue[])");
		expect(reference?.see[0]?.href).toContain("developer.mozilla.org");
	});

	test("keeps its own name where the utility sets no single property", async () => {
		expect((await readUtility("hover"))?.property).toBe("hover");
	});

	test("holds a reference for every utility the tree links to", async () => {
		let families = await listUtilityFamilies();
		let entries = families.flatMap((family) => family.utilities);
		let read = await Promise.all(entries.map((entry) => readUtility(entry.name)));

		expect(read.filter((reference) => reference === null)).toEqual([]);
		expect(read.filter((reference) => reference?.examples.length === 0)).toEqual([]);
	});

	test("reports nothing for a name the catalogue does not publish", async () => {
		expect(await readUtility("nothing")).toBeNull();
	});
});
