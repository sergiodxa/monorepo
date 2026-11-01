/**
 * The `translations` check over fixture apps: matching bundles pass, a key one language lacks
 * or adds warns, a message that is not MessageFormat 2 fails, and an app without bundles skips.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "./fixture.js";
import { translationsCheck } from "./translations.js";

afterEach(removeFixtures);

describe("translationsCheck", () => {
	test("passes when every language has the default language's keys, imported sub-bundles included", async () => {
		let context = await fixture({
			"resources/locales/en.ts": [
				'import landing from "~/resources/locales/landing/en";',
				'export default { landing, nav: { home: "Home {$name}" } };',
			].join("\n"),
			"resources/locales/landing/en.ts": 'export default { title: "Hi" };',
			"resources/locales/es.json":
				'{ "landing": { "title": "Hola" }, "nav": { "home": "Inicio" } }',
			"resources/locales/locales.test.ts": "",
		});

		expect(await translationsCheck.run(context)).toMatchObject({ status: "pass", findings: [] });
	});

	test("warns on a key missing from a translation and on a key only a translation has", async () => {
		let context = await fixture({
			"resources/locales/en.ts": 'export default { a: "A", b: "B" };',
			"resources/locales/es.ts": 'export default { a: "A", c: "C" };',
		});

		let result = await translationsCheck.run(context);

		expect(result.status).toBe("warn");
		expect(result.findings).toEqual([
			"resources/locales/es.ts lacks b",
			"resources/locales/es.ts has c, which en lacks",
		]);
	});

	test("fails on a message that does not parse as MessageFormat 2", async () => {
		let context = await fixture({
			"resources/locales/en.ts": 'export default { count: "{$count :number" };',
		});

		let result = await translationsCheck.run(context);

		expect(result.status).toBe("fail");
		expect(result.findings[0]).toMatch(/^resources\/locales\/en\.ts count: syntax-error/);
	});

	test("skips an app without locale bundles", async () => {
		expect((await translationsCheck.run(await fixture({}))).status).toBe("skip");
	});
});
