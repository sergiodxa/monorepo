/**
 * Tests for translating filters into `remix/data-table` predicates: each operator's
 * mapping, `not` pushed down to inverse operators, and every filter that must fall back to
 * in-memory evaluation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { and, eq, gt, gte, ilike, isNull, like, lt, lte, ne, notNull, or } from "remix/data-table";
import { describe, expect, test } from "vitest";

import type { ColumnMap } from "./data-table.js";

import { filterToWhere, UntranslatableFilterError } from "./data-table.js";
import { parseFilter } from "./filter.js";

const COLUMNS: ColumnMap = {
	displayName: { column: "display_name", caseExact: false },
	externalId: "external_id",
	"meta.created": "created_at",
	memberCount: "member_count",
	active: "active",
};

/**
 * Translates filter text, failing the test on error.
 *
 * @param text - The filter
 * @returns The predicate
 */
function where(text: string) {
	return unwrap(filterToWhere(unwrap(parseFilter(text)), COLUMNS));
}

/**
 * Translates filter text that must fail, returning the error.
 *
 * @param text - The filter
 * @returns The error
 */
function refuse(text: string): Error {
	let result = filterToWhere(unwrap(parseFilter(text)), COLUMNS);
	if (!isFailure(result)) return expect.unreachable("expected the translation to fail");
	return result.error;
}

describe("filterToWhere", () => {
	test("maps comparisons on case-sensitive columns to the same operators", () => {
		expect(where('externalId eq "abc"')).toEqual(eq("external_id", "abc"));
		expect(where("memberCount gt 1")).toEqual(gt("member_count", 1));
		expect(where("memberCount ge 1")).toEqual(gte("member_count", 1));
		expect(where("memberCount lt 1")).toEqual(lt("member_count", 1));
		expect(where("memberCount le 1")).toEqual(lte("member_count", 1));
		expect(where("active eq true")).toEqual(eq("active", true));
	});

	test("lets ne match NULL, as SCIM ne holds for an unassigned attribute", () => {
		expect(where('externalId ne "abc"')).toEqual(
			or(ne("external_id", "abc"), isNull("external_id")),
		);
	});

	test("folds case with ilike on caseExact false columns", () => {
		expect(where('displayName eq "Sales"')).toEqual(ilike("display_name", "Sales"));
		expect(where('DISPLAYNAME co "ale"')).toEqual(ilike("display_name", "%ale%"));
		expect(where('displayName sw "Sa"')).toEqual(ilike("display_name", "Sa%"));
		expect(where('displayName ew "es"')).toEqual(ilike("display_name", "%es"));
		expect(where('externalId co "b"')).toEqual(like("external_id", "%b%"));
	});

	test("maps pr, null comparisons, and and/or", () => {
		expect(where("externalId pr")).toEqual(notNull("external_id"));
		expect(where("externalId eq null")).toEqual(isNull("external_id"));
		expect(where('externalId pr and (displayName eq "a" or memberCount gt 2)')).toEqual(
			and(notNull("external_id"), or(ilike("display_name", "a"), gt("member_count", 2))),
		);
	});

	test("pushes not down to inverse operators by De Morgan's laws", () => {
		expect(where('not (externalId eq "a")')).toEqual(
			or(ne("external_id", "a"), isNull("external_id")),
		);
		expect(where('not (externalId ne "a")')).toEqual(eq("external_id", "a"));
		expect(where("not (externalId pr)")).toEqual(isNull("external_id"));
		expect(where("not (memberCount gt 2)")).toEqual(
			or(lte("member_count", 2), isNull("member_count")),
		);
		expect(where('not (externalId pr and externalId eq "a")')).toEqual(
			or(isNull("external_id"), or(ne("external_id", "a"), isNull("external_id"))),
		);
		expect(where("not (not (externalId pr))")).toEqual(notNull("external_id"));
	});

	test("matches fully qualified paths against unqualified columns", () => {
		expect(where('urn:ietf:params:scim:schemas:core:2.0:Group:externalId eq "a"')).toEqual(
			eq("external_id", "a"),
		);
		expect(where('meta.created gt "2020-01-01T00:00:00Z"')).toEqual(
			gt("created_at", "2020-01-01T00:00:00Z"),
		);
	});

	test.each([
		['members[value eq "a"]', "a value path"],
		['userName eq "a"', "an unmapped path"],
		['not (displayName co "a")', "a negated substring match"],
		['displayName ne "a"', "a case-folded ne"],
		['displayName gt "a"', "case-folded ordering"],
		['externalId co "50%"', "a LIKE wildcard"],
		['displayName eq "a_b"', "a LIKE wildcard in a folded eq"],
	])("leaves %s (%s) to in-memory evaluation", (text) => {
		expect(refuse(text)).toBeInstanceOf(UntranslatableFilterError);
	});

	test.each([
		["active gt true", "ordering a boolean"],
		["memberCount co 1", "a substring match on a number"],
		["externalId gt null", "ordering against null"],
	])("refuses %s (%s) as invalidFilter", (text) => {
		let error = refuse(text);
		expect(error).not.toBeInstanceOf(UntranslatableFilterError);
		expect(error).toMatchObject({ status: 400, scimType: "invalidFilter" });
	});
});
