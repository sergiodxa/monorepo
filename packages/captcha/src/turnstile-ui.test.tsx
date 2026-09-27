/**
 * Tests for the Turnstile widget by rendering it: the container carries each configured
 * option as the `data-*` attribute Cloudflare's script reads, and the loader follows it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { TurnstileWidget } from "./turnstile-ui.js";

describe("TurnstileWidget", () => {
	test("renders the container and then the loader", async () => {
		let html = await renderToString(<TurnstileWidget siteKey="1x00000000000000000000AA" />);

		expect(html).toContain('class="cf-turnstile"');
		expect(html).toContain('data-sitekey="1x00000000000000000000AA"');
		expect(html).toContain('src="https://challenges.cloudflare.com/turnstile/v0/api.js"');
		expect(html.indexOf("cf-turnstile")).toBeLessThan(html.indexOf("<script"));
	});

	test("writes each option as the attribute the script reads", async () => {
		let html = await renderToString(
			<TurnstileWidget
				siteKey="key"
				action="sign-up"
				cData="tenant-1"
				theme="dark"
				size="flexible"
				appearance="interaction-only"
				language="es"
				field="challenge"
				nonce="abc"
			/>,
		);

		expect(html).toContain('data-action="sign-up"');
		expect(html).toContain('data-cdata="tenant-1"');
		expect(html).toContain('data-theme="dark"');
		expect(html).toContain('data-size="flexible"');
		expect(html).toContain('data-appearance="interaction-only"');
		expect(html).toContain('data-language="es"');
		expect(html).toContain('data-response-field-name="challenge"');
		expect(html).toContain('nonce="abc"');
	});

	test("leaves unset options to Cloudflare's defaults", async () => {
		let html = await renderToString(<TurnstileWidget siteKey="key" />);

		expect(html).not.toContain("data-action");
		expect(html).not.toContain("data-theme");
		expect(html).not.toContain("data-response-field-name");
		expect(html).not.toContain("nonce");
	});
});
