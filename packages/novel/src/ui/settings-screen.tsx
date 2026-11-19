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

import type { NovelSettings, SkipMode } from "./settings.js";

import { NovelPlayer } from "./player.js";
import { dialogSurface } from "./theme.js";

export namespace SettingsScreen {
	/** Props {@link SettingsScreen} accepts. */
	export interface Props extends Omit<Dialog.Props, "id" | "children"> {}

	/** Props {@link RangeSetting} accepts. */
	export interface RangeProps {
		label: string;
		name: string;
		value: number;
		min: number;
		max: number;
		step: number;
		onInput: (value: number) => void;
	}
}

/**
 * Lets the reader change every presentation setting through the player's `settings` model, in
 * a modal dialog the quick menu or Escape opens; each change leaves as `novel:settings`.
 *
 * @example <NovelPlayer.Settings />
 */
export function SettingsScreen(handle: Handle<SettingsScreen.Props>) {
	let player = handle.context.get(NovelPlayer);

	/** Applies `patch` to the settings. */
	function change(patch: Partial<NovelSettings>): void {
		player.settings.update(patch);
	}

	/** Changes one channel's volume. */
	function volume(channel: keyof NovelSettings["volume"], value: number): void {
		player.settings.setVolume(channel, value);
	}

	return () => {
		let { mix, ...rest } = handle.props;
		let { labels } = player;
		let settings = player.settings.value;
		let id = player.ids.settings;
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
						onInput={(value) => change({ textSpeed: value })}
					/>
					<RangeSetting
						label={labels.autoDelay}
						name="autoDelay"
						value={settings.autoDelay}
						min={0}
						max={5000}
						step={250}
						onInput={(value) => change({ autoDelay: value })}
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
							onInput={(value) => volume(channel, value / 100)}
						/>
					))}
					<RangeSetting
						label={labels.fontSize}
						name="fontSize"
						value={Math.round(settings.fontSize * 100)}
						min={75}
						max={150}
						step={5}
						onInput={(value) => change({ fontSize: value / 100 })}
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
 * One labeled slider, reporting every value as the reader drags.
 *
 * @example <RangeSetting label="Text speed" name="textSpeed" value={40} min={0} max={120} step={5} onInput={set} />
 */
export function RangeSetting(handle: Handle<SettingsScreen.RangeProps>) {
	return () => {
		let { label, name, value, min, max, step, onInput } = handle.props;
		return (
			<Slider min={min} max={max} value={value} mix={css({ gap: "0.35rem" })}>
				<span>{label}</span>
				<Slider.Track>
					<Slider.Thumb
						name={name}
						step={step}
						aria-label={label}
						mix={on("input", (event) => onInput(Number(event.currentTarget.value)))}
					/>
				</Slider.Track>
			</Slider>
		);
	};
}
