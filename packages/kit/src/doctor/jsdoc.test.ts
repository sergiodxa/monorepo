/**
 * The `jsdoc` check over fixture apps: JSDoc within three description lines passes, a `//` or
 * plain block comment warns, a long description or a multi-line `@param` warns, and tooling
 * directives are left alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vite-plus/test";

import { fixture, removeFixtures } from "./fixture.js";
import { inspectComments, isJsdoc, isToolingDirective, jsdocCheck } from "./jsdoc.js";

afterEach(removeFixtures);

describe("jsdocCheck", () => {
	test("passes an app whose comments are JSDoc within three description lines", async () => {
		let context = await fixture({
			"app/models/posts.ts": `/**
 * Posts the board lists.
 *
 * @param id - The row to load.
 * @returns The post, or null when it is gone.
 */
export function load(id: string) {
	return id;
}
`,
		});

		expect((await jsdocCheck.run(context)).status).toBe("pass");
	});

	test("warns on non-JSDoc comments, long descriptions, banned tags and multi-line one-liners", async () => {
		let context = await fixture({
			"app/services/run.ts": `/**
 * One.
 * Two.
 * Three.
 * Four.
 *
 * @description Extra prose.
 * @param id - A value that needs
 * more than one line.
 * @returns The answer that also
 * wraps.
 */
export function run(id: string) {
	// why this branch
	return id;
}
`,
			"app/models/note.ts": `export const note = 1; /* aside */\n`,
		});

		let result = await jsdocCheck.run(context);

		expect(result.status).toBe("warn");
		expect(result.findings).toEqual([
			"app/models/note.ts:1: /* … */ comment; write JSDoc (/** … */) or a tooling directive",
			"app/services/run.ts:1: description has 4 lines; keep it to 3",
			"app/services/run.ts:1: @description is not allowed; put the prose before the tags",
			"app/services/run.ts:1: @param spans 2 lines; keep it on one line",
			"app/services/run.ts:1: @returns spans 2 lines; keep it on one line",
			"app/services/run.ts:14: // comment; write JSDoc (/** … */) or a tooling directive",
		]);
	});

	test("leaves tooling directives and shebangs alone", async () => {
		let context = await fixture({
			"app/commands/run.ts": `#!/usr/bin/env bun
// @ts-expect-error -- binding is injected
// oxlint-disable-next-line no-control-regex -- ESC sequence
/*#__PURE__*/
/// <reference types="bun" />
/** Runs the command. */
export function run() {}
`,
		});

		expect((await jsdocCheck.run(context)).status).toBe("pass");
	});

	test("skips a project with no app source", async () => {
		expect((await jsdocCheck.run(await fixture({}))).status).toBe("skip");
	});

	test("ignores comments inside strings and template literals", async () => {
		let context = await fixture({
			"app/services/css.ts": `/** Styles the band. */
export const css = \`
  /* not a source comment */
  // neither is this
\`;
`,
		});

		expect((await jsdocCheck.run(context)).status).toBe("pass");
	});
});

describe("inspectComments", () => {
	test("counts only non-empty description lines toward the budget", () => {
		let findings = inspectComments(
			"a.ts",
			`/**
 * One.
 *
 * Two.
 *
 * Three.
 *
 * @author someone
 */
export const x = 1;
`,
		);
		expect(findings).toEqual([]);
	});

	test("leaves @example free to span lines", () => {
		let findings = inspectComments(
			"a.ts",
			`/**
 * Greets.
 * @example
 * greet("Ada");
 * greet("Bob");
 */
export function greet(name: string) {
	return name;
}
`,
		);
		expect(findings).toEqual([]);
	});
});

describe("isJsdoc", () => {
	test("recognises only the double-star opener", () => {
		expect(isJsdoc("/** ok */")).toBe(true);
		expect(isJsdoc("/* no */")).toBe(false);
		expect(isJsdoc("// no")).toBe(false);
	});
});

describe("isToolingDirective", () => {
	test("matches the directives the repository allows", () => {
		expect(isToolingDirective("// @ts-expect-error -- reason")).toBe(true);
		expect(isToolingDirective("// oxlint-disable-next-line foo -- bar")).toBe(true);
		expect(isToolingDirective("/*#__PURE__*/")).toBe(true);
		expect(isToolingDirective('/// <reference types="bun" />')).toBe(true);
		expect(isToolingDirective("// a note")).toBe(false);
	});
});
