/**
 * Server-renders every product mockup in every language, so a marketing page never
 * loses its hero to a mockup that throws, and checks each one is a single named image
 * whose drawn UI stays hidden from assistive technology.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import type { MockupArea } from "~/resources/components/marketing/product-mockups";

import { SUPPORTED_LANGUAGES, translate } from "~/app/initializers/i18n";
import ProductMockup, {
	AUDIENCE_MOCKUPS,
	COMPARISON_MOCKUPS,
	FEATURE_MOCKUPS,
	USE_CASE_MOCKUPS,
} from "~/resources/components/marketing/product-mockups";
import { audiences, comparisons, features, useCases } from "~/resources/content/marketing";

/** Every area, so a new one is rendered here as soon as it joins the union. */
const AREAS: MockupArea[] = [
	"dashboard",
	"monitor",
	"alerts",
	"status-page",
	"dns",
	"tcp",
	"ssl",
	"cron",
	"flow",
	"maintenance",
	"reports",
	"team",
	"api-keys",
];

describe("ProductMockup", () => {
	test.each(SUPPORTED_LANGUAGES.flatMap((language) => AREAS.map((area) => [language, area])))(
		"renders %s %s as one named, decorative image",
		async (language, area) => {
			let { t } = translate(language);
			let html = await renderToString(<ProductMockup area={area as MockupArea} t={t} />);
			let frame = openingTag(html, 'data-slot="product-frame"');
			let mockup = openingTag(html, 'data-slot="product-mockup"');

			expect(frame).toContain('role="img"');
			expect(frame).toContain(
				`aria-label="${escapeAttribute(t(`landing.mockups.${altKey(area)}`))}"`,
			);
			expect(mockup).toContain('aria-hidden="true"');
			expect(html).not.toContain("landing.mockups.");
		},
	);

	test("maps every marketing page to an area", () => {
		expect(Object.keys(FEATURE_MOCKUPS).sort()).toEqual(Object.keys(features).sort());
		expect(Object.keys(AUDIENCE_MOCKUPS).sort()).toEqual(Object.keys(audiences).sort());
		expect(Object.keys(USE_CASE_MOCKUPS).sort()).toEqual(Object.keys(useCases).sort());
		expect(Object.keys(COMPARISON_MOCKUPS).sort()).toEqual(Object.keys(comparisons).sort());
	});

	test("keeps flow runs at least the shortest flow interval apart", async () => {
		let { t } = translate("en");
		let html = await renderToString(<ProductMockup area="flow" t={t} />);
		expect(html).toContain("14:45");
		expect(html).toContain("14:30");
		expect(html).toContain("14:15");
	});
});

/** The locale key an area's text alternative lives under. */
function altKey(area: string): string {
	return area.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());
}

/** The opening tag carrying `marker`, so a test reads that element's attributes alone. */
function openingTag(html: string, marker: string): string {
	let index = html.indexOf(marker);
	return html.slice(html.lastIndexOf("<", index), html.indexOf(">", index) + 1);
}

/** Escapes text the way the renderer writes it into an attribute value. */
function escapeAttribute(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
