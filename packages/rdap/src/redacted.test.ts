/**
 * Holds the `redacted` reader to RFC 9537's own examples: every entry of the Figure 12
 * lookup resolves onto its model field, the single-entry figures keep their method and
 * paths, and `isRedacted` answers for whole contacts as well as single fields.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { toDomain } from "./document.js";
import {
	ANONYMIZED_EMAIL,
	EMAIL_TO_WEB_FORM,
	PARTIAL_LABEL,
	REDACTED_LOOKUP,
	REGISTERED_NAME,
} from "./fixtures/rfc9537.js";
import { isRedacted, redactions } from "./redacted.js";

describe("redactions", () => {
	test("resolves every entry of the RFC 9537 Figure 12 lookup onto its field", () => {
		let found = redactions(REDACTED_LOOKUP.redacted);
		expect(found.map((redaction) => [redaction.name, redaction.field, redaction.method])).toEqual([
			["Registry Domain ID", "handle", "removal"],
			["Registrant Name", "registrant.name", "emptyValue"],
			["Registrant Organization", "registrant.organization", "removal"],
			["Registrant Street", "registrant.address", "emptyValue"],
			["Registrant City", "registrant.address", "emptyValue"],
			["Registrant Postal Code", "registrant.address", "emptyValue"],
			["Registrant Email", "registrant.email", "removal"],
			["Registrant Phone", "registrant.phone", "removal"],
			["Technical Name", "technical.name", "emptyValue"],
			["Technical Email", "technical.email", "removal"],
			["Technical Phone", "technical.phone", "removal"],
			["Technical Fax", "technical.fax", "removal"],
			["Administrative Contact", "administrative.contact", "removal"],
			["Billing Contact", "billing.contact", "removal"],
		]);
	});

	test("keeps the paths, language and reason as the response wrote them", () => {
		let [handle, name] = redactions(REDACTED_LOOKUP.redacted);
		expect(handle).toEqual({
			name: "Registry Domain ID",
			registered: false,
			field: "handle",
			method: "removal",
			prePath: "$.handle",
			postPath: null,
			replacementPath: null,
			pathLang: "jsonpath",
			reason: "Server policy",
		});
		expect(name?.postPath).toBe(
			"$.entities[?(@.roles[0]=='registrant')].vcardArray[1][?(@[0]=='fn')][3]",
		);
	});

	test("reads the replacement methods of Figures 7 and 9", () => {
		let [anonymized, webForm] = redactions([ANONYMIZED_EMAIL, EMAIL_TO_WEB_FORM]);
		expect(anonymized).toMatchObject({
			field: "registrant.email",
			method: "replacementValue",
			reason: null,
		});
		expect(webForm).toMatchObject({
			field: "registrant.email",
			method: "replacementValue",
			replacementPath:
				"$.entities[?(@.roles[0]=='registrant')].vcardArray[1][?(@[0]=='contact-uri')]",
		});
	});

	test("leaves the field of a path outside any entity to its name, and null when neither says", () => {
		let [label] = redactions([PARTIAL_LABEL]);
		expect(label).toMatchObject({ method: "partialValue", field: null });
	});

	test("marks a registered name and reason, and falls back to the name for an unread path", () => {
		let [entry] = redactions([REGISTERED_NAME]);
		expect(entry).toMatchObject({
			name: "Registry Domain ID",
			registered: true,
			field: "handle",
			reason: "Server policy",
		});
	});

	test("resolves the ICANN profile's registered names without a path", () => {
		let names = ["Registry Registrant ID", "Tech Email", "Registrant Phone Ext", "Registrant Fax"];
		let found = redactions(names.map((type) => ({ name: { type } })));
		expect(found.map((redaction) => redaction.field)).toEqual([
			"registrant.handle",
			"technical.email",
			"registrant.phone",
			"registrant.fax",
		]);
	});

	test("resolves JSContact paths, including a localization", () => {
		let base = "$.entities[?(@.roles[0]=='registrant')].jscontact_card";
		let paths = [
			`${base}.name.full`,
			`${base}.organizations.org.name`,
			`${base}.localizations.uk.addresses.addr.components[?(@.kind=='locality')].value`,
			`${base}.emails.email.address`,
			`${base}.phones.fax.number`,
			`${base}.phones.voice`,
			`${base}.links['contact-uri'].uri`,
			base,
		];
		let found = redactions(paths.map((prePath) => ({ name: { description: "x" }, prePath })));
		expect(found.map((redaction) => redaction.field)).toEqual([
			"registrant.name",
			"registrant.organization",
			"registrant.address",
			"registrant.email",
			"registrant.fax",
			"registrant.phone",
			"registrant.contactUri",
			"registrant.contact",
		]);
	});

	test("names the innermost role, so the registrar's abuse entity reads as abuse", () => {
		let [entry] = redactions([
			{
				name: { description: "Abuse Email" },
				prePath:
					"$.entities[?(@.roles[0]=='registrar')].entities[?(@.roles[0]=='abuse')].vcardArray[1][?(@[0]=='email')]",
			},
		]);
		expect(entry?.field).toBe("abuse.email");
	});

	test("defaults an unknown method to removal and skips entries without a name", () => {
		let found = redactions([
			{ name: { description: "Registrant Email" }, method: "scrambled" },
			{ name: {} },
			{ prePath: "$.handle" },
			"not an entry",
		]);
		expect(found).toHaveLength(1);
		expect(found[0]?.method).toBe("removal");
	});

	test.each([undefined, null, {}, "redacted"])("reads a malformed member %j as none", (member) => {
		expect(redactions(member)).toEqual([]);
	});
});

describe("isRedacted", () => {
	let domain = { redacted: redactions(REDACTED_LOOKUP.redacted) };

	test("answers for a redacted field and not for a published one", () => {
		expect(isRedacted(domain, "handle")).toBe(true);
		expect(isRedacted(domain, "registrant.email")).toBe(true);
		expect(isRedacted(domain, "registrar.name")).toBe(false);
		expect(isRedacted(domain, "technical.organization")).toBe(false);
	});

	test("covers every field of a contact removed whole", () => {
		expect(isRedacted(domain, "administrative.email")).toBe(true);
		expect(isRedacted(domain, "billing.name")).toBe(true);
	});

	test("reads the redactions into the domain a lookup answers", () => {
		let built = toDomain(
			REDACTED_LOOKUP,
			"https://rdap.example.com/domain/example.com",
			"example.com",
		);
		if (!isSuccess(built)) throw new Error("expected a domain");
		expect(built.data.redacted).toHaveLength(14);
		expect(built.data.handle).toBeNull();
		expect(isRedacted(built.data, "registrant.name")).toBe(true);
	});
});
