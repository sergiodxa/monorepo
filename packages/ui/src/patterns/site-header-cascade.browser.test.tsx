/**
 * Holds {@link SiteHeader}'s menu button hidden on a wide bar whatever order the page's
 * styles register in. A page whose other content first uses the same container-query rule
 * puts that rule's layer before the button's own, which the button must not depend on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { render } from "remix/component/test";
import { expect, test } from "vitest";
import { page } from "vitest/browser";

import { SiteHeader } from "./site-header.js";

test("hides the menu button on a wide bar when the hide rule registered first", async () => {
	await page.viewport(1280, 800);
	let probe = document.createElement("div");
	document.body.appendChild(probe);
	render(<span mix={[at("xl", "ui-site-header", raw({ display: "none" }))]} />, {
		container: probe,
	});

	let host = document.createElement("div");
	host.style.width = "1280px";
	document.body.appendChild(host);
	render(
		<SiteHeader
			brand={<a href="/">Keel</a>}
			items={[{ label: "Pricing", href: "/pricing" }]}
			cta={{ label: "Start free", href: "/signup" }}
		/>,
		{ container: host },
	);

	let menu = host.querySelector<HTMLElement>('[data-slot="site-header-menu-button"]')!;
	expect(getComputedStyle(menu).display).toBe("none");
});
