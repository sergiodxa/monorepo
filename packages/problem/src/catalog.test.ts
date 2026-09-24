/**
 * Tests for catalogs: builders that fix each entry's type, status and title, a parser
 * that names the entry a response belongs to, and types outside the catalog accepted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, expectTypeOf, test } from "vitest";

import { defineProblems } from "./catalog.js";
import { problem } from "./problem.js";

const problems = defineProblems("https://docs.example.com/errors/", {
	notFound: { slug: "not-found", status: 404, title: "The resource does not exist" },
	outOfCredit: {
		slug: "out-of-credit",
		status: 403,
		title: "You do not have enough credit",
		extensions: s.object({ balance: s.number() }),
	},
});

describe("defineProblems", () => {
	test("a builder writes its entry's type, status and title", async () => {
		let response = problems.notFound({ detail: "No article has that slug." });

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			type: "https://docs.example.com/errors/not-found",
			title: "The resource does not exist",
			status: 404,
			detail: "No article has that slug.",
		});
	});

	test("a builder writes its typed extensions and passes headers through", async () => {
		let response = problems.outOfCredit(
			{ extensions: { balance: 30 } },
			{ headers: { "X-Trace": "abc" } },
		);

		expect(response.headers.get("X-Trace")).toBe("abc");
		expect(await response.json()).toMatchObject({ balance: 30, status: 403 });
	});

	test("parse names the entry and validates its extensions", async () => {
		let result = await problems.parse(problems.outOfCredit({ extensions: { balance: 30 } }));

		if (isFailure(result)) throw result.error;
		expect(result.data.name).toBe("outOfCredit");
		if (problems.is(result.data, "outOfCredit")) {
			expectTypeOf(result.data.extensions.balance).toEqualTypeOf<number>();
			expect(result.data.extensions.balance).toBe(30);
		}
	});

	test("a known type whose extensions fail the entry's schema is a failure", async () => {
		let response = problem({
			status: 403,
			type: "https://docs.example.com/errors/out-of-credit",
			extensions: { balance: "thirty" },
		});

		expect(isFailure(await problems.parse(response))).toBe(true);
	});

	test("a type outside the catalog parses with a null name", async () => {
		let result = await problems.parse(problem({ status: 500 }));

		expect(isSuccess(result) && result.data.name).toBeNull();
	});

	test("entries lists every entry with its resolved type, and the schema of one that has it", () => {
		let [notFound, outOfCredit] = problems.entries();

		expect(notFound).toEqual({
			name: "notFound",
			type: "https://docs.example.com/errors/not-found",
			status: 404,
			title: "The resource does not exist",
		});
		expect(outOfCredit).toEqual({
			name: "outOfCredit",
			type: "https://docs.example.com/errors/out-of-credit",
			status: 403,
			title: "You do not have enough credit",
			extensions: expect.anything(),
		});
		expect(outOfCredit?.extensions?.["~standard"].validate({ balance: 30 })).toEqual({
			value: { balance: 30 },
		});
	});

	test("the types hold the catalog's contract", () => {
		// @ts-expect-error -- an entry with a schema requires its extensions
		problems.outOfCredit();
		// @ts-expect-error -- extensions are typed by the entry's schema
		problems.outOfCredit({ extensions: { balance: "30" } });
		// @ts-expect-error -- the base must end in a slash
		defineProblems("https://docs.example.com/errors", {});
		// @ts-expect-error -- parse names a catalog method
		defineProblems("https://x.test/", { parse: { slug: "p", status: 400, title: "P" } });
	});
});
