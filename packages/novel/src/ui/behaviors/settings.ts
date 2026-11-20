/**
 * The reader's presentation settings as a headless model: completed with defaults from whatever
 * the app stored, changed whole or one field at a time, and announced with `change`, so the
 * settings screen, the mixer and the app's storage all follow one value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dispatchChange } from "@sdxc/ui/utils";
import { TypedEventTarget } from "remix/component";

import type { AudioChannel, NovelSettings, StoredSettings } from "../settings.js";

import { resolveSettings } from "../settings.js";

/**
 * What the player and the settings screen need from the reader's settings, which
 * `NovelPlayer`'s `behaviors.settings` replaces: the whole value, changes that dispatch
 * `change`, and the settings the app stored adopted through the `settings` prop.
 */
export interface SettingsBehavior extends TypedEventTarget<SettingsBehavior.EventMap> {
	/** Every setting, defaults filled in; the player reads it as each frame plays. */
	readonly value: NovelSettings;
	/** Replaces every setting; its `change` leaves the player as `novel:settings`. */
	set(next: NovelSettings): void;
	/** Changes the fields in `patch` and dispatches `change`. */
	update(patch: Partial<NovelSettings>): void;
	/** Changes one channel's volume, between 0 and 1, and dispatches `change`. */
	setVolume(channel: AudioChannel | "master", value: number): void;
	/** Adopts the settings the app passes in the `settings` prop, without a `change`. */
	replace(stored: StoredSettings | undefined): void;
}

export namespace SettingsBehavior {
	/** Events a {@link SettingsBehavior} dispatches. */
	export interface EventMap {
		/** Dispatched after the reader changes a setting. */
		change: Event;
	}
}

export namespace SettingsModel {
	/** Events {@link SettingsModel} dispatches. */
	export interface EventMap extends SettingsBehavior.EventMap {}
}

/**
 * Holds the settings a play is presented with. `replace()` adopts what the app stored without
 * announcing it, since the app already has it; every other change dispatches `change`.
 *
 * @example let settings = new SettingsModel({ textSpeed: 0 }); settings.update({ autoDelay: 500 });
 */
export class SettingsModel
	extends TypedEventTarget<SettingsModel.EventMap>
	implements SettingsBehavior
{
	#value: NovelSettings;

	/** @param stored - What the app kept, possibly partial or from an older version. */
	constructor(stored?: StoredSettings) {
		super();
		this.#value = resolveSettings(stored);
	}

	/** Every setting, defaults filled in. */
	get value(): NovelSettings {
		return this.#value;
	}

	/** Adopts stored settings silently, completing them with the defaults. */
	replace(stored: StoredSettings | undefined): void {
		this.#value = resolveSettings(stored);
	}

	/** Replaces every setting and dispatches `change`. */
	set(next: NovelSettings): void {
		this.#value = next;
		dispatchChange(this);
	}

	/** Changes the fields in `patch` and dispatches `change`. */
	update(patch: Partial<NovelSettings>): void {
		this.set({ ...this.#value, ...patch });
	}

	/** Changes one channel's volume, between 0 and 1, and dispatches `change`. */
	setVolume(channel: AudioChannel | "master", value: number): void {
		this.set({ ...this.#value, volume: { ...this.#value.volume, [channel]: value } });
	}
}
