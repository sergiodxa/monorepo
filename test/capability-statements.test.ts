/**
 * Repo-wide guard against a capability helper called as a statement: `scope("x");` reads
 * like a permission check, compiles, and authorizes nothing, since the helper answers with
 * a boolean and never throws. Lint accepts the shape, so the call form is checked here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { CAPABILITY_BYPASS_REASON, findBareCapabilityStatements } from "./capability-statements";

/** Repo root, resolved from this file so the scan behaves the same from any working directory. */
const ROOT = join(import.meta.dirname, "..");

/** First-party directories walked by the scan below. */
const SCANNED = ["apps", "packages"];

describe("capability helpers called as statements, repo-wide", () => {
	describe("the scanner itself", () => {
		test("catches a dropped answer and reports the line it sits on", () => {
			let source = ["export function destroy() {", '\tscope("monitors:write");', "}"].join("\n");

			let violations = findBareCapabilityStatements("fixture.ts", source);

			expect(violations).toHaveLength(1);
			expect(violations[0]?.line).toBe(2);
			expect(violations[0]?.name).toBe("scope");
			expect(violations[0]?.source).toBe('scope("monitors:write");');
		});

		test("catches each capability helper by name", () => {
			let source = ['scope("x");', 'authenticated("5m");', "authenticated();", "mfa();"].join("\n");

			expect(findBareCapabilityStatements("fixture.ts", source).map((found) => found.name)).toEqual(
				["scope", "authenticated", "authenticated", "mfa"],
			);
		});

		test("catches a dropped answer nested inside a branch and a handler", () => {
			let source = [
				"export const controller = createController(routes.app.settings, {",
				"\tactions: {",
				"\t\tasync action(ctx) {",
				"\t\t\tif (ctx.request.method === 'POST') mfa();",
				"\t\t\treturn handleDeletion(ctx);",
				"\t\t},",
				"\t},",
				"});",
			].join("\n");

			let violations = findBareCapabilityStatements("fixture.ts", source);

			expect(violations).toHaveLength(1);
			expect(violations[0]?.line).toBe(4);
		});

		test("catches an answer dropped through a wrapper that passes it along untouched", () => {
			let source = ['(scope("x"));', 'scope("y") as boolean;', "mfa()!;"].join("\n");

			expect(findBareCapabilityStatements("fixture.ts", source)).toHaveLength(3);
		});

		test("accepts an answer that flows into a branch, a value or a view", () => {
			let source = [
				'if (!scope("monitors:write")) throw redirect(href("/forbidden"));',
				"let recent = authenticated('5m');",
				"let allowed = mfa() && recent;",
				'return Response.json({ granted: scope("monitors:read") });',
			].join("\n");

			expect(findBareCapabilityStatements("fixture.ts", source)).toEqual([]);
		});

		test("accepts a capability answer returned from a view's expression body", () => {
			let source = 'let DeleteAction = () => (scope("monitors:write") ? <DeleteForm /> : null);';

			expect(findBareCapabilityStatements("fixture.tsx", source)).toEqual([]);
		});

		/**
		 * The distinction the guard has to get right: an identity helper answers "nobody is
		 * here" with a thrown redirect, so a statement of one is the whole guard and the
		 * only way to write it.
		 */
		test("accepts a statement of an identity helper, which throws the redirect itself", () => {
			let source = ["currentSession();", "anonymous();", "subject();"].join("\n");

			expect(findBareCapabilityStatements("fixture.ts", source)).toEqual([]);
		});

		/**
		 * `scope` is also the name of the service container's per-request scope, whose whole
		 * purpose is to run work and be dropped as a statement.
		 */
		test("accepts a method call sharing a guarded name", () => {
			let source = [
				"await container.scope(async () => {",
				"\treturn await router.fetch(request);",
				"});",
				"policy.mfa(idToken);",
			].join("\n");

			expect(findBareCapabilityStatements("fixture.ts", source)).toEqual([]);
		});

		test("accepts the call form appearing in a comment or a string", () => {
			let source = [
				"/**",
				' * A bare `scope("x");` authorizes nothing.',
				" */",
				"let advice = 'never write scope(\"x\"); on its own';",
				"// mfa();",
			].join("\n");

			expect(findBareCapabilityStatements("fixture.ts", source)).toEqual([]);
		});

		/**
		 * A `.ts` module read as TSX loses every generic arrow function to an unclosed tag,
		 * and the recovered tree hides whatever follows.
		 */
		test("reads a module whose generic arrow functions parse only as TypeScript", () => {
			let source = [
				"let identity = <value>(input: value): value => input;",
				'scope("monitors:write");',
			].join("\n");

			let violations = findBareCapabilityStatements("fixture.ts", source);

			expect(violations).toHaveLength(1);
			expect(violations[0]?.line).toBe(2);
		});
	});

	/**
	 * Test files are scanned too: a route in one gets the same helpers and bypass. The guard
	 * matches names, so an app re-exports them under those names, and the file floor catches
	 * a rename that slips past. Walking every module costs about a second, hence the timeout.
	 */
	test("no first-party module calls a capability helper as a statement", () => {
		let violations: string[] = [];
		let scanned = 0;

		for (let area of SCANNED) {
			for (let file of globSync("**/*.{ts,tsx}", { cwd: join(ROOT, area) })) {
				let path = `${area}/${file}`;
				if (path.includes("/node_modules/")) continue;

				scanned++;
				for (let found of findBareCapabilityStatements(
					path,
					readFileSync(join(ROOT, path), "utf8"),
				)) {
					violations.push(`${found.file}:${found.line} ${found.source}`);
				}
			}
		}

		expect(scanned).toBeGreaterThan(4000);
		expect(violations, CAPABILITY_BYPASS_REASON).toEqual([]);
	}, 60_000);
});
