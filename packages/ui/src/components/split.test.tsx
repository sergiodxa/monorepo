/**
 * Covers {@link Split} lean tracks, check-styled copy lists, and media column
 * sizing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Split } from "./split.js";

describe("Split", () => {
	test("leans the wider track toward copy when requested", async () => {
		let html = await renderToString(
			<Split lean="copy">
				<Split.Copy>Claims</Split.Copy>
				<Split.Media>Shot</Split.Media>
			</Split>,
		);

		expect(html).toContain('data-lean="copy"');
		expect(html).toContain("container: ui-marketing-split / inline-size");
		expect(html).toContain("1.15fr");
		expect(html).toContain("0.85fr");
		expect(html).toContain('data-slot="split-copy"');
		expect(html).toContain('data-slot="split-media"');
	});

	test("marks checked claim lists when checks is set", async () => {
		let html = await renderToString(
			<Split.Copy checks>
				<ul>
					<li>Claim one</li>
				</ul>
			</Split.Copy>,
		);

		expect(html).toContain('data-checks="true"');
		expect(html).toContain("list-style: none");
		expect(html).toContain("-webkit-mask:");
	});
});
