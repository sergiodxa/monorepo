/**
 * Tests for {@link Table}'s numeric opt-in and sortable headers, asserted over
 * `renderToString` output: numeric cells line their digits up down a column, and
 * a sort link fills its header cell so the whole cell answers a click.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Table } from "./table.js";

describe("Table.Cell", () => {
	test("marks a numeric cell and sets it in end-aligned tabular figures", async () => {
		let html = String(await renderToString(<Table.Cell numeric>1,240</Table.Cell>));

		expect(html).toMatch(/<td[^>]*data-numeric=""/);
		expect(html).toContain("font-variant-numeric: tabular-nums");
		expect(html).toContain("text-align: end");
	});

	test("leaves a plain cell unmarked", async () => {
		let html = String(await renderToString(<Table.Cell>Ada</Table.Cell>));

		expect(html).not.toMatch(/<td[^>]*data-numeric/);
	});
});

describe("Table.Column", () => {
	test("end-aligns a numeric column unless align says otherwise", async () => {
		let numeric = String(await renderToString(<Table.Column numeric>Amount</Table.Column>));
		let centered = String(
			await renderToString(
				<Table.Column numeric align="center">
					Amount
				</Table.Column>,
			),
		);

		expect(numeric).toMatch(/<th[^>]*data-align="end"/);
		expect(numeric).toMatch(/<th[^>]*data-numeric=""/);
		expect(centered).toMatch(/<th[^>]*data-align="center"/);
	});

	test("moves a sortable header's padding onto its link, so the whole cell is the target", async () => {
		let html = String(
			await renderToString(
				<Table.Column href="?sort=name" sortDirection="ascending">
					Name
				</Table.Column>,
			),
		);

		let [, thClasses] = html.match(/<th[^>]*class="([^"]*)"/) ?? [];
		let [, linkClasses] = html.match(/<a[^>]*class="([^"]*)"/) ?? [];
		let paddingClass = html.match(/\.(rmxc-[\w-]+) \{\s*padding-inline: 1rem;/)?.[1];

		expect(paddingClass).toBeDefined();
		expect(linkClasses?.split(" ")).toContain(paddingClass);
		expect(thClasses?.split(" ")).not.toContain(paddingClass);
	});
});
