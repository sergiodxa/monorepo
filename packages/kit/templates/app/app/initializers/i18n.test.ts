/**
 * The translator a job or an email uses, which reads the same bundles a page does.
 */

import { describe, expect, test } from "vitest";

import { translate } from "~/app/initializers/i18n";

describe("translate", () => {
	test("binds the fallback language for an unsupported one", () => {
		let { locale, t } = translate("fr");

		expect(locale).toBe("en");
		expect(t("notFound.title")).toBe("Not found");
	});
});
