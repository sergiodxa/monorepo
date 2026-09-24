/**
 * Tests for the filter grammar: every filter RFC 7644 §3.4.2.2 prints parses, writes back
 * to text that parses to the same tree, and evaluates as the RFC describes against the
 * RFC 7643 §8 example resources.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Filter } from "./filter.js";

import { ENTERPRISE_USER_DEFINITION, GROUP_DEFINITION, USER_DEFINITION } from "./discovery.js";
import { compileFilter, parseFilter, parsePath, stringifyFilter } from "./filter.js";
import { ENTERPRISE_USER, FULL_USER, GROUP } from "./fixtures/rfc7643-users.js";

const DEFINITIONS = {
	[USER_DEFINITION.id]: USER_DEFINITION,
	[ENTERPRISE_USER_DEFINITION.id]: ENTERPRISE_USER_DEFINITION,
};

/** The filters RFC 7644 §3.4.2.2 lists, with whether each matches `FULL_USER`. */
const RFC_FILTERS: [string, boolean][] = [
	['userName eq "bjensen"', false],
	['name.familyName co "O\'Malley"', false],
	['userName sw "J"', false],
	['urn:ietf:params:scim:schemas:core:2.0:User:userName sw "J"', false],
	["title pr", true],
	['meta.lastModified gt "2011-05-13T04:42:34Z"', false],
	['meta.lastModified ge "2011-05-13T04:42:34Z"', true],
	['meta.lastModified lt "2011-05-13T04:42:34Z"', false],
	['meta.lastModified le "2011-05-13T04:42:34Z"', true],
	['title pr and userType eq "Employee"', true],
	['title pr or userType eq "Intern"', true],
	['schemas eq "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"', false],
	['userType eq "Employee" and (emails co "example.com" or emails.value co "example.org")', true],
	[
		'userType ne "Employee" and not (emails co "example.com" or emails.value co "example.org")',
		false,
	],
	['userType eq "Employee" and (emails.type eq "work")', true],
	['userType eq "Employee" and emails[type eq "work" and value co "@example.com"]', true],
	[
		'emails[type eq "work" and value co "@example.com"] or ims[type eq "xmpp" and value co "@foo.com"]',
		true,
	],
	['userName Eq "john"', false],
	['Username eq "john"', false],
];

/**
 * A path with no URN and no sub-attribute.
 *
 * @param attribute - The attribute name
 * @param subAttribute - The sub-attribute, when any
 * @returns The path
 */
function path(attribute: string, subAttribute: string | null = null): Filter.AttributePath {
	return { schema: null, attribute, subAttribute };
}

/**
 * Parses and compiles a filter against the User definitions, failing the test on error.
 *
 * @param text - The filter
 * @param allow - An optional allow list
 * @returns The predicate
 */
function compile(text: string, allow?: string[]): (resource: object) => boolean {
	return unwrap(compileFilter(unwrap(parseFilter(text)), { definitions: DEFINITIONS, allow }));
}

