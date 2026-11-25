/**
 * The settings screen: tabs for text, sound and accessibility beside rows that each show a
 * setting's name, its current value and its control. Every change goes through the player's
 * settings model and leaves as one `novel:settings` event, so the app stores one JSON value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode, Props as TagProps } from "remix/component";

import { Dialog, Select, Slider, Switch } from "@sdxc/ui";
import { css, on } from "remix/component";

import type { SettingsBehavior } from "./behaviors/settings.js";
import type { NovelLabels, NovelSettings, SkipMode } from "./settings.js";

import { NovelPlayer } from "./player.js";
import { DEFAULT_LABELS, DEFAULT_SETTINGS } from "./settings.js";
import { dialogSurface, themeVar } from "./theme.js";

/** The settings screen's tabs, in the order they are listed. */
const SETTINGS_TABS = ["text", "sound", "accessibility"] as const;

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

	/** One of the settings screen's tabs. */
	export type Tab = (typeof SETTINGS_TABS)[number];

	/** Props {@link RangeSetting} accepts; `mix` lands on the row. */
	export interface RangeProps {
		label: string;
		name: string;
		value: number;
		min: number;
		max: number;
		step: number;
		/** The value as the reader reads it, such as `80%` or `1.5 s`. */
		readout?: string;
		mix?: TagProps<"div">["mix"];
	}

	/** Props {@link SettingRow} accepts. */
	export interface RowProps {
		label: string;
		readout?: string;
		/** The control, which names itself with `label` for assistive technology. */
		children?: RemixNode;
		mix?: TagProps<"div">["mix"];
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
	let tab: SettingsScreen.Tab = "text";

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

	/** Shows `next`'s settings. */
	function select(next: SettingsScreen.Tab): void {
		tab = next;
		void handle.update();
	}

	return () => {
		let { mix, id: givenId, settings: _settings, labels: overrides, ...rest } = handle.props;
		let current = model();
		if (current === undefined) return null;
		let labels = { ...DEFAULT_LABELS, ...player?.labels, ...overrides };
		let settings = current.value;
		let id = player?.ids.settings ?? givenId ?? fallbackId;
		let tabNames = {
			text: labels.settingsText,
			sound: labels.settingsSound,
			accessibility: labels.settingsAccessibility,
		};
		let volumes = [
			["master", labels.volumeMaster],
			["music", labels.volumeMusic],
			["ambience", labels.volumeAmbience],
			["sound", labels.volumeSound],
			["voice", labels.volumeVoice],
		] as const;
		let percent = new Intl.NumberFormat(undefined, { style: "percent" });
		let seconds = new Intl.NumberFormat(undefined, {
			style: "unit",
			unit: "second",
			maximumFractionDigits: 2,
		});
		return (
			<Dialog
				{...rest}
				id={id}
				aria-labelledby={`${id}-title`}
				data-novel-settings=""
				style={{ ...dialogSurface(), maxInlineSize: "none", inlineSize: "min(60rem, 96vw)" }}
				mix={[css({ fontSize: "1rem", cursor: "auto" }), mix]}
			>
				<Dialog.Header>
					<Dialog.Title id={`${id}-title`}>{labels.settings}</Dialog.Title>
				</Dialog.Header>
				<div
					mix={css({
						containerType: "inline-size",
						display: "grid",
						gridTemplateColumns: "minmax(9rem, 13rem) minmax(0, 1fr)",
						gap: "1rem",
						"@container (max-width: 40rem)": { gridTemplateColumns: "minmax(0, 1fr)" },
					})}
				>
					<div
						role="tablist"
						aria-orientation="vertical"
						mix={css({ display: "flex", flexDirection: "column", gap: "0.5rem" })}
					>
						{SETTINGS_TABS.map((name) => (
							<button
								key={name}
								type="button"
								role="tab"
								id={`${id}-tab-${name}`}
								aria-controls={`${id}-panel-${name}`}
								aria-selected={tab === name ? "true" : "false"}
								data-novel-settings-tab={name}
								mix={[settingsButton(), on("click", () => select(name))]}
							>
								{tabNames[name]}
							</button>
						))}
					</div>
					<div
						data-novel-settings-panel=""
						mix={css({
							display: "flex",
							flexDirection: "column",
							minInlineSize: 0,
							maxBlockSize: "min(60vh, 32rem)",
							overflowY: "auto",
							padding: themeVar("--novel-settings-panel-padding"),
							background: themeVar("--novel-settings-panel-background"),
							color: themeVar("--novel-settings-panel-color"),
						})}
					>
						<div
							role="tabpanel"
							id={`${id}-panel-text`}
							aria-labelledby={`${id}-tab-text`}
							hidden={tab !== "text"}
						>
							<RangeSetting
								label={labels.textSpeed}
								name="textSpeed"
								value={settings.textSpeed}
								min={0}
								max={120}
								step={5}
								readout={settings.textSpeed === 0 ? labels.textInstant : `${settings.textSpeed}/s`}
								mix={rangeInput((value) => change({ textSpeed: value }))}
							/>
							<TextPreview text={labels.textPreview} speed={settings.textSpeed} />
							<RangeSetting
								label={labels.autoDelay}
								name="autoDelay"
								value={settings.autoDelay}
								min={0}
								max={5000}
								step={250}
								readout={seconds.format(settings.autoDelay / 1000)}
								mix={rangeInput((value) => change({ autoDelay: value }))}
							/>
							<SettingRow label={labels.skipMode}>
								<Select
									name="skip"
									aria-label={labels.skipMode}
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
							</SettingRow>
							<RangeSetting
								label={labels.fontSize}
								name="fontSize"
								value={Math.round(settings.fontSize * 100)}
								min={75}
								max={150}
								step={5}
								readout={percent.format(settings.fontSize)}
								mix={rangeInput((value) => change({ fontSize: value / 100 }))}
							/>
						</div>
						<div
							role="tabpanel"
							id={`${id}-panel-sound`}
							aria-labelledby={`${id}-tab-sound`}
							hidden={tab !== "sound"}
						>
							{volumes.map(([channel, label]) => (
								<RangeSetting
									key={channel}
									label={label}
									name={`volume.${channel}`}
									value={Math.round(settings.volume[channel] * 100)}
									min={0}
									max={100}
									step={5}
									readout={percent.format(settings.volume[channel])}
									mix={rangeInput((value) => volume(channel, value / 100))}
								/>
							))}
						</div>
						<div
							role="tabpanel"
							id={`${id}-panel-accessibility`}
							aria-labelledby={`${id}-tab-accessibility`}
							hidden={tab !== "accessibility"}
						>
							<SettingRow label={labels.dyslexiaFont}>
								<Switch
									name="dyslexiaFont"
									aria-label={labels.dyslexiaFont}
									checked={settings.dyslexiaFont}
									mix={on("change", (event) =>
										change({ dyslexiaFont: event.currentTarget.checked }),
									)}
								/>
							</SettingRow>
							<SettingRow label={labels.selfVoicing}>
								<Switch
									name="selfVoicing"
									aria-label={labels.selfVoicing}
									checked={settings.selfVoicing}
									mix={on("change", (event) =>
										change({ selfVoicing: event.currentTarget.checked }),
									)}
								/>
							</SettingRow>
						</div>
					</div>
				</div>
				<div
					mix={css({
						display: "flex",
						flexWrap: "wrap",
						justifyContent: "flex-end",
						gap: "0.75rem",
						marginBlockStart: "1rem",
					})}
				>
					<button
						type="button"
						data-novel-settings-reset=""
						mix={[
							settingsButton(),
							on("click", () =>
								change({ ...DEFAULT_SETTINGS, volume: { ...DEFAULT_SETTINGS.volume } }),
							),
						]}
					>
						{labels.resetSettings}
					</button>
					<button
						type="button"
						data-novel-settings-back=""
						commandfor={id}
						command="close"
						mix={settingsButton()}
					>
						{labels.back}
					</button>
				</div>
				<Dialog.Close commandfor={id} aria-label={labels.close} />
			</Dialog>
		);
	};
}

