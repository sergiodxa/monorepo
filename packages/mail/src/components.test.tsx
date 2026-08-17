/**
 * Tests the layout kit against the constraints it exists for: table markup with
 * inline styles only, no branding baked in, a preheader that stays out of the text
 * part, and a button whose link target survives plain-text derivation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

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

	test("ships the dark half of the color scheme it declares", async () => {
		let { html, text } = await render(
			<Email.Layout>
				<Email.Text>Body copy</Email.Text>
			</Email.Layout>,
		);

		expect(html).toContain('name="color-scheme" content="light dark"');
		expect(html).toContain("@media (prefers-color-scheme:dark)");
		expect(html).toContain(".mail-surface{background-color:#18181b !important;}");
		expect(html).toContain('class="mail-text"');
		// The stylesheet is document furniture, not copy, so it stays out of the text part.
		expect(text).toBe("Body copy");
	});

	test("appends the app's own dark rules to that block", async () => {
		let { html } = await render(
			<Email.Layout darkStyles=".app-chart{background-color:#000000 !important;}">
				<Email.Text>Body copy</Email.Text>
			</Email.Layout>,
		);

		expect(html).toContain(".app-chart{background-color:#000000 !important;}}");
	});

	test("drops the dark rule for any color the caller overrode", async () => {
		let { html } = await render(
			<Email.Layout surface="#111111">
				<Email.Heading color="#eeeeee">Title</Email.Heading>
			</Email.Layout>,
		);

		// The rule stays in the stylesheet; nothing wears the class that would answer it.
		expect(html).not.toContain('class="mail-surface"');
		expect(html).toContain("background-color:#111111");
		expect(html).toContain("<h1 style=");
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

		expect(first.html).toMatch(/^<h1/);
		expect(first.html).toContain("font-size:24px");
		expect(second.html).toMatch(/^<h2/);
		expect(second.html).toContain("font-size:20px");
		expect(third.html).toMatch(/^<h3/);
		expect(third.html).toContain("font-size:16px");
	});
});

describe("Email.Text", () => {
	test("renders a paragraph with an explicit line height", async () => {
		let { html, text } = await render(<Email.Text>Body copy</Email.Text>);

		expect(html).toMatch(/^<p/);
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

describe("Email.Section", () => {
	test("puts the padding on the cell and the fill on the table", async () => {
		let { html } = await render(
			<Email.Section padding="16px 0" background="#fafafa">
				<Email.Text>Grouped</Email.Text>
			</Email.Section>,
		);

		expect(html).toContain("background-color:#fafafa");
		expect(html).toContain("padding:16px 0;");
		// Outlook drops padding declared on a table, so it must not be the one carrying it.
		expect(html).not.toContain("width:100%;background-color:#fafafa;padding");
	});
});

describe("Email.Row and Email.Column", () => {
	test("lays its columns out as one table row", async () => {
		let { html } = await render(
			<Email.Row>
				<Email.Column width={120}>Left</Email.Column>
				<Email.Column align="right">Right</Email.Column>
			</Email.Row>,
		);

		expect(html.split("<tr").length - 1).toBe(1);
		expect(html.split("<td").length - 1).toBe(2);
	});

	test("gives a numeric width to the attribute bare and to the style in pixels", async () => {
		let { html } = await render(<Email.Column width={120}>Left</Email.Column>);

		expect(html).toContain('width="120"');
		expect(html).toContain("width:120px;");
	});
});

describe("Email.Link", () => {
	test("inherits the surrounding color so dark mode carries it", async () => {
		let { html, text } = await render(<Email.Link href="https://example.com">docs</Email.Link>);

		expect(html).toContain("color:inherit");
		expect(html).toContain("text-decoration:underline");
		expect(html).toContain('target="_blank"');
		expect(text).toBe("docs (https://example.com)");
	});
});

describe("Email.Img", () => {
	test("carries the resets that stop a client framing it or spacing under it", async () => {
		let { html, text } = await render(
			<Email.Img src="https://example.com/logo.png" alt="Acme" width={120} />,
		);

		expect(html).toContain("display:block");
		expect(html).toContain("border:0");
		expect(html).toContain("outline:none");
		// Alt text is what most readers get: clients block remote images until asked.
		expect(text).toBe("Acme");
	});
});

describe("Email.Hr", () => {
	test("draws the rule as a top border rather than the native element", async () => {
		let { html } = await render(<Email.Hr />);

		expect(html).toContain("border:none");
		expect(html).toContain("border-top:1px solid #e4e4e7");
		expect(html).toContain('class="mail-rule"');
	});
});

describe("Email.CodeInline", () => {
	test("sizes itself against whatever it is set inside", async () => {
		let { html, text } = await render(<Email.CodeInline>DEBUG=1</Email.CodeInline>);

		expect(html).toContain("font-size:0.9em");
		expect(html).toContain('class="mail-code"');
		expect(text).toBe("DEBUG=1");
	});
});

describe("web fonts", () => {
	test("declares the face, names Outlook's fallback, and sets the document stack", async () => {
		let { html } = await render(
			<Email.Layout
				fonts={[
					{
						family: "Inter",
						fallback: "Helvetica, Arial, sans-serif",
						src: { url: "https://example.com/i.woff2", format: "woff2" },
					},
				]}
			>
				<Email.Text>Body copy</Email.Text>
			</Email.Layout>,
		);

		expect(html).toContain("@font-face{font-family:'Inter'");
		expect(html).toContain("mso-font-alt:'Helvetica'");
		expect(html).toContain("format('woff2')");
		// Unquoted, or the renderer escapes the quotes and the declaration names nothing.
		expect(html).toContain("font-family:Inter, Helvetica, Arial, sans-serif;");
		expect(html).not.toContain("&#39;Inter&#39;");
	});
});
