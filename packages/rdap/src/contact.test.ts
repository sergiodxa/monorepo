/**
 * Holds contact reading to its two sources: the JSContact entity of
 * draft-ietf-regext-rdap-jscontact Figure 2 and the jCard entities of RFC 9537 Figure 12 read
 * into the same `RDAP.Contact`, with redacted empty values reading as absent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { contacts, toContact } from "./contact.js";
import { toDomain } from "./document.js";
import { JSCONTACT_ENTITY } from "./fixtures/rdap-jscontact.js";
import { REDACTED_LOOKUP } from "./fixtures/rfc9537.js";
import { isRedacted } from "./redacted.js";

describe("toContact", () => {
	test("reads a JSContact card (draft-ietf-regext-rdap-jscontact Figure 2)", () => {
		let { card, ...contact } = toContact(JSCONTACT_ENTITY);
		expect(card).toBe(JSCONTACT_ENTITY.jscontact_card);
		expect(contact).toEqual({
			roles: ["registrar"],
			handle: "XXXX",
			kind: null,
			name: "Joe User",
			organization: "Org Example",
			emails: ["joe.user@example.com"],
			phones: ["tel:+49-1522-3433333"],
			faxes: ["tel:+49-30-901820"],
			address: {
				full: null,
				street: ["Main Street 1"],
				locality: "Ludwigshafen am Rhein",
				region: "Rhineland-Palatinate",
				postcode: "67067",
				country: "Germany",
				countryCode: "DE",
			},
			contactUri: "mailto:contact@example.com",
			url: "https://www.example.com",
		});
	});

	test("reads a jCard into the same shape", () => {
		let { card, ...contact } = toContact({
			roles: ["Registrant"],
			vcardArray: [
				"vcard",
				[
					["version", {}, "text", "4.0"],
					["fn", {}, "text", "Joe User"],
					["kind", {}, "text", "individual"],
					["org", {}, "text", "Org Example"],
					[
						"adr",
						{ cc: "DE" },
						"text",
						["", "", "Main Street 1", "Ludwigshafen am Rhein", "", "67067", "Germany"],
					],
					["tel", { type: "voice" }, "uri", "tel:+49-1522-3433333"],
					["tel", { type: "fax" }, "uri", "tel:+49-30-901820"],
					["email", {}, "text", "joe.user@example.com"],
					["contact-uri", {}, "uri", "mailto:contact@example.com"],
					["url", {}, "uri", "https://www.example.com"],
				],
			],
		});
		expect(card?.["@type"]).toBe("Card");
		expect(contact).toEqual({
			roles: ["registrant"],
			handle: null,
			kind: "individual",
			name: "Joe User",
			organization: "Org Example",
			emails: ["joe.user@example.com"],
			phones: ["tel:+49-1522-3433333"],
			faxes: ["tel:+49-30-901820"],
			address: {
				full: null,
				street: ["Main Street 1"],
				locality: "Ludwigshafen am Rhein",
				region: null,
				postcode: "67067",
				country: "Germany",
				countryCode: "DE",
			},
			contactUri: "mailto:contact@example.com",
			url: "https://www.example.com",
		});
	});

	test.each([{}, { vcardArray: "not a card" }, { vcardArray: ["card", []] }])(
		"reads an entity without a readable card %j as empty",
		(entity) => {
			expect(toContact(entity)).toMatchObject({
				card: null,
				name: null,
				emails: [],
				address: null,
			});
		},
	);
});

describe("contacts", () => {
	test("lists nested entities after their parent, redacted values reading as absent (RFC 9537 Figure 12)", () => {
		let found = contacts(REDACTED_LOOKUP.entities);
		expect(found.map((contact) => [contact.roles, contact.name])).toEqual([
			[["registrar"], "Example Registrar Inc."],
			[["abuse"], "Abuse Contact"],
			[["registrant"], null],
			[["technical"], null],
		]);
		expect(found[2]?.address).toMatchObject({ street: [], region: "QC", country: "Canada" });
		expect(found[3]?.organization).toBe("Example Inc.");
	});

	test("let a lookup tell a redacted registrant name from a missing one", () => {
		let built = toDomain(
			REDACTED_LOOKUP,
			"https://rdap.example.com/domain/example.com",
			"example.com",
		);
		if (!isSuccess(built)) throw new Error("expected a domain");
		let registrant = built.data.contacts.find((contact) => contact.roles.includes("registrant"));
		expect(registrant?.name).toBeNull();
		expect(isRedacted(built.data, "registrant.name")).toBe(true);
		expect(built.data.registrar).toEqual({
			name: "Example Registrar Inc.",
			ianaId: "1",
			abuseEmail: "abuse@organization.example",
		});
	});
});