/** Styles a settings tab or footer button from the theme; a selected tab takes the selected look. */
function settingsButton() {
	return css({
		position: "relative",
		padding: "0.6rem 1.2rem",
		border: themeVar("--novel-settings-tab-border"),
		borderRadius: themeVar("--novel-settings-tab-radius"),
		background: themeVar("--novel-settings-tab-background"),
		color: themeVar("--novel-settings-tab-color"),
		font: themeVar("--novel-settings-tab-font"),
		textAlign: "center",
		cursor: "pointer",
		"&:hover, &:focus-visible, &[aria-selected='true']": {
			background: themeVar("--novel-settings-tab-selected-background"),
			color: themeVar("--novel-settings-tab-selected-color"),
		},
	});
}

/**
 * Reads a range's value from the native `input` event its `<input>` fires as the reader drags,
 * which bubbles to a `RangeSetting`'s row.
 *
 * @param set - Receives every value.
 */
function rangeInput(set: (value: number) => void) {
	return on<HTMLDivElement, "input">("input", (event) => {
		if (event.target instanceof HTMLInputElement) set(event.target.valueAsNumber);
	});
}

/**
 * One row of the settings screen: the setting's name, its value as the reader reads it, and
 * its control, stacked when the screen is narrow.
 *
 * @example <SettingRow label="Skip"><Select aria-label="Skip">…</Select></SettingRow>
 */
