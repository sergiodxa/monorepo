/**
 * Strict languages and introspection: a context lacking or mistyping what a
 * rule reads fails instead of answering a boolean, failures combine so operand
 * order never matters, and `paths` names every fact an expression reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { ExpressionError } from "./expression-error.js";

import { createLanguage } from "./language.js";
import { defineOperator } from "./operator.js";

/** A strict dialect with references, as an authorization rule set would use. */
const RULES = createLanguage({ strict: true, reference: "condition" });

/** The shared conditions the reference rows name. */
const CONDITIONS = {
	owner: { op: "eq", field: "article.authorId", path: "actor.id" },
	nested: { op: "all", of: [{ op: "always" }, { op: "condition", name: "owner" }] },
};

/** Parses, compiles and evaluates text in the strict dialect. */
function check(text: string, context: object): Result<boolean, ExpressionError> {
	let compiled = unwrap(RULES.compile(unwrap(RULES.parse(text)), { references: CONDITIONS }));
	return RULES.evaluate(compiled, context);
}

describe("strict evaluation", () => {
	test("fails on a missing right-hand path, naming it", () => {
		let answer = check("ctx.article.authorId == ctx.actor.id", { article: { authorId: "u_1" } });

		expect(answer).toMatchObject({
			status: "failure",
			error: { path: "path", missing: "actor.id", message: 'Context has no "actor.id"' },
		});
	});

	test("answers a boolean when every operand is there", () => {
		let context = { article: { authorId: "u_1" }, actor: { id: "u_1" } };

		expect(check("ctx.article.authorId == ctx.actor.id", context)).toEqual({
			status: "success",
			data: true,
		});
		expect(
			check("ctx.article.authorId == ctx.actor.id", { ...context, actor: { id: "u_2" } }),
		).toEqual({ status: "success", data: false });
	});

	test("fails a not over a missing path instead of answering true", () => {
		let answer = check("not ctx.article.authorId == ctx.actor.id", {
			article: { authorId: "u_1" },
		});

		expect(answer).toMatchObject({
			status: "failure",
			error: { path: "of.path", missing: "actor.id" },
		});
	});

	test("fails on a missing field with a literal", () => {
		expect(check("ctx.article.published == true", { article: {} })).toMatchObject({
			error: { path: "field", missing: "article.published" },
		});
	});

	test.each<[string, string, object, readonly [string, string]]>([
		["eq between a number and a boolean", "ctx.a == true", { a: 1 }, ["number", "boolean"]],
		["lt on a string", "ctx.a < 1", { a: "1" }, ["string", "number"]],
		["eq between two mistyped paths", "ctx.a == ctx.b", { a: 1, b: "1" }, ["number", "string"]],
		["includes on a non-list", 'includes(ctx.a, "x")', { a: "x" }, ["string", "string"]],
		["in against a non-list", "ctx.a in ctx.b", { a: "x", b: "x" }, ["string", "string"]],
		["notIn against a non-list", "ctx.a not in ctx.b", { a: "x", b: "x" }, ["string", "string"]],
		["a field holding null against a literal", 'ctx.a == "x"', { a: null }, ["null", "string"]],
		["a Date against a number", "ctx.a < 1", { a: new Date(0) }, ["date", "number"]],
		["a pattern on a number", 'matches(ctx.a, "1")', { a: 1 }, ["number", "string"]],
	])("fails on a type mismatch: %s", (_, text, context, mismatch) => {
		expect(check(text, context)).toMatchObject({
			status: "failure",
			error: { path: "", mismatch },
		});
	});

	test("fails a path comparison holding null on either side", () => {
		expect(check("ctx.a == ctx.b", { a: null, b: null })).toMatchObject({
			error: { path: "field", mismatch: ["null", "null"] },
		});
		expect(check("ctx.a == ctx.b", { a: "x", b: null })).toMatchObject({
			error: { path: "path", mismatch: ["string", "null"] },
		});
	});

	test("keeps a literal null a comparison as written", () => {
		expect(check("ctx.deletedAt == null", { deletedAt: null })).toEqual(unwrapped(true));
		expect(check("ctx.deletedAt == null", { deletedAt: "2026-01-01" })).toEqual(unwrapped(false));
	});

	test("guards a comparison with exists, which reads absence itself", () => {
		expect(check("exists(ctx.a) and ctx.a == 1", {})).toEqual(unwrapped(false));
		expect(check("exists(ctx.a) and ctx.a == 1", { a: 1 })).toEqual(unwrapped(true));
		expect(check("not exists(ctx.a)", {})).toEqual(unwrapped(true));
	});

	test.each<[string, string, string, object, boolean | "failure"]>([
		[
			"or decided by a true member",
			"ctx.isAdmin == true",
			"ctx.authorId == ctx.actor.id",
			{ authorId: "u", actor: { id: "u" } },
			true,
		],
		[
			"or with no true member",
			"ctx.isAdmin == true",
			"ctx.authorId == ctx.actor.id",
			{ authorId: "u", actor: { id: "v" } },
			"failure",
		],
		[
			"and decided by a false member",
			"ctx.published == true",
			"ctx.authorId == ctx.actor.id",
			{ authorId: "u", actor: { id: "v" } },
			false,
		],
		[
			"and with no false member",
			"ctx.published == true",
			"ctx.authorId == ctx.actor.id",
			{ authorId: "u", actor: { id: "u" } },
			"failure",
		],
	])("answers alike with operands swapped: %s", (name, left, right, context, expected) => {
		let keyword = name.startsWith("or") ? "or" : "and";
		for (let text of [`${left} ${keyword} ${right}`, `${right} ${keyword} ${left}`]) {
			let answer = check(text, context);
			if (expected === "failure") expect(answer.status, text).toBe("failure");
			else expect(answer, text).toEqual(unwrapped(expected));
		}
	});

	test("names a failure inside a combination by its member", () => {
		expect(check("true and (ctx.a == 1 or ctx.b == 2)", { b: 3 })).toMatchObject({
			error: { path: "of.1.of.0.field", missing: "a" },
		});
	});

	test("reports a failure inside a reference at the reference node, caused by the inner one", () => {
		let answer = check('true and condition("nested")', { article: { authorId: "u_1" } });

		expect(answer).toMatchObject({ error: { path: "of.1", missing: "actor.id" } });
		let cause = answer.status === "failure" ? answer.error.cause : undefined;
		expect(cause).toMatchObject({ path: "of.1", missing: "actor.id" });
		expect((cause as ExpressionError).cause).toMatchObject({ path: "path", missing: "actor.id" });
	});

	test("fails an extension operator on a missing field and answers its test otherwise", () => {
		let even = defineOperator({
			op: "even",
			args: ["field"],
			schema: s.object({}),
			test: (value) => typeof value === "number" && value % 2 === 0,
		});
		let numbers = createLanguage({ strict: true, operators: [even] });
		let compiled = unwrap(numbers.compile({ op: "even", field: "n" }));

		expect(numbers.evaluate(compiled, {})).toMatchObject({ error: { missing: "n" } });
		expect(numbers.evaluate(compiled, { n: "2" })).toEqual(unwrapped(false));
		expect(numbers.evaluate(compiled, { n: 2 })).toEqual(unwrapped(true));
	});

	test("reads an interface-typed context with nested Dates and optional fields", () => {
		interface Article {
			authorId: string;
			publishedAt: Date;
			editorId?: string;
		}
		interface Facts {
			article: Article;
			actor: { id: string; since: Date };
		}
		let facts: Facts = {
			article: { authorId: "u_1", publishedAt: new Date("2026-01-02") },
			actor: { id: "u_1", since: new Date("2026-01-01") },
		};

		expect(check("ctx.article.publishedAt > ctx.actor.since", facts)).toEqual(unwrapped(true));
		expect(check("ctx.article.editorId == ctx.actor.id", facts)).toMatchObject({
			error: { missing: "article.editorId" },
		});
	});
});

