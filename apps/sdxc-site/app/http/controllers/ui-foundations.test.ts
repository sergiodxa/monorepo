/**
 * Tests each namespace's Foundations page through the real router: it answers with one h1,
 * every variable it lists and a link back to Theming, its Markdown twin carries the same
 * tables, and the catalogue lists it in its namespace's section.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { listCataloguePages } from "~/app/services/catalogue-pages";
import { componentGroupTitle } from "~/app/services/navigation";
import { fetchApp } from "~/app/test/router";
import { FOUNDATIONS } from "~/resources/content/foundations";

describe.each(FOUNDATIONS.map((foundations) => [foundations.slug, foundations] as const))(
	"GET /api/ui/%s",
	(slug, foundations) => {
		test("renders the intro, the shared ideas and every variable", async () => {
			let response = await fetchApp(`/api/ui/${slug}`);
			let body = await response.text();

			expect(response.status).toBe(200);
			expect(body.match(/<h1[\s>]/g)).toHaveLength(1);
			expect(body).toContain(`${foundations.title} — @sdxc/ui`);
			expect(body).toContain('href="/api/ui/theming"');
			for (let idea of foundations.ideas) expect(body).toContain(idea.title);
			for (let group of foundations.variables) {
				for (let variable of group.variables) {
					for (let name of variable.name.split(", ")) expect(body).toContain(escape(name));
				}
			}
		});

		test("answers its Markdown twin with the same variables", async () => {
			let response = await fetchApp(`/api/ui/${slug}.md`);
			let body = await response.text();

			expect(response.status).toBe(200);
			expect(body).toMatch(new RegExp(`^# ${foundations.title}$`, "m"));
			for (let group of foundations.variables) {
				for (let variable of group.variables) expect(body).toContain(`\`${variable.name}\``);
			}
		});

		test("is listed under its namespace's section in the catalogue", async () => {
			let pages = await listCataloguePages();
			let page = pages.find((entry) => entry.href === `/api/ui/${slug}`);

			expect(page?.section).toBe(componentGroupTitle(foundations.module));
		});
	},
);

describe("the overview pages the Foundations replaced", () => {
	test.each(["landing-components", "landing-patterns", "docs-components", "docs-patterns"])(
		"/api/ui/%s answers 404",
		async (slug) => {
			expect((await fetchApp(`/api/ui/${slug}`)).status).toBe(404);
		},
	);
});

/** The text as the server renders it inside an element, where `&` and `<` are escaped. */
function escape(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
