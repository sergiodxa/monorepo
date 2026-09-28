/**
 * Tests the checks an accepted address goes through: parsing refuses what the old format
 * check let through, the optional disposable and typo checks refuse only when asked, and
 * the mail-server lookup refuses a domain with no mail host while a failed lookup passes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { useMailServerDns } from "~/app/lib/test/mail-servers";
import { checkEmailAddress, refuseUndeliverableRecipient } from "~/app/services/email-address";

/** Answers the lookups; every domain receives mail unless a test says otherwise. */
let dns = useMailServerDns();

/** The reason `input` is refused with, or `null` when it is accepted. */
async function reasonFor(input: string, checks?: Parameters<typeof checkEmailAddress>[1]) {
	let result = await checkEmailAddress(input, checks);
	return isFailure(result) ? result.error.reason : null;
}

describe("checkEmailAddress", () => {
	test("accepts an address whose domain receives mail, in its deliverable form", async () => {
		let result = await checkEmailAddress(" Jane@Example.COM ");

		expect(isSuccess(result) && result.data.address).toBe("Jane@example.com");
		expect(dns.asked).toEqual(["example.com"]);
	});

	test.each([
		["a@0x7f.1"],
		["a@localhost"],
		["a@example.com."],
		["a@ex%61mple.com"],
		["a​@example.com"],
	])("refuses %s before any lookup", async (input) => {
		expect(await reasonFor(input)).toBe("invalid");
		expect(dns.asked).toEqual([]);
	});

	test("refuses a domain with no mail host", async () => {
		dns.answer("nomail.example", "no-mail-server");

		let result = await checkEmailAddress("jane@nomail.example");

		expect(isFailure(result) && result.error.domain).toBe("nomail.example");
		expect(await reasonFor("jane@nomail.example")).toBe("no-mail-server");
	});

	test("lets an address through when the lookup fails, since the answer is unknown", async () => {
		dns.answer("flaky.example", "lookup-failed");

		expect(await reasonFor("jane@flaky.example")).toBeNull();
	});

	test("refuses a disposable inbox only when the form asks", async () => {
		expect(await reasonFor("jane@mailinator.com")).toBeNull();
		expect(await reasonFor("jane@mailinator.com", { disposable: true })).toBe("disposable");
	});

	test("names the likely provider for a mistyped domain only when the form asks", async () => {
		expect(await reasonFor("jane@gmal.com")).toBeNull();

		let result = await checkEmailAddress("jane@gmal.com", { typo: true });
		expect(isFailure(result) && result.error.suggestion).toBe("jane@gmail.com");
	});
});

describe("refuseUndeliverableRecipient", () => {
	test("answers a validation error naming the field for a domain with no mail host", async () => {
		dns.answer("nomail.example", "no-mail-server");

		let response = await refuseUndeliverableRecipient("jane@nomail.example", "/email");

		expect(response?.status).toBe(400);
		expect(await response?.json()).toMatchObject({
			errors: [
				{ pointer: "/email", code: "invalid", message: "nomail.example does not accept email" },
			],
		});
	});

	test("answers nothing for an address that may be stored", async () => {
		expect(await refuseUndeliverableRecipient("jane@example.com", "/email")).toBeNull();
	});
});
