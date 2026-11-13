/**
 * Tests for the markup a tree serves before any script: the chevron is decoration inside
 * its `<summary>`, a file row is a treeitem link into the tree's frame, and the filter is a
 * GET form a reader without script can submit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Tree } from "./tree.js";

describe("Tree.ExpandButton", () => {
	test("renders as decoration, so the summary it sits in keeps the activation", async () => {
		let html = await renderToString(<Tree.ExpandButton />);

		expect(html).not.toContain("<button");
		expect(html).toContain("<span");
	});

	test("is hidden from the accessibility tree, which the row already speaks for", async () => {
		let html = await renderToString(<Tree.ExpandButton />);

		expect(html).toContain('aria-hidden="true"');
	});
});

describe("Tree.Leaf", () => {
	test("serves a treeitem link carrying the tree's frame and the path the filter matches", async () => {
		let html = await renderToString(
			<Tree aria-label="Files" frame="main">
				<Tree.Item id="app" open>
					<Tree.ItemContent>app</Tree.ItemContent>
					<Tree.Leaf href="/blob/app/routes.ts" name="routes.ts" path="app/routes.ts" current />
				</Tree.Item>
			</Tree>,
		);
		let leaf = /<a [^>]*data-tree-leaf[^>]*>/.exec(html)?.[0] ?? "";

		expect(leaf).toContain('role="treeitem"');
		expect(leaf).toContain('aria-level="2"');
		expect(leaf).toContain('aria-current="page"');
		expect(leaf).toContain('data-rmx-target="main"');
		expect(leaf).toContain('data-filter-text="app/routes.ts"');
	});
});

describe("Tree.Filter", () => {
	test("serves a GET form whose field submits the query as filter", async () => {
		let html = await renderToString(
			<Tree.Filter
				tree="files"
				label="Filter files"
				action="/files"
				value="rou"
				params={{ ref: "main" }}
			/>,
		);

		expect(html).toMatch(/<form [^>]*method="get"/);
		expect(html).toContain('name="filter"');
		expect(html).toContain('value="rou"');
		expect(html).toContain('<input type="hidden" name="ref" value="main"');
	});
});
