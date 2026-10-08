/**
 * Tests every mistake compiling a policy refuses, each named by the grant and
 * node at fault, and the catalog's own declaration checks and introspection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { PolicyDefinition } from "./compile.js";

import { abilities, ability, context } from "./catalog.js";
import { compilePolicy } from "./compile.js";
import { AuthzError } from "./decision.js";
import { allow, deny, fact } from "./grants.js";
import { definePolicy } from "./policy.js";

interface Article {
	authorId: string;
	locked: boolean;
}

const CATALOG = abilities({
	article: {
		read: ability({ context: context<{ article: Article }>("article") }),
		update: ability({
			context: context<{ article: Article }>("article"),
			fields: ["title", "body"],
		}),
	},
	reports: { export: ability({ metadata: { audience: "admin" } }) },
});

/** Compiles a definition, answering the error it fails with. */
function refusal(definition: PolicyDefinition): AuthzError {
	let compiled = compilePolicy(CATALOG, definition);
	if (isSuccess(compiled)) throw new Error("Expected the policy to fail compiling");
	return compiled.error;
}

describe("compiling a policy", () => {
	test("accepts a policy whose every name resolves", () => {
		let policy = definePolicy(CATALOG, {
			facts: { actor: fact<{ id: string }>({ optional: true }) },
			roles: {
				member: [
					allow("article.update", {
						when: {
							op: "all",
							of: [
								{ op: "exists", field: "actor" },
								{ op: "eq", field: "article.authorId", path: "actor.id" },
							],
						},
						fields: ["title"],
					}),
				],
			},
		});

		expect(isSuccess(policy.compile())).toBe(true);
	});

	test("refuses an ability the catalog does not have", () => {
		expect(refusal({ roles: { member: [allow("article.publish")] } })).toMatchObject({
			grant: "roles.member.0",
			message: '"article.publish" names nothing in the catalog',
		});
		expect(
			refusal({ roles: { member: [allow("article", { except: ["article.x"] })] } }).message,
		).toBe('except "article.x" names nothing in the catalog');
	});

	test("refuses a field some covered ability does not declare", () => {
		expect(refusal({ roles: { member: [allow("article", { fields: ["title"] })] } })).toMatchObject(
			{
				grant: "roles.member.0",
				path: "fields",
				message: 'article.read declares no field "title"',
			},
		);
	});

	test("refuses a condition naming an unknown condition, or cycling", () => {
		expect(
			refusal({ guards: [deny("reports.export", { when: { op: "condition", name: "nope" } })] }),
		).toMatchObject({ grant: "guards.0", path: "when", message: 'Unknown condition "nope"' });

		expect(
			refusal({
				conditions: {
					a: { op: "condition", name: "b" },
					b: { op: "condition", name: "a" },
				},
			}),
		).toMatchObject({ grant: "conditions.a" });
	});

	test("refuses a condition that does not compile, naming its node", () => {
		let error = refusal({
			roles: {
				member: [
					allow("article.read", {
						when: { op: "all", of: [{ op: "eq", field: "article.locked" }] } as never,
					}),
				],
			},
		});

		expect(error.grant).toBe("roles.member.0");
		expect(error.path).toMatch(/^when\.of\.0/);
	});

	test("refuses a root that is neither a fact nor in every covered ability's context", () => {
		expect(
			refusal({
				roles: {
					member: [allow("article", { when: { op: "eq", field: "team.id", value: "t1" } })],
				},
			}).message,
		).toBe('Reads "team.id", but "team" is neither a declared fact nor in article.read\'s context');

		expect(
			refusal({
				roles: {
					member: [allow("*", { when: { op: "eq", field: "article.locked", value: false } })],
				},
			}).message,
		).toMatch(/reports\.export's context/);
	});

	test("refuses an optional fact read without testing it first", () => {
		let error = refusal({
			facts: { actor: fact<{ id: string }>({ optional: true }) },
			roles: {
				member: [
					allow("article.read", {
						when: { op: "eq", field: "article.authorId", path: "actor.id" },
					}),
				],
			},
		});

		expect(error).toMatchObject({ grant: "roles.member.0", path: "when" });
		expect(error.message).toMatch(/optional fact "actor"/);
	});

	test("accepts an optional fact tested alone, or through a referenced condition", () => {
		let compiled = compilePolicy(CATALOG, {
			facts: { impersonator: fact<{ id: string }>({ optional: true }) },
			conditions: {
				impersonating: {
					op: "all",
					of: [
						{ op: "exists", field: "impersonator" },
						{ op: "ne", field: "impersonator.id", value: "" },
					],
				},
			},
			roles: { admin: [allow("*")] },
			guards: [
				deny("reports", { when: { op: "exists", field: "impersonator" } }),
				deny("article", { when: { op: "condition", name: "impersonating" } }),
			],
		});

		expect(isSuccess(compiled)).toBe(true);
	});

	test("refuses an unknown or cyclic inheritance", () => {
		expect(refusal({ roles: { editor: { inherits: ["member"], grants: [] } } }).message).toBe(
			'Role "editor" inherits "member", which does not exist',
		);
		expect(
			refusal({
				roles: {
					a: { inherits: ["b"], grants: [] },
					b: { inherits: ["a"], grants: [] },
				},
			}).message,
		).toBe("Role inheritance cycles: a → b → a");
	});

	test("refuses two grants sharing an id", () => {
		expect(
			refusal({
				roles: { member: [allow("article.read", { id: "read" })] },
				guards: [deny("article.read", { id: "read" })],
			}),
		).toMatchObject({ grant: "read", message: 'Two grants share the id "read"' });
	});

	test("refuses a deny inside a role and an allow among the guards", () => {
		expect(refusal({ roles: { member: [deny("article.read") as never] } }).message).toBe(
			"A deny grant cannot sit in roles and everyone",
		);
		expect(refusal({ guards: [allow("article.read") as never] }).message).toBe(
			"An allow grant cannot sit in guards",
		);
	});

	test("refuses a fact named like a context key", () => {
		expect(refusal({ facts: { article: fact<Article>() } }).message).toBe(
			'article.read\'s context key "article" is also a declared fact',
		);
	});

	test("fails a binding of a policy that does not compile", () => {
		let policy = definePolicy(CATALOG, { roles: { member: [allow("article.nope" as "article")] } });
		let bound = policy.for({ roles: ["member"] });

		expect(isFailure(bound) && bound.error).toBeInstanceOf(AuthzError);
	});
});

describe("declaring a catalog", () => {
	test("names abilities by their keys and lists them", () => {
		expect(CATALOG.article.update.name).toBe("article.update");
		expect(CATALOG.list().map((each) => each.name)).toEqual([
			"article.read",
			"article.update",
			"reports.export",
		]);
		expect(CATALOG.filter({ metadata: { audience: "admin" } })).toEqual([CATALOG.reports.export]);
	});

	test("refuses keys a name could not tell apart", () => {
		expect(() => abilities({ "a.b": ability() })).toThrow(TypeError);
		expect(() => abilities({ group: { "*": ability() } })).toThrow(TypeError);
		expect(() => abilities({ list: { x: ability() } })).toThrow(TypeError);
	});

	test("refuses a context naming a key twice", () => {
		expect(() => context<{ a: 1; b: 2 }>("a", "a" as "b")).toThrow(TypeError);
	});
});