describe("lenient evaluation", () => {
	test("answers false where a strict language fails", () => {
		let lenient = createLanguage();
		let compiled = unwrap(lenient.compile(unwrap(lenient.parse("ctx.a == ctx.b"))));

		expect(lenient.evaluate(compiled, { a: 1 })).toBe(false);
		expect(lenient.evaluate(compiled, { a: 1, b: "1" })).toBe(false);
	});
});

describe("paths", () => {
	test("names every field and compared path, through references", () => {
		let compiled = unwrap(
			RULES.compile(
				unwrap(
					RULES.parse(
						'condition("owner") or (exists(ctx.beta) and ctx.plan.tier in ["pro"] and includes(ctx.a, ctx.b))',
					),
				),
				{ references: CONDITIONS },
			),
		);

		expect(RULES.paths(compiled)).toEqual(
			new Set(["article.authorId", "actor.id", "beta", "plan.tier", "a", "b"]),
		);
	});

	test("names an extension operator's field and leaves its own fields alone", () => {
		let named = defineOperator({
			op: "named",
			args: ["field", "path"],
			schema: s.object({ path: s.string() }),
			test: () => true,
		});
		let language = createLanguage({ operators: [named] });

		expect(
			language.paths(unwrap(language.compile({ op: "named", field: "a", path: "b" }))),
		).toEqual(new Set(["a"]));
	});

	test("names nothing for an expression reading no context", () => {
		expect(RULES.paths(unwrap(RULES.compile({ op: "always" })))).toEqual(new Set());
	});
});

describe("types", () => {
	test("answers a Result in a strict language and a boolean in a lenient one", () => {
		let lenient = createLanguage();
		let strict = createLanguage({ strict: true });

		expectTypeOf<ReturnType<typeof lenient.evaluate>>().toEqualTypeOf<boolean>();
		expectTypeOf<ReturnType<typeof strict.evaluate>>().toEqualTypeOf<
			Result<boolean, ExpressionError>
		>();
		expectTypeOf<ReturnType<typeof strict.paths>>().toEqualTypeOf<ReadonlySet<string>>();
	});
});

/** The success a strict evaluation answers with a boolean. */
function unwrapped(data: boolean): Result<boolean, ExpressionError> {
	return { status: "success", data };
}
