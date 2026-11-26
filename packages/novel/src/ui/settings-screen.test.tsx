/**
 * Renders the settings screen on the server, where it must leave nothing running: its text
 * preview types only once it is on the page, so a server render schedules no timers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { afterEach, expect, test, vi } from "vitest";

import { SettingsModel } from "./behaviors/settings.js";
import { SettingsScreen } from "./settings-screen.js";
import { DEFAULT_LABELS } from "./settings.js";

afterEach(() => {
	vi.useRealTimers();
});

test("draws the text preview at rest on the server, scheduling no timer", async () => {
	vi.useFakeTimers();
	let html = await renderToString(
		<SettingsScreen
			id="settings"
			settings={new SettingsModel({ textSpeed: 40 })}
			labels={DEFAULT_LABELS}
		/>,
	);
	expect(html).toContain("data-novel-settings-preview");
	expect(vi.getTimerCount()).toBe(0);
});
