/**
 * Tests for the reCAPTCHA v2 checkbox widget by rendering it: the container carries each
 * configured option as the `data-*` attribute Google's script reads, the language rides
 * on the loader's `hl` parameter, and the loader follows the container.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { ReCaptchaWidget } from "./recaptcha-ui.js";

describe("ReCaptchaWidget", () => {
	test("renders the container and then the loader", async () => {
		let html = await renderToString(<ReCaptchaWidget siteKey="site" />);

		expect(html).toContain('class="g-recaptcha"');
		expect(html).toContain('data-sitekey="site"');
		expect(html).toContain('src="https://www.google.com/recaptcha/api.js"');
		expect(html.indexOf("g-recaptcha")).toBeLessThan(html.indexOf("<script"));
	});

	test("writes each option as the attribute the script reads", async () => {
		let html = await renderToString(
			<ReCaptchaWidget
				siteKey="site"
				theme="dark"
				size="compact"
				tabIndex={-1}
				language="pt-BR"
				nonce="abc"
			/>,
		);

		expect(html).toContain('data-theme="dark"');
		expect(html).toContain('data-size="compact"');
		expect(html).toContain('data-tabindex="-1"');
		expect(html).toContain('src="https://www.google.com/recaptcha/api.js?hl=pt-BR"');
		expect(html).toContain('nonce="abc"');
	});

	test("leaves unset options to Google's defaults", async () => {
		let html = await renderToString(<ReCaptchaWidget siteKey="site" />);

		expect(html).not.toContain("data-theme");
		expect(html).not.toContain("data-tabindex");
		expect(html).not.toContain("nonce");
	});
});
