/**
 * Tests for the hCaptcha widget by rendering it: the container carries each configured
 * option as the `data-*` attribute hCaptcha's script reads, the language rides on the
 * loader's `hl` parameter, and the loader follows the container.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { HCaptchaWidget } from "./hcaptcha-ui.js";

describe("HCaptchaWidget", () => {
	test("renders the container and then the loader", async () => {
		let html = await renderToString(<HCaptchaWidget siteKey="site" />);

		expect(html).toContain('class="h-captcha"');
		expect(html).toContain('data-sitekey="site"');
		expect(html).toContain('src="https://js.hcaptcha.com/1/api.js"');
		expect(html.indexOf("h-captcha")).toBeLessThan(html.indexOf("<script"));
	});

	test("writes each option as the attribute the script reads", async () => {
		let html = await renderToString(
			<HCaptchaWidget
				siteKey="site"
				theme="dark"
				size="compact"
				tabIndex={0}
				language="es"
				nonce="abc"
			/>,
		);

		expect(html).toContain('data-theme="dark"');
		expect(html).toContain('data-size="compact"');
		expect(html).toContain('data-tabindex="0"');
		expect(html).toContain('src="https://js.hcaptcha.com/1/api.js?hl=es"');
		expect(html).toContain('nonce="abc"');
	});

	test("leaves unset options to hCaptcha's defaults", async () => {
		let html = await renderToString(<HCaptchaWidget siteKey="site" />);

		expect(html).not.toContain("data-theme");
		expect(html).not.toContain("data-size");
		expect(html).not.toContain("nonce");
	});
});
