/**
 * Lays a typeset article out in a real browser and checks that a `data-not-typeset` subtree
 * draws with none of the prose styles, while the prose around it keeps them. It reads only
 * properties the layer sets, since the browser's own defaults stand in for the reset here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { Typeset } from "./typeset.js";

/** The color the layer paints a prose link, set on the host so it can be told apart. */
const BRAND = "rgb(1, 2, 3)";

/** Mounts an article holding a prose link and list beside an opted-out widget. */
function mountArticle() {
	let host = document.createElement("div");
	host.style.setProperty("--ui-brand-fg", BRAND);
	document.body.appendChild(host);
	let { container } = render(
		<Typeset>
			<p>
				<a href="#prose">Prose link</a>
			</p>
			<ul data-prose>
				<li>Prose item</li>
			</ul>
			<div data-not-typeset>
				<ul>
					<li>
						<a href="#widget">Widget link</a>
					</li>
				</ul>
			</div>
		</Typeset>,
		{ container: host },
	);
	return {
		prose: container.querySelector<HTMLAnchorElement>('a[href="#prose"]')!,
		widget: container.querySelector<HTMLAnchorElement>('a[href="#widget"]')!,
		list: container.querySelector<HTMLUListElement>("[data-not-typeset] ul")!,
		proseList: container.querySelector<HTMLUListElement>("ul[data-prose]")!,
	};
}

describe("Typeset opt-out", () => {
	test("styles a prose link and leaves a link inside data-not-typeset alone", () => {
		let { prose, widget } = mountArticle();

		expect(getComputedStyle(prose).color).toBe(BRAND);
		expect(getComputedStyle(widget).color).not.toBe(BRAND);
	});

	test("indents a prose list and leaves a list inside data-not-typeset alone", () => {
		let { list, proseList } = mountArticle();

		expect(getComputedStyle(proseList).paddingInlineStart).not.toBe(
			getComputedStyle(list).paddingInlineStart,
		);
	});
});
