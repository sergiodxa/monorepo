/**
 * Covers {@link LogoCloud} applying mark sizing to direct children.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { LogoCloud } from "./logo-cloud.js";

describe("LogoCloud", () => {
	test("sizes direct children with the logo-cloud mark recipe", async () => {
		let html = await renderToString(
			<LogoCloud muted>
				<img src="/acme.svg" alt="" />
				<img src="/globex.svg" alt="" />
			</LogoCloud>,
		);

		expect(html).toContain('data-slot="logo-cloud"');
		expect(html).toContain('data-muted="true"');
		expect(html).toContain('data-layout="row"');
		expect(html).toContain("var(--ui-marketing-logo-height");
		expect(html).toContain('src="/acme.svg"');
	});
});
