/**
 * The settings screen: text speed, auto delay, skip mode, a volume per channel, text size, a
 * dyslexia-friendly font and self-voicing. Every change goes through the player's settings
 * model and leaves as one `novel:settings` event, so the app stores one JSON value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Dialog, Select, Slider, Switch } from "@sdxc/ui";
import { css, on } from "remix/component";

import type { SettingsBehavior } from "./behaviors/settings.js";
import type { NovelLabels, NovelSettings, SkipMode } from "./settings.js";

import { NovelPlayer } from "./player.js";
import { DEFAULT_LABELS } from "./settings.js";
import { dialogSurface } from "./theme.js";

export namespace SettingsScreen {
	/** Props {@link SettingsScreen} accepts. */
	export interface Props extends Omit<Dialog.Props, "children"> {
		/** The dialog's id; inside a player it is always the player's settings id. */
		id?: string;
		/** The settings to show and change; inside a player it defaults to the player's. */
		settings?: SettingsBehavior;
		/** Replaces any label; inside a player it defaults to the player's. */
		labels?: Partial<NovelLabels>;
	}

	/** Props {@link RangeSetting} accepts; `mix` lands on the slider's root. */
	export interface RangeProps extends Pick<Slider.Props, "mix"> {
		label: string;
		name: string;
		value: number;
		min: number;
		max: number;
		step: number;
	}
}

/**
 * Lets the reader change every presentation setting through the player's `settings` model, in
 * a modal dialog the quick menu or Escape opens; each change leaves as `novel:settings`. Outside
 * a player it changes the `settings` model it is given, whose owner reports the change.
 *
 * @example <NovelPlayer.Settings />
 */
export function SettingsScreen(handle: Handle<SettingsScreen.Props>) {
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;
	let fallbackId = `${handle.id}-settings`.replace(/[^\w-]/g, "-");

	/** The settings model the screen changes: the prop's, else the player's. */
	function model(): SettingsBehavior | undefined {
		return handle.props.settings ?? player?.settings;
	}

	/** Applies `patch` to the settings. */
	function change(patch: Partial<NovelSettings>): void {
		model()?.update(patch);
	}

	/** Changes one channel's volume. */
	function volume(channel: keyof NovelSettings["volume"], value: number): void {
		model()?.setVolume(channel, value);
	}

	return () => {
		let { mix, id: givenId, settings: _settings, labels: overrides, ...rest } = handle.props;
		let current = model();
		if (current === undefined) return null;
		let labels = { ...DEFAULT_LABELS, ...player?.labels, ...overrides };
		let settings = current.value;
		let id = player?.ids.settings ?? givenId ?? fallbackId;
		let volumes = [
			["master", labels.volumeMaster],
			["music", labels.volumeMusic],
			["ambience", labels.volumeAmbience],
			["sound", labels.volumeSound],
			["voice", labels.volumeVoice],
		] as const;
		return (
			<Dialog
				{...rest}
				id={id}
				aria-labelledby={`${id}-title`}
				data-novel-settings=""
				style={dialogSurface()}
				mix={[css({ inlineSize: "min(36rem, 94vw)", fontSize: "1rem", cursor: "auto" }), mix]}
			>
				<Dialog.Header>
					<Dialog.Title id={`${id}-title`}>{labels.settings}</Dialog.Title>
				</Dialog.Header>
				<div mix={css({ display: "grid", gap: "1rem" })}>
					<RangeSetting
						label={labels.textSpeed}
						name="textSpeed"
						value={settings.textSpeed}
						min={0}
						max={120}
						step={5}
						mix={rangeInput((value) => change({ textSpeed: value }))}
					/>
					<RangeSetting
						label={labels.autoDelay}
						name="autoDelay"
						value={settings.autoDelay}
						min={0}
						max={5000}
						step={250}
						mix={rangeInput((value) => change({ autoDelay: value }))}
					/>
					<label mix={css({ display: "grid", gap: "0.35rem" })}>
						<span>{labels.skipMode}</span>
						<Select
							name="skip"
							mix={on("change", (event) => {
								change({ skip: event.currentTarget.value as SkipMode });
							})}
						>
							<Select.Option value="read" selected={settings.skip === "read"}>
								{labels.skipRead}
							</Select.Option>
							<Select.Option value="all" selected={settings.skip === "all"}>
								{labels.skipAll}
							</Select.Option>
						</Select>
					</label>
					{volumes.map(([channel, label]) => (
						<RangeSetting
							key={channel}
							label={label}
							name={`volume.${channel}`}
							value={Math.round(settings.volume[channel] * 100)}
							min={0}
							max={100}
							step={5}
							mix={rangeInput((value) => volume(channel, value / 100))}
						/>
					))}
					<RangeSetting
						label={labels.fontSize}
						name="fontSize"
						value={Math.round(settings.fontSize * 100)}
						min={75}
						max={150}
						step={5}
						mix={rangeInput((value) => change({ fontSize: value / 100 }))}
					/>
					<Switch
						name="dyslexiaFont"
						checked={settings.dyslexiaFont}
						mix={on("change", (event) => change({ dyslexiaFont: event.currentTarget.checked }))}
					>
						{labels.dyslexiaFont}
					</Switch>
					<Switch
						name="selfVoicing"
						checked={settings.selfVoicing}
						mix={on("change", (event) => change({ selfVoicing: event.currentTarget.checked }))}
					>
						{labels.selfVoicing}
					</Switch>
				</div>
				<Dialog.Close commandfor={id} aria-label={labels.close} />
			</Dialog>
		);
	};
}

/**
 * Reads a range's value from the native `input` event its `<input>` fires as the reader drags,
 * which bubbles to a `RangeSetting`'s root.
 *
 * @param set - Receives every value.
 */
function rangeInput(set: (value: number) => void) {
	return on<HTMLDivElement, "input">("input", (event) => {
		if (event.target instanceof HTMLInputElement) set(event.target.valueAsNumber);
	});
}

/**
 * One labeled slider; its `<input>` fires a native `input` event on every value as the reader
 * drags, which bubbles to the root where `mix` lands.
 *
 * @example <RangeSetting label="Text speed" name="textSpeed" value={40} min={0} max={120} step={5} mix={on("input", read)} />
 */
export function RangeSetting(handle: Handle<SettingsScreen.RangeProps>) {
	return () => {
		let { label, name, value, min, max, step, mix } = handle.props;
		return (
			<Slider min={min} max={max} value={value} mix={[css({ gap: "0.35rem" }), mix]}>
				<span>{label}</span>
				<Slider.Track>
					<Slider.Thumb name={name} step={step} aria-label={label} />
				</Slider.Track>
			</Slider>
		);
	};
}
