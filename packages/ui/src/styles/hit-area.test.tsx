/**
 * Covers {@link hitArea}'s two anchors through rendered CSS: the default box stretches
 * from a positioned host's clamped insets, and the `"flex-center"` box carries a fixed
 * target size and no insets, so it holds wherever a consumer positions the host.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { hitArea } from "./hit-area.js";

describe("hitArea", () => {
	test("stretches from the host's edges by default", async () => {
		let html = await renderToString(<button mix={hitArea()} />);

		expect(html).toContain("&::after");
		expect(html).toContain("position: absolute;");
		expect(html).toContain("inset: min(0px, calc((100% - var(--ui-target-size, 1.5rem)) / 2));");
		expect(html).not.toContain("inline-size:");
	});

	test("draws a fixed, inset-free box for a flex-centred host", async () => {
		let html = await renderToString(<button mix={hitArea({ anchor: "flex-center" })} />);

		expect(html).toContain("position: absolute;");
		expect(html).toContain("inline-size: var(--ui-target-size, 1.5rem);");
		expect(html).toContain("block-size: var(--ui-target-size, 1.5rem);");
		expect(html).not.toContain("inset");
	});
});
