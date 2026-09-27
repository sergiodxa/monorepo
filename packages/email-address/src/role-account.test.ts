/**
 * Checks role-account detection: the RFC 2142 mailboxes and common shared or unattended
 * ones, matched on the case-folded local part with any plus tag removed, while personal
 * local parts that merely contain a role word pass.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseEmailAddress } from "./parse.js";
import { checkRoleAccount, RoleAccountError } from "./role-account.js";

/** Parses an address the test knows is valid. */
function address(input: string) {
	return unwrap(parseEmailAddress(input));
}

describe("checkRoleAccount", () => {
	test.each([
		"postmaster@example.com",
		"Admin@example.com",
		"noreply@example.com",
		"no-reply@example.com",
		"abuse@example.com",
		"support+billing@example.com",
	])("refuses %s", (input) => {
		let result = checkRoleAccount(address(input));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(RoleAccountError);
		expect(result.error.reason).toBe("role-account");
	});

	test("names the role the local part matched", () => {
		let result = checkRoleAccount(address("Support+Billing@example.com"));
		expect(isFailure(result) && result.error.role).toBe("support");
	});

	test.each(["jane@example.com", "administrator.jane@example.com", "sales-jane@example.com"])(
		"passes %s through",
		(input) => {
			let parsed = address(input);
			expect(unwrap(checkRoleAccount(parsed))).toBe(parsed);
		},
	);
});
