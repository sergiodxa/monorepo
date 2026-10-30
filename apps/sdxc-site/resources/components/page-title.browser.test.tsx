/**
 * Lays a documentation title out in a real browser at phone widths: the longest package name
 * the site titles a page with, and a lead holding long inline code, stay inside the column.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import PageTitle from "~/resources/components/page-title";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** Column widths of a docs page on a 320px to 414px phone, inside its 20px gutters. */
const WIDTHS = [280, 335, 374];

let cleanups: Array<() => void> = [];

afterEach(() => {
	for (let cleanup of cleanups) cleanup();
	cleanups = [];
	document.body.replaceChildren();
});

describe("PageTitle", () => {
	test.each(WIDTHS)("keeps a long package name and its lead inside a %ipx column", (width) => {
		let host = document.createElement("div");
		host.style.width = `${width}px`;
		document.body.appendChild(host);
		let { cleanup } = render(
			<PageTitle eyebrow="Package" title="@sdxc/trailing-slash-middleware" mono>
				Sets <code>stroke-linejoin</code>, drawn on a <code>&lt;polygon&gt;</code> or a{" "}
				<code>serviceProviderConfig(options:Discovery.ServiceProviderConfigOptions)</code>.
			</PageTitle>,
			{ container: host },
		);
		cleanups.push(cleanup);

		for (let line of host.querySelectorAll("h1, p")) {
			expect(line.getBoundingClientRect().right).toBeLessThanOrEqual(
				host.getBoundingClientRect().right,
			);
		}
		expect(host.scrollWidth).toBeLessThanOrEqual(width);
	});
});
