/**
 * Tests for `<Icon name />`, covering name-based lookup and prop forwarding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { renderToString } from "remix/ui/server";

import { Icon } from "./icon.js";

describe(Icon.name, () => {
	test("renders the icon matching the given name", async () => {
		let html = await renderToString(<Icon name="heart" />);

		expect(html).toContain("<svg");
		expect(html).toContain('class="lucide lucide-heart"');
	});

	test("renders a different icon when name changes", async () => {
		let html = await renderToString(<Icon name="circle-alert" />);

		expect(html).toContain('class="lucide lucide-circle-alert"');
		expect(html).toContain("<circle");
	});

	test("forwards the remaining props to the underlying icon", async () => {
		let html = await renderToString(<Icon name="heart" size={16} color="red" className="icon" />);

		expect(html).toContain('width="16"');
		expect(html).toContain('stroke="red"');
		expect(html).toContain('class="lucide lucide-heart icon"');
	});

	test("renders icon names whose registry export was renamed to dodge a reserved word", async () => {
		let deleteHtml = await renderToString(<Icon name="delete" />);
		let importHtml = await renderToString(<Icon name="import" />);
		let packageHtml = await renderToString(<Icon name="package" />);

		expect(deleteHtml).toContain('class="lucide lucide-delete"');
		expect(importHtml).toContain('class="lucide lucide-import"');
		expect(packageHtml).toContain('class="lucide lucide-package"');
	});
});