describe("parseFilter", () => {
	test.each(RFC_FILTERS)("parses and round-trips the RFC 7644 example %s", (text) => {
		let parsed = unwrap(parseFilter(text));
		expect(unwrap(parseFilter(stringifyFilter(parsed)))).toEqual(parsed);
	});

	test("reads a comparison into path, operator and value", () => {
		expect(unwrap(parseFilter('userName eq "bjensen"'))).toEqual({
			kind: "compare",
			path: path("userName"),
			operator: "eq",
			value: "bjensen",
		});
	});

	test("keeps the URN of a fully qualified path", () => {
		expect(
			unwrap(parseFilter('urn:ietf:params:scim:schemas:core:2.0:User:userName sw "J"')),
		).toEqual({
			kind: "compare",
			path: {
				schema: "urn:ietf:params:scim:schemas:core:2.0:User",
				attribute: "userName",
				subAttribute: null,
			},
			operator: "sw",
			value: "J",
		});
	});

	test("lowercases operators whatever case the client wrote", () => {
		expect(unwrap(parseFilter('userName Eq "john"'))).toMatchObject({ operator: "eq" });
		expect(unwrap(parseFilter("title PR"))).toEqual({ kind: "present", path: path("title") });
	});

	test("binds not over and over or, associating left", () => {
		expect(unwrap(parseFilter("a pr or b pr and c pr"))).toEqual({
			kind: "or",
			left: { kind: "present", path: path("a") },
			right: {
				kind: "and",
				left: { kind: "present", path: path("b") },
				right: { kind: "present", path: path("c") },
			},
		});
		expect(unwrap(parseFilter("a pr and b pr and c pr"))).toMatchObject({
			kind: "and",
			left: { kind: "and" },
			right: { kind: "present" },
		});
	});

	test("reads the negated group and the value paths of the RFC examples", () => {
		expect(
			unwrap(
				parseFilter(
					'userType ne "Employee" and not (emails co "example.com" or emails.value co "example.org")',
				),
			),
		).toEqual({
			kind: "and",
			left: { kind: "compare", path: path("userType"), operator: "ne", value: "Employee" },
			right: {
				kind: "not",
				expression: {
					kind: "or",
					left: { kind: "compare", path: path("emails"), operator: "co", value: "example.com" },
					right: {
						kind: "compare",
						path: path("emails", "value"),
						operator: "co",
						value: "example.org",
					},
				},
			},
		});
		expect(unwrap(parseFilter('emails[type eq "work" and value co "@example.com"]'))).toEqual({
			kind: "valuePath",
			path: path("emails"),
			filter: {
				kind: "and",
				left: { kind: "compare", path: path("type"), operator: "eq", value: "work" },
				right: { kind: "compare", path: path("value"), operator: "co", value: "@example.com" },
			},
		});
	});

	test("reads numbers, booleans, null and string escapes", () => {
		expect(unwrap(parseFilter("age ge -1.5e2"))).toMatchObject({ value: -150 });
		expect(unwrap(parseFilter("active eq True"))).toMatchObject({ value: true });
		expect(unwrap(parseFilter("active eq false"))).toMatchObject({ value: false });
		expect(unwrap(parseFilter("title eq null"))).toMatchObject({ value: null });
		expect(unwrap(parseFilter('title eq "a \\"quoted\\" \\u00e9"'))).toMatchObject({
			value: 'a "quoted" é',
		});
	});

	test("accepts $ref and not as attribute names", () => {
		expect(unwrap(parseFilter("members.$ref pr"))).toEqual({
			kind: "present",
			path: path("members", "$ref"),
		});
		expect(unwrap(parseFilter("not pr"))).toEqual({ kind: "present", path: path("not") });
	});

	test.each([
		[
			"(meta.resourceType eq User) or (meta.resourceType eq Group)",
			"unquoted value from the RFC 7644 §3.4.2.2 text",
		],
		['userName eq "bjensen', "unterminated string"],
		['userName is "bjensen"', "unknown operator"],
		["userName eq", "missing value"],
		['userName eq "a" "b"', "trailing token"],
		['userName eq "a" and', "dangling and"],
		['(userName eq "a"', "unclosed group"],
		['emails[type eq "work"', "unclosed value path"],
		['emails[type[value eq "x"]]', "nested value path"],
		['emails.value[type eq "work"]', "value path on a sub-attribute"],
		['not userName eq "a"', "not without parentheses"],
		['a.b.c eq "x"', "too many sub-attributes"],
		['1abc eq "x"', "attribute starting with a digit"],
		['title eq "\\x"', "invalid escape"],
		["", "empty filter"],
	])("refuses %s (%s) as invalidFilter", (text) => {
		let result = parseFilter(text);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.status).toBe(400);
			expect(result.error.scimType).toBe("invalidFilter");
		}
	});
});

describe("parsePath", () => {
	test("reads plain, sub-attribute and fully qualified paths", () => {
		expect(unwrap(parsePath("userName"))).toEqual(path("userName"));
		expect(unwrap(parsePath("name.familyName"))).toEqual(path("name", "familyName"));
		expect(
			unwrap(parsePath("urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:manager.value")),
		).toEqual({
			schema: "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
			attribute: "manager",
			subAttribute: "value",
		});
	});

	test("refuses anything else as invalidPath", () => {
		let result = parsePath('emails[type eq "work"]');
		expect(isFailure(result) && result.error.scimType).toBe("invalidPath");
		expect(isFailure(parsePath("notaurn:userName"))).toBe(true);
	});
});

describe("stringifyFilter", () => {
	test("parenthesizes only where precedence needs it", () => {
		let text =
			'userType eq "Employee" and (emails co "example.com" or emails.value co "example.org")';
		expect(stringifyFilter(unwrap(parseFilter(text)))).toBe(text);
		expect(stringifyFilter(unwrap(parseFilter("a pr or (b pr or c pr)")))).toBe(
			"a pr or (b pr or c pr)",
		);
		expect(stringifyFilter(unwrap(parseFilter("(a pr or b pr) or c pr")))).toBe(
			"a pr or b pr or c pr",
		);
	});
});

