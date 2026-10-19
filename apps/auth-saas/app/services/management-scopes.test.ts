/**
 * Unit tests for the management API's scope vocabulary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { isManagementScope, MANAGEMENT_SCOPES } from "./management-scopes";

describe("MANAGEMENT_SCOPES", () => {
	test("carries exactly the ten scopes the platform recognizes", () => {
		expect([...MANAGEMENT_SCOPES].sort()).toEqual(
			[
				"subjects:read",
				"subjects:write",
				"sessions:write",
				"clients:write",
				"keys:write",
				"webhooks:write",
				"audit:read",
				"export:read",
				"tenant:write",
				"members:write",
			].sort(),
		);
	});
});

describe("isManagementScope", () => {
	test("accepts every declared scope", () => {
		for (let scope of MANAGEMENT_SCOPES) expect(isManagementScope(scope)).toBe(true);
	});

	test("refuses a string outside the vocabulary", () => {
		expect(isManagementScope("subjects:delete")).toBe(false);
		expect(isManagementScope("")).toBe(false);
	});
});
