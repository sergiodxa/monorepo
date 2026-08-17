/**
 * Tests that the signed-in shell reads every string it owns from the request's own
 * i18next instance rather than baking English into the markup. A missing or misspelled
 * key renders as the key itself and fails neither typecheck nor any other test, so these
 * assert on the rendered output, and assert it twice — once per locale — so a hardcoded
 * literal that happens to match the English copy still fails.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTranslator } from "@pkg/i18n";
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import de from "~/app/locales/de";
import en from "~/app/locales/en";

import AppShell from "./app-shell";

let { i18n } = await createTranslator({
	resources: { en: { translation: en }, de: { translation: de } },
	supportedLanguages: ["en", "de"],
	fallbackLanguage: "en",
})();

/** Renders the shell in `locale`, always with a toast queued so the flash region is in the markup. */
function render(locale: "en" | "de") {
	return renderToString(
		<AppShell
			team={{ id: "team-1", slug: "acme", name: "Acme", logo: null }}
			teams={[{ id: "team-1", slug: "acme", name: "Acme", logo: null }]}
			viewer={{ name: "Ada", email: "ada@acme.test", avatar: "" }}
			isAdmin
			i18next={i18n.cloneInstance({ lng: locale })}
			heading="Dashboard"
			breadcrumbs={[{ label: "Monitors" }]}
			toast={{ intent: "success", message: "Saved" }}
		>
			<p>Body</p>
		</AppShell>,
	);
}

describe("AppShell", () => {
	test("labels the flash toast region from the locale, not a hardcoded string", async () => {
		expect(await render("en")).toContain(`aria-label="${en.app.layout.toasts.region}"`);
	});

	test("relabels the flash toast region when the locale changes", async () => {
		let html = await render("de");

		expect(html).toContain(`aria-label="${de.app.layout.toasts.region}"`);
		expect(html).not.toContain(`aria-label="${en.app.layout.toasts.region}"`);
	});

	/** The nav is the largest block of copy the shell owns, and it used to be English literals. */
	test("translates the sidebar navigation labels", async () => {
		let html = await render("de");

		expect(html).toContain(de.app.layout.sidebar.navigation.items.httpMonitors);
		expect(html).not.toContain(en.app.layout.sidebar.navigation.items.httpMonitors);
	});

	/** Landmark names are invisible on screen, so nothing but an assertion catches them. */
	test("translates the landmark and menu labels a screen reader announces", async () => {
		let html = await render("de");

		expect(html).toContain(`aria-label="${de.app.layout.sidebar.toggle}"`);
		expect(html).toContain(`aria-label="${de.app.layout.breadcrumbs.label}"`);
		expect(html).toContain(`aria-label="${de.app.layout.sidebar.userMenu.label}"`);
		expect(html).toContain(de.app.layout.sidebar.account.signOut);
	});
});
