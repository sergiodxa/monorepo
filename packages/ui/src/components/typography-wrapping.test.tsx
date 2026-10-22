/**
 * Tests that titles balance their lines and running copy avoids orphans across the
 * components that render them, asserted over `renderToString` output, so a short
 * last line never strands a single word under a heading or a paragraph.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vite-plus/test";

import { Alert } from "./alert.js";
import { Description } from "./description.js";
import { Empty } from "./empty.js";
import { FieldError } from "./field-error.js";
import { Heading } from "./heading.js";
import { Keyboard } from "./keyboard.js";
import { Text } from "./text.js";
import { Typeset } from "./typeset.js";

/** The markup and stylesheet `renderToString` produces for `node`, as one string. */
async function render(node: RemixNode): Promise<string> {
	return String(await renderToString(node));
}

describe("titles", () => {
	test.each([
		["Heading", <Heading>Title</Heading>],
		["Alert.Title", <Alert.Title>Title</Alert.Title>],
		["Empty.Title", <Empty.Title>Title</Empty.Title>],
	])("%s balances its lines", async (_, node) => {
		expect(await render(node)).toContain("text-wrap: balance");
	});
});

describe("running copy", () => {
	test.each([
		["Text", <Text>Copy</Text>],
		["Description", <Description>Copy</Description>],
		["FieldError", <FieldError>Copy</FieldError>],
		["Alert.Description", <Alert.Description>Copy</Alert.Description>],
		["Empty.Description", <Empty.Description>Copy</Empty.Description>],
	])("%s wraps prettily", async (_, node) => {
		expect(await render(node)).toContain("text-wrap: pretty");
	});
});

describe("Typeset", () => {
	test("balances headings, wraps paragraphs prettily and sets table figures tabular", async () => {
		let html = await render(<Typeset />);

		expect(html).toContain("text-wrap: balance");
		expect(html).toContain("text-wrap: pretty");
		expect(html).toContain("font-variant-numeric: tabular-nums");
	});
});

describe("Keyboard", () => {
	test("sets digits on a cap at tabular widths", async () => {
		expect(await render(<Keyboard>1</Keyboard>)).toContain("font-variant-numeric: tabular-nums");
	});
});
