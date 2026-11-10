/**
 * Checks the apps showcase service: every language lists the same four homes, and the
 * Markdown twin keeps each app's name, platform and pitch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { appsFor, appsMarkdown } from "~/app/services/apps-page";
import { APP_LINKS } from "~/resources/content/apps/shared";

describe("appsFor", () => {
	test("lists the same four apps in every language", () => {
		for (let locale of ["en", "es-AR"] as const) {
			let page = appsFor(locale);
			expect(page.apps.map((app) => app.id)).toEqual(["wakaba", "encore", "uptime", "reader"]);
			expect(page.apps.map((app) => app.href)).toEqual([
				APP_LINKS.wakaba,
				APP_LINKS.encore,
				APP_LINKS.uptime,
				APP_LINKS.reader,
			]);
		}
	});
});

describe("appsMarkdown", () => {
	test("writes linked headings in showcase order", () => {
		let body = appsMarkdown(appsFor("en"));

		expect(body).toMatch(/^# Apps I built\n/);
		expect(body).toContain(`## [Wakaba](${APP_LINKS.wakaba})`);
		expect(body).toContain(`## [Reader](${APP_LINKS.reader})`);
		expect(body.indexOf("Wakaba")).toBeLessThan(body.indexOf("Encore"));
		expect(body.indexOf("Encore")).toBeLessThan(body.indexOf("Uptime"));
		expect(body.indexOf("Uptime")).toBeLessThan(body.indexOf("Reader"));
	});
});
