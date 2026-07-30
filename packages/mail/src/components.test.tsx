/**
 * Tests the layout kit against the constraints it exists for: table markup with
 * inline styles only, no branding baked in, a preheader that stays out of the text
 * part, and a button whose link target survives plain-text derivation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { Email, render } from "./index";

describe("Email.Layout", () => {
	test("renders a full document with a table-based, inline-styled body", async () => {
		let { html } = await render(
			<Email.Layout title="Invite">
				<Email.Text>Body copy</Email.Text>
			</Email.Layout>,
		);

		expect(html).toContain('<html lang="en">');
		expect(html).toContain('charset="utf-8"');
		expect(html).toContain("<title>Invite</title>");
		expect(html).toContain('role="presentation"');
		expect(html).toContain("Body copy");
	});

	test("carries no branding: every color and the width are props", async () => {
		let { html } = await render(
			<Email.Layout background="#000000" surface="#111111" color="#eeeeee" width={480}>
				<Email.Text>Body copy</Email.Text>
			</Email.Layout>,
		);

		expect(html).toContain("background-color:#000000");
		expect(html).toContain("background-color:#111111");
		expect(html).toContain("color:#eeeeee");
		expect(html).toContain("max-width:480px");
	});

	test("hides the preheader in the body and drops it from the text part", async () => {
		let { html, text } = await render(
			<Email.Layout preview="Your invite is ready">
				<Email.Text>Body copy</Email.Text>
			</Email.Layout>,
		);

		expect(html).toContain("Your invite is ready");
		expect(html).toContain("display:none");
		expect(text).toBe("Body copy");
	});

	test("renders a logo only when one is given", async () => {
		let withLogo = await render(
			<Email.Layout logo={{ src: "https://example.com/logo.png", alt: "Acme" }}>
				<Email.Text>Body copy</Email.Text>
			</Email.Layout>,
		);
		let withoutLogo = await render(
			<Email.Layout>
				<Email.Text>Body copy</Email.Text>
			</Email.Layout>,
		);

		expect(withLogo.html).toContain('src="https://example.com/logo.png"');
		expect(withoutLogo.html).not.toContain("<img");
	});
});

describe("Email.Heading", () => {
	test("picks the element and the size from the level", async () => {
		let first = await render(<Email.Heading>One</Email.Heading>);
		let second = await render(<Email.Heading level={2}>Two</Email.Heading>);
		let third = await render(<Email.Heading level={3}>Three</Email.Heading>);

		expect(first.html).toStartWith("<h1");
		expect(first.html).toContain("font-size:24px");
		expect(second.html).toStartWith("<h2");
		expect(second.html).toContain("font-size:20px");
		expect(third.html).toStartWith("<h3");
		expect(third.html).toContain("font-size:16px");
	});
});

describe("Email.Text", () => {
	test("renders a paragraph with an explicit line height", async () => {
		let { html, text } = await render(<Email.Text>Body copy</Email.Text>);

		expect(html).toStartWith("<p");
		expect(html).toContain("line-height:1.6");
		expect(text).toBe("Body copy");
	});

	test("uses the muted color when asked, and an explicit color over both", async () => {
		let muted = await render(<Email.Text muted>Body copy</Email.Text>);
		let explicit = await render(
			<Email.Text muted color="#ff0000">
				Body copy
			</Email.Text>,
		);

		expect(muted.html).toContain("color:#71717a");
		expect(explicit.html).toContain("color:#ff0000");
	});
});

describe("Email.Button", () => {
	test("wraps a real link in a single-cell table so the fill survives", async () => {
		let { html, text } = await render(
			<Email.Button href="https://example.com/accept">Accept invite</Email.Button>,
		);

		expect(html).toContain("<table");
		expect(html).toContain('href="https://example.com/accept"');
		expect(html).toContain("text-decoration:none");
		expect(text).toBe("Accept invite (https://example.com/accept)");
	});
});

describe("Email.Footer", () => {
	test("renders de-emphasized content under a hairline", async () => {
		let { html, text } = await render(
			<Email.Footer>You received this because you were invited.</Email.Footer>,
		);

		expect(html).toContain("border-top:1px solid #e4e4e7");
		expect(html).toContain("font-size:12px");
		expect(text).toBe("You received this because you were invited.");
	});
});
