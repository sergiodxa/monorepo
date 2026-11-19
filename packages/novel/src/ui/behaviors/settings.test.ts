/**
 * Holds the settings model to its contract without a DOM: stored settings completed with the
 * defaults, whole and partial changes announced with `change`, and silent adoption.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../settings.js";

import { SettingsModel } from "./settings.js";

describe(SettingsModel, () => {
	test("completes stored settings with the defaults", () => {
		let settings = new SettingsModel({ textSpeed: 0, volume: { music: 0.2 } });
		expect(settings.value).toEqual({
			...DEFAULT_SETTINGS,
			textSpeed: 0,
			volume: { ...DEFAULT_SETTINGS.volume, music: 0.2 },
		});
	});

	test("announces each change and adopts stored settings silently", () => {
		let settings = new SettingsModel();
		let changed = vi.fn();
		settings.addEventListener("change", changed);
		settings.update({ autoDelay: 500 });
		settings.setVolume("voice", 0.5);
		expect(settings.value.autoDelay).toBe(500);
		expect(settings.value.volume.voice).toBe(0.5);
		settings.replace({ skip: "all" });
		expect(settings.value).toEqual({ ...DEFAULT_SETTINGS, skip: "all" });
		expect(changed).toHaveBeenCalledTimes(2);
	});
});
