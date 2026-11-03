/**
 * Pins that the counts the copy quotes come from the catalogue the site renders, so a
 * sentence such as "N packages" agrees with the package index.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { contentVariables } from "~/app/services/content-variables";
import { readPackageFacts } from "~/app/services/packages";
import { listShowcase } from "~/app/services/showcase";

describe("contentVariables", () => {
	test("quotes the package catalogue's facts", () => {
		let facts = readPackageFacts();
		expect(contentVariables()).toMatchObject({
			packageCount: String(facts.published),
			standaloneCount: String(facts.standalone),
			frameworkFreeCount: String(facts.frameworkFree),
			remixCount: String(facts.remixTargeted),
		});
	});

	test("counts the showcase's applications", () => {
		expect(contentVariables().applicationCount).toBe(String(listShowcase().length));
	});
});
