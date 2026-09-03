/**
 * Tests `Trans`'s tag splicing and its fallback to an ancestor `IntlProvider`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createInstance } from "i18next";
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { IntlProvider } from "./intl-provider.js";
import { Trans } from "./trans.js";

describe(Trans, () => {
	test("interpolates {{variables}} through i18n.t() and splices components in for tags", async () => {
		let i18n = createInstance();
		await i18n.init({
			lng: "en",
			interpolation: { escapeValue: false },
			resources: {
				en: { translation: { greeting: "Hello <0>{{name}}</0>, welcome back" } },
			},
		});

		let html = await renderToString(
			<Trans i18n={i18n} i18nKey="greeting" values={{ name: "Bob" }} components={{ "0": <b /> }} />,
		);

		expect(html).toBe("Hello <b>Bob</b>, welcome back");
	});

	test("renders a plain translation with no components", async () => {
		let i18n = createInstance();
		await i18n.init({ lng: "en", resources: { en: { translation: { hello: "Hi there" } } } });

		let html = await renderToString(<Trans i18n={i18n} i18nKey="hello" />);

		expect(html).toBe("Hi there");
	});

	test("falls back to the nearest ancestor IntlProvider's instance when i18n is omitted", async () => {
		let i18n = createInstance();
		await i18n.init({ lng: "en", resources: { en: { translation: { hello: "Hi there" } } } });

		let html = await renderToString(
			<IntlProvider i18n={i18n}>
				<Trans i18nKey="hello" />
			</IntlProvider>,
		);

		expect(html).toBe("Hi there");
	});
});
