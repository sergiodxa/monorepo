/**
 * Renders the flow diagram in a real browser: a page passing its own spec lines sees those
 * lines in run order under the documented step captions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import FlowDiagram from "~/resources/components/marketing/flow-diagram";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** English captions as the home page passes them. */
const LABELS = {
	name: "A flow monitor run, step by step",
	pause: "Pause the animation",
	schedule: "The schedule starts a run",
	scheduleDetail: "As often as every 15 minutes",
	steps: [
		"Sign in",
		"Read the token",
		"Call the endpoint it authorises",
		"Check what comes back",
	] as [string, string, string, string],
	passed: "Run passed",
	alert: "A failed step alerts your team",
};

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

describe("FlowDiagram", () => {
	test("prints the spec lines a page passes, in run order", async () => {
		await page.viewport(1280, 900);
		let code = ["browser.open", "browser.fill", "browser.click", "expect browser.heading"] as const;
		mounted = render(<FlowDiagram labels={LABELS} code={code} />);

		let printed = [...mounted.container.querySelectorAll("ol code")].map(
			(line) => line.textContent,
		);
		expect(printed).toEqual([...code]);
	});
});
