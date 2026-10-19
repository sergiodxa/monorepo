/**
 * The policy compiles, so every grant names an ability the catalog declares and every condition
 * reads a fact or record it is given; `sdxc make policy` writes a test per resource beside it.
 */

import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import policy from "~/app/policies/policy";

describe("policy", () => {
	test("compiles", () => {
		expect(isSuccess(policy.compile())).toBe(true);
	});
});
