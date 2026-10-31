/**
 * Renders the flow diagram in a real browser: every step prints its line of the documented
 * HTTP sign-in flow, in run order under the step captions.
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
	test("prints the documented sign-in flow's spec lines, in run order", async () => {
		await page.viewport(1280, 900);
		mounted = render(<FlowDiagram labels={LABELS} />);

		let printed = [...mounted.container.querySelectorAll("ol code")].map(
			(line) => line.textContent,
		);
		expect(printed).toEqual([
			'http.post "/api/sessions" form { … }',
			"session.json.token",
			'http.get "/v1/account" bearer session.json.token',
			"expect account.status 200",
		]);
	});
});
