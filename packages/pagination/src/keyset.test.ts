/**
 * Tests for keyset ordering rules and seek predicates.
 *
 * An ordering without a unique tiebreaker skips or repeats rows silently, so the
 * refusal is tested as carefully as the predicate. The predicate itself is asserted
 * as a structure, because a `>` on the first key alone is the classic wrong answer
 * and reads identically at a glance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@pkg/result";
import { describe, expect, test } from "vitest";

import { InvalidCursorError, InvalidOrderingError } from "./errors";
import {
	buildSeekPredicate,
	readOrderingValue,
	reverseOrdering,
	validateOrdering,
	zipSeekKeys,
} from "./keyset";

describe("validateOrdering", () => {
	test("accepts a sort key followed by a tiebreaker", () => {
		let result = validateOrdering(
			[
				["created_at", "desc"],
				["id", "desc"],
			],
			false,
		);

		expect(isSuccess(result)).toBe(true);
	});

	test("rejects a single non-unique sort key", () => {
		let result = validateOrdering([["created_at", "desc"]], false);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(InvalidOrderingError);
			expect(result.error.message).toContain("tiebreaker");
		}
	});

	test("accepts a single sort key the caller declares unique", () => {
		expect(isSuccess(validateOrdering([["id", "desc"]], true))).toBe(true);
	});

	test("rejects an empty ordering", () => {
		expect(isFailure(validateOrdering([], true))).toBe(true);
	});

	test("rejects a repeated column, which adds no tiebreaking", () => {
		let result = validateOrdering(
			[
				["id", "asc"],
				["id", "desc"],
			],
			false,
		);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("more than once");
	});

	test("rejects a blank column name", () => {
		expect(
			isFailure(
				validateOrdering(
					[
						["  ", "asc"],
						["id", "asc"],
					],
					false,
				),
			),
		).toBe(true);
	});
});

describe("zipSeekKeys", () => {
	test("pairs an ordering with the cursor's values", () => {
		let keys = unwrap(
			zipSeekKeys(
				[
					["created_at", "desc"],
					["id", "desc"],
				],
				["created_at", "id"],
				[1700, "evt_9"],
			),
		);

		expect(keys).toEqual([
			{ column: "created_at", direction: "desc", value: 1700 },
			{ column: "id", direction: "desc", value: "evt_9" },
		]);
	});

	test("rejects a cursor issued for a different ordering", () => {
		let result = zipSeekKeys(
			[
				["created_at", "desc"],
				["id", "desc"],
			],
			["updated_at", "id"],
			[1700, "evt_9"],
		);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(InvalidCursorError);
			expect(result.error.message).toContain("different ordering");
		}
	});

	test("rejects a cursor with a different number of keys", () => {
		let result = zipSeekKeys([["id", "desc"]], ["created_at", "id"], [1700, "evt_9"]);

		expect(isFailure(result)).toBe(true);
	});
});

describe("buildSeekPredicate", () => {
	test("compares one key directly, with no wrapping", () => {
		let predicate = buildSeekPredicate([{ column: "id", direction: "asc", value: 10 }], "after");

		expect(predicate).toEqual({
			type: "comparison",
			operator: "gt",
			column: "id",
			value: 10,
			valueType: "value",
		});
	});

	test("builds the lexicographic comparison over every key", () => {
		let predicate = buildSeekPredicate(
			[
				{ column: "created_at", direction: "desc", value: 1700 },
				{ column: "id", direction: "desc", value: "evt_9" },
			],
			"after",
		);

		expect(predicate).toEqual({
			type: "logical",
			operator: "or",
			predicates: [
				{
					type: "comparison",
					operator: "lt",
					column: "created_at",
					value: 1700,
					valueType: "value",
				},
				{
					type: "logical",
					operator: "and",
					predicates: [
						{
							type: "comparison",
							operator: "eq",
							column: "created_at",
							value: 1700,
							valueType: "value",
						},
						{
							type: "comparison",
							operator: "lt",
							column: "id",
							value: "evt_9",
							valueType: "value",
						},
					],
				},
			],
		});
	});

	test("inverts every operator when seeking backward", () => {
		let predicate = buildSeekPredicate([{ column: "id", direction: "asc", value: 10 }], "before");

		expect(predicate).toMatchObject({ operator: "lt" });
	});

	test("keeps a dotted string as a value, not as a column reference", () => {
		let predicate = buildSeekPredicate(
			[{ column: "hostname", direction: "asc", value: "a.b" }],
			"after",
		);

		expect(predicate).toMatchObject({ valueType: "value", value: "a.b" });
	});
});

describe("reverseOrdering", () => {
	test("flips every direction without reordering the keys", () => {
		expect(
			reverseOrdering([
				["created_at", "desc"],
				["id", "asc"],
			]),
		).toEqual([
			["created_at", "asc"],
			["id", "desc"],
		]);
	});
});

describe("readOrderingValue", () => {
	test("reads an unqualified column straight off the row", () => {
		expect(readOrderingValue({ id: 4 }, "id")).toBe(4);
	});

	test("falls back to the unqualified name for a qualified column", () => {
		expect(readOrderingValue({ created_at: 7 }, "pings.created_at")).toBe(7);
	});

	test("prefers an exact key over the unqualified fallback", () => {
		expect(readOrderingValue({ "pings.id": 1, id: 2 }, "pings.id")).toBe(1);
	});

	test("is undefined for a column the projection left out", () => {
		expect(readOrderingValue({ id: 1 }, "created_at")).toBeUndefined();
		expect(readOrderingValue(null, "id")).toBeUndefined();
	});
});
