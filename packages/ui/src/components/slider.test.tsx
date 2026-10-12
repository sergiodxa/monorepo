/**
 * Tests for {@link Slider}: the native input's pointer target across the track's thin
 * axis, which a vertical slider reaches through the input's own `vertical-lr` block axis,
 * and the track leaving that wider input unclipped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Slider } from "./slider.js";

/** The negative block inset every orientation's input carries, as the server emits it. */
const HIT_INSET =
	"min\\(0px, calc\\(\\(100% - max\\(var\\(--ui-slider-thumb-size, 1\\.25rem\\), var\\(--ui-target-size, 1\\.5rem\\)\\)\\) / 2\\)\\)";

describe(Slider.name, () => {
	test("grows a vertical slider's input to --ui-target-size across the track's width", async () => {
		let html = await renderToString(
			<Slider orientation="vertical" defaultValue={6} max={10}>
				<Slider.Track>
					<Slider.Thumb aria-label="Gain" />
				</Slider.Track>
			</Slider>,
		);

		expect(html).toMatch(new RegExp(`\\.rmxc-\\w+ \\{\\s*inset-block-start: ${HIT_INSET};`));
		expect(html).toMatch(new RegExp(`\\.rmxc-\\w+ \\{\\s*inset-block-end: ${HIT_INSET};`));
		expect(html).not.toMatch(/data-orientation="horizontal"\] & \{ inset-block-start/);
		expect(html).not.toContain("overflow: hidden");
	});

	test("keeps a horizontal slider's input reaching --ui-target-size across the track's height", async () => {
		let html = await renderToString(
			<Slider defaultValue={40}>
				<Slider.Track>
					<Slider.Thumb aria-label="Volume" />
				</Slider.Track>
			</Slider>,
		);

		expect(html).toMatch(new RegExp(`inset-block-start: ${HIT_INSET};`));
		expect(html).toMatch(new RegExp(`inset-block-end: ${HIT_INSET};`));
	});
});