describe("compileFilter", () => {
	test.each(RFC_FILTERS)(
		"evaluates the RFC 7644 example %s against the RFC 7643 user",
		(text, expected) => {
			expect(compile(text)(FULL_USER)).toBe(expected);
		},
	);

	test("matches the enterprise schema through schemas and qualified extension paths", () => {
		expect(
			compile('schemas eq "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"')(
				ENTERPRISE_USER,
			),
		).toBe(true);
		expect(
			compile(
				'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:manager.displayName eq "john smith"',
			)(ENTERPRISE_USER),
		).toBe(true);
		expect(compile('department eq "Tour Operations"')(ENTERPRISE_USER)).toBe(true);
	});

	test("folds case for caseExact false attributes and keeps it for caseExact true ones", () => {
		expect(compile('userName eq "BJensen@Example.com"')(FULL_USER)).toBe(true);
		expect(compile('USERNAME eq "bjensen@example.com"')(FULL_USER)).toBe(true);
		expect(compile('id eq "2819C223-7F76-453A-919D-413861904646"')(FULL_USER)).toBe(false);
		expect(compile('id eq "2819c223-7f76-453a-919d-413861904646"')(FULL_USER)).toBe(true);
		expect(compile('x509Certificates.value sw "miid"')(FULL_USER)).toBe(false);
	});

	test("reads attribute names on the resource case-insensitively", () => {
		expect(compile('userName eq "ana"')({ UserName: "Ana" })).toBe(true);
	});

	test("compares date-times as instants", () => {
		expect(compile('meta.lastModified eq "2011-05-13T06:42:34+02:00"')(FULL_USER)).toBe(true);
		expect(compile('meta.created lt "2010-01-23T05:00:00Z"')(FULL_USER)).toBe(true);
	});

	test("matches a multi-valued attribute when any value matches", () => {
		expect(compile('emails.value eq "babs@jensen.org"')(FULL_USER)).toBe(true);
		expect(compile('emails.type eq "other"')(FULL_USER)).toBe(false);
		expect(compile('emails[type eq "home" and value co "example.com"]')(FULL_USER)).toBe(false);
	});

	test("treats an unassigned attribute as matching only ne and eq null", () => {
		let resource = { userName: "a" };
		expect(compile('nickName eq "x"')(resource)).toBe(false);
		expect(compile('nickName ne "x"')(resource)).toBe(true);
		expect(compile("nickName eq null")(resource)).toBe(true);
		expect(compile("userName ne null")(resource)).toBe(true);
		expect(compile("nickName pr")({ nickName: "" })).toBe(false);
	});

	test("compares booleans with eq and ne", () => {
		expect(compile("active eq true")(FULL_USER)).toBe(true);
		expect(compile("active ne true")(FULL_USER)).toBe(false);
	});

	test("filters groups by caseExact false displayName and member value", () => {
		let groups = { [GROUP_DEFINITION.id]: GROUP_DEFINITION };
		let matches = unwrap(
			compileFilter(unwrap(parseFilter('displayName eq "tour guides"')), { definitions: groups }),
		);
		expect(matches(GROUP)).toBe(true);
		let member = unwrap(
			compileFilter(
				unwrap(parseFilter('members[value eq "902c246b-6245-4190-8e05-00816be7344a"]')),
				{
					definitions: groups,
				},
			),
		);
		expect(member(GROUP)).toBe(true);
	});

	test.each([
		["active gt true", "ordering a boolean"],
		['x509Certificates.value gt "a"', "ordering binary"],
		['active eq "true"', "a string against a boolean"],
		['meta.created gt "yesterday"', "an unparseable date-time"],
		['name eq "Barbara"', "a complex attribute without value"],
		['unknown eq "x"', "an undefined attribute"],
		['urn:example:unknown:Schema:userName eq "x"', "an undefined schema"],
		['emails[unknown eq "x"]', "an undefined sub-attribute"],
		['userName[value eq "x"]', "a value path on a single-valued string"],
		["title gt null", "ordering against null"],
	])("refuses %s (%s) as invalidFilter", (text) => {
		let result = compileFilter(unwrap(parseFilter(text)), { definitions: DEFINITIONS });
		expect(isFailure(result) && result.error.scimType).toBe("invalidFilter");
	});

	test("refuses paths outside the allow list, qualified or not", () => {
		let allow = ["userName", "externalId", "emails.value"];
		expect(
			isSuccess(
				compileFilter(unwrap(parseFilter('userName eq "a"')), { definitions: DEFINITIONS, allow }),
			),
		).toBe(true);
		expect(
			isSuccess(
				compileFilter(
					unwrap(parseFilter('urn:ietf:params:scim:schemas:core:2.0:User:username eq "a"')),
					{
						definitions: DEFINITIONS,
						allow,
					},
				),
			),
		).toBe(true);
		expect(compile('emails co "example.com"', allow)(FULL_USER)).toBe(true);
		expect(compile('emails[value eq "babs@jensen.org"]', allow)(FULL_USER)).toBe(true);
		for (let text of ['displayName eq "a"', 'emails[type eq "work"]', "title pr"]) {
			let result = compileFilter(unwrap(parseFilter(text)), { definitions: DEFINITIONS, allow });
			expect(isFailure(result) && result.error.scimType).toBe("invalidFilter");
		}
	});
});
