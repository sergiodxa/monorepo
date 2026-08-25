/**
 * Unit tests for the add/remove/retry-verification team-domain form
 * validators: the `hostname` length constraints and the plain id schemas.
 * Exercises the schemas directly via `parseSafe()` with real `FormData`,
 * since `f.object(...)` form-data schemas accept only the raw
 * `FormData`/`URLSearchParams` instance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import {
	AddDomainSchema,
	RemoveDomainSchema,
	RetryDomainVerificationSchema,
} from "~/app/http/validators/team-domain";

describe("AddDomainSchema", () => {
	test("accepts a valid hostname", () => {
		let formData = new FormData();
		formData.set("hostname", "status.example.com");
		expect(s.parseSafe(AddDomainSchema, formData).success).toBe(true);
	});

	test("rejects an empty hostname", () => {
		let formData = new FormData();
		formData.set("hostname", "");
		expect(s.parseSafe(AddDomainSchema, formData).success).toBe(false);
	});

	test("rejects a hostname longer than 255 characters", () => {
		let formData = new FormData();
		formData.set("hostname", "a".repeat(256));
		expect(s.parseSafe(AddDomainSchema, formData).success).toBe(false);
	});

	test("rejects a missing hostname field", () => {
		expect(s.parseSafe(AddDomainSchema, new FormData()).success).toBe(false);
	});
});

describe("RemoveDomainSchema", () => {
	test("accepts a valid domain_id", () => {
		let formData = new FormData();
		formData.set("domain_id", "domain_1");
		expect(s.parseSafe(RemoveDomainSchema, formData).success).toBe(true);
	});

	test("rejects a missing domain_id", () => {
		expect(s.parseSafe(RemoveDomainSchema, new FormData()).success).toBe(false);
	});
});

describe("RetryDomainVerificationSchema", () => {
	test("accepts a valid domain_id", () => {
		let formData = new FormData();
		formData.set("domain_id", "domain_1");
		expect(s.parseSafe(RetryDomainVerificationSchema, formData).success).toBe(true);
	});

	test("rejects a missing domain_id", () => {
		expect(s.parseSafe(RetryDomainVerificationSchema, new FormData()).success).toBe(false);
	});
});
