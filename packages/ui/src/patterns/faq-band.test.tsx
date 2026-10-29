/**
 * Covers {@link FaqBand} header and two-column accordion layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Accordion } from "../components/accordion.js";

import { FaqBand } from "./faq-band.js";

describe("FaqBand", () => {
	test("renders title and two accordion columns", async () => {
		let html = await renderToString(
			<FaqBand title="Questions" columns={2}>
				<Accordion>
					<Accordion.Item>
						<Accordion.Trigger>One?</Accordion.Trigger>
						<Accordion.Content>Answer one.</Accordion.Content>
					</Accordion.Item>
				</Accordion>
				<Accordion>
					<Accordion.Item>
						<Accordion.Trigger>Two?</Accordion.Trigger>
						<Accordion.Content>Answer two.</Accordion.Content>
					</Accordion.Item>
				</Accordion>
			</FaqBand>,
		);

		expect(html).toContain("Questions");
		expect(html).toContain("One?");
		expect(html).toContain("Two?");
		expect(html).toContain('data-columns="2"');
		expect(html).toContain("container: ui-marketing-faq / inline-size");
		expect(html).toContain("@container ui-marketing-faq (min-width:");
		expect(html).toMatch(/data-columns="2"[^>]*>\s*<div\b/);
	});
});