export function SettingRow(handle: Handle<SettingsScreen.RowProps>) {
	return () => {
		let { label, readout, children, mix } = handle.props;
		return (
			<div
				data-novel-setting=""
				mix={[
					css({
						display: "grid",
						gridTemplateColumns: "minmax(7rem, 13rem) 4.5rem minmax(0, 1fr)",
						alignItems: "center",
						columnGap: "1rem",
						rowGap: "0.35rem",
						paddingBlock: "0.85rem",
						borderBlockEnd: `1px solid ${themeVar("--novel-settings-divider")}`,
						"@container (max-width: 36rem)": { gridTemplateColumns: "minmax(0, 1fr) auto" },
					}),
					mix,
				]}
			>
				<span aria-hidden="true">{label}</span>
				<span
					aria-hidden="true"
					data-novel-setting-readout=""
					mix={css({
						fontSize: "0.85em",
						fontVariantNumeric: "tabular-nums",
						textAlign: "end",
						color: themeVar("--novel-settings-readout-color"),
					})}
				>
					{readout}
				</span>
				<div
					mix={css({
						minInlineSize: 0,
						paddingInline: "0.75rem",
						"@container (max-width: 36rem)": { gridColumn: "1 / -1" },
					})}
				>
					{children}
				</div>
			</div>
		);
	};
}

/**
 * One slider row; its `<input>` fires a native `input` event on every value as the reader
 * drags, which bubbles to the row where `mix` lands.
 *
 * @example <RangeSetting label="Text speed" name="textSpeed" value={40} min={0} max={120} step={5} mix={on("input", read)} />
 */
export function RangeSetting(handle: Handle<SettingsScreen.RangeProps>) {
	return () => {
		let { label, name, value, min, max, step, readout, mix } = handle.props;
		return (
			<SettingRow label={label} readout={readout ?? String(value)} mix={mix}>
				<Slider min={min} max={max} value={value} style={{ minInlineSize: 0 }}>
					<Slider.Track>
						<Slider.Thumb name={name} step={step} aria-label={label} />
					</Slider.Track>
				</Slider>
			</SettingRow>
		);
	};
}

/** Props of {@link TextPreview}. */
interface TextPreviewProps {
	text: string;
	/** Characters per second; `0` shows the line at once. */
	speed: number;
}

/**
 * Types `text` over and over at `speed`, pausing a second on the full line, so the reader sees
 * the speed they chose before they play.
 */
function TextPreview(handle: Handle<TextPreviewProps>) {
	let shown = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let speed: number | undefined;

	handle.signal.addEventListener("abort", () => clearTimeout(timer));

	/** Reveals the next character, or starts over after a pause on the full line. */
	function tick(): void {
		let { text } = handle.props;
		if (speed === undefined || speed <= 0) return;
		let full = shown >= text.length;
		shown = full ? 0 : shown + 1;
		let delay = 1000 / speed;
		if (full) delay = 400;
		else if (shown >= text.length) delay = 1200;
		timer = setTimeout(tick, delay);
		void handle.update();
	}

	return () => {
		let { text } = handle.props;
		if (handle.props.speed !== speed) {
			speed = handle.props.speed;
			clearTimeout(timer);
			shown = speed <= 0 ? text.length : 0;
			if (speed > 0) timer = setTimeout(tick, 1000 / speed);
		}
		return (
			<p
				data-novel-settings-preview=""
				aria-hidden="true"
				mix={css({
					margin: "0.25rem 0 0.5rem",
					padding: "0.75rem 1rem",
					minBlockSize: "1.5em",
					borderRadius: "0.4rem",
					background: themeVar("--novel-settings-preview-background"),
					color: themeVar("--novel-settings-preview-color"),
				})}
			>
				{text.slice(0, shown)}
				<span mix={css({ visibility: "hidden" })}>{text.slice(shown)}</span>
			</p>
		);
	};
}
