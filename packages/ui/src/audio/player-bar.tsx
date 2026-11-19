/**
 * A music player's controls as one bar along the window's foot: what plays on the left, the
 * transport and the seek bar in the middle, volume and panel toggles on the right, with
 * {@link PlayerBar.Mini} as its phone form above a tab bar. The parts draw; a player drives them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";

import { formatTrackTime } from "./utils/track-time.js";

/** Prop types for {@link PlayerBar} and its parts. */
export namespace PlayerBar {
	/** Every native `<section>` attribute, plus the bar's three regions. */
	export interface Props extends Omit<TagProps<"section">, "children"> {
		/** The landmark's name, such as "Player". */
		label: string;
		/** What plays: a {@link PlayerBar.Track}. */
		track: RemixNode;
		/** The transport buttons in a row, then a {@link PlayerBar.Seek} under them. */
		controls: RemixNode;
		/** Panel toggles and the volume, at the bar's end. */
		extras?: RemixNode;
	}

	/** Every native `<div>` attribute, plus one track's art and lines. */
	export interface TrackProps extends Omit<TagProps<"div">, "title" | "children"> {
		/** A square cover. */
		art?: RemixNode;
		/** The track's name, usually a link to its album. */
		title: RemixNode;
		/** The artists, usually links. */
		subtitle?: RemixNode;
		/** A control after the lines, such as a like button. */
		action?: RemixNode;
	}

	/** Every native `<button>` attribute, plus how the button reads. */
	export interface ButtonProps extends Omit<TagProps<"button">, "aria-label"> {
		/** The button's name; also its tooltip. */
		label: string;
		/** A toggle's state, read out and marked with a dot under the icon. */
		pressed?: boolean;
		/** The play and pause button: a filled circle, larger than the rest. */
		primary?: boolean;
		/** A 16–20px icon. */
		children: RemixNode;
	}

	/** Every native `<input>` attribute of a range, with its value required. */
	export interface RangeProps extends Omit<TagProps<"input">, "type" | "value" | "style" | "role"> {
		value: number;
		/** @default 100 */
		max?: number;
		"aria-label": string;
	}

	/** The seek bar's current time and length, with the slider's name. */
	export interface SeekProps extends Omit<RangeProps, "value" | "max"> {
		/** Seconds played. */
		current: number;
		/** Length in seconds; `0` while it is unknown. */
		duration: number;
	}

	/** Every native `<div>` attribute, plus what the phone's mini player shows. */
	export interface MiniProps extends Omit<TagProps<"div">, "title" | "children"> {
		art?: RemixNode;
		title: RemixNode;
		subtitle?: RemixNode;
		/** The share played, from 0 to 1, drawn as a hairline along the foot. */
		progress: number;
		/**
		 * The button that opens the full player, covering the card: usually a `<button>` with
		 * `commandfor` and `command="show-modal"` aimed at a `<dialog>`.
		 */
		expand: RemixNode;
		/** Controls at the end that stay pressable over the card, such as play and pause. */
		actions: RemixNode;
	}
}

/**
 * Renders the bar: three columns from a laptop's width, and on a narrower container the track
 * and the transport alone, with the seek bar across the top edge.
 *
 * @example <PlayerBar label="Player" track={<PlayerBar.Track title="Low Tide" />} controls={controls} />
 */
export function PlayerBar(handle: Handle<PlayerBar.Props>) {
	return () => {
		let { controls, extras, label, mix, track, ...rest } = handle.props;
		return (
			<section
				{...rest}
				aria-label={label}
				data-slot="player-bar"
				mix={mergeMix(
					[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr)",
							alignItems: "center",
							gap: "1rem",
							paddingInline: "1rem",
							paddingBlock: "0.625rem",
							color: "var(--ui-neutral-fg)",
							"& > [data-region=controls]": {
								display: "grid",
								justifyItems: "center",
								gap: "0.25rem",
								minInlineSize: "0",
							},
							"& > [data-region=extras]": {
								display: "flex",
								alignItems: "center",
								justifyContent: "flex-end",
								gap: "0.25rem",
								minInlineSize: "0",
							},
						}),
					],
					mix,
				)}
			>
				{track}
				<div data-region="controls">{controls}</div>
				<div data-region="extras">{extras}</div>
			</section>
		);
	};
}

/** What plays: the cover and two truncating lines, each usually a link. */
function PlayerBarTrack(handle: Handle<PlayerBar.TrackProps>) {
	return () => {
		let { action, art, mix, subtitle, title, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="player-bar-track"
				mix={mergeMix(
					[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.75rem",
							minInlineSize: "0",
							"& a": { color: "inherit", textDecoration: "none" },
							"& a:hover": { textDecoration: "underline" },
							"& a:focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "2px",
								borderRadius: "2px",
							},
						}),
					],
					mix,
				)}
			>
				{art === undefined ? null : <ArtFrame size="3.5rem">{art}</ArtFrame>}
				<span mix={[raw({ display: "grid", minInlineSize: "0" })]}>
					<span
						data-slot="player-bar-title"
						mix={[
							raw({
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
								fontSize: "0.875rem",
								lineHeight: "1.25rem",
								fontWeight: "600",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{title}
					</span>
					{subtitle === undefined ? null : (
						<span
							data-slot="player-bar-subtitle"
							mix={[
								raw({
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									fontSize: "0.75rem",
									lineHeight: "1.125rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{subtitle}
						</span>
					)}
				</span>
				{action}
			</div>
		);
	};
}

/** A square cover at a fixed size, its content filling it. */
function ArtFrame(handle: Handle<{ size: string; children: RemixNode }>) {
	return () => (
		<span
			data-slot="player-bar-art"
			mix={[
				raw({
					flex: "none",
					display: "block",
					overflow: "clip",
					borderRadius: "var(--ui-radius-sm, 0.25rem)",
					backgroundColor: "var(--ui-neutral-bg-tint)",
					boxShadow: "0 0 0 1px var(--ui-image-outline, rgb(0 0 0 / 0.08))",
					"& > *": {
						display: "block",
						inlineSize: "100%",
						blockSize: "100%",
						objectFit: "cover",
					},
				}),
			]}
			style={{ inlineSize: handle.props.size, blockSize: handle.props.size }}
		>
			{handle.props.children}
		</span>
	);
}

/**
 * One transport button. A toggle (`pressed`) reads its state and shows a dot under its icon in
 * the brand color; `primary` draws the play button as a filled circle.
 */
function PlayerBarButton(handle: Handle<PlayerBar.ButtonProps>) {
	return () => {
		let { children, label, mix, pressed, primary, type = "button", ...rest } = handle.props;
		return (
			<button
				{...rest}
				type={type}
				aria-label={label}
				title={label}
				aria-pressed={pressed}
				data-slot="player-bar-button"
				data-primary={primary ? "" : undefined}
				mix={mergeMix(
					[
						raw({
							position: "relative",
							display: "inline-grid",
							placeItems: "center",
							flex: "none",
							inlineSize: "2.25rem",
							blockSize: "2.25rem",
							padding: "0",
							border: "0",
							borderRadius: "999px",
							color: "var(--ui-neutral-fg-muted)",
							backgroundColor: "transparent",
							cursor: "pointer",
							transition: "color 120ms ease, background-color 120ms ease, scale 120ms ease",
							"&:hover": { color: "var(--ui-neutral-fg-emphasis)" },
							"&:active": { scale: "0.94" },
							"&:focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "2px",
							},
							"&:disabled": { opacity: "0.4", cursor: "default" },
							"&[aria-pressed=true]": { color: "var(--ui-brand-fg)" },
							"&[aria-pressed=true]::after": {
								content: "''",
								position: "absolute",
								insetBlockEnd: "0.0625rem",
								insetInlineStart: "calc(50% - 0.125rem)",
								inlineSize: "0.25rem",
								blockSize: "0.25rem",
								borderRadius: "999px",
								backgroundColor: "currentColor",
							},
							"&[data-primary]": {
								inlineSize: "2.5rem",
								blockSize: "2.5rem",
								color: "var(--ui-neutral-bg, Canvas)",
								backgroundColor: "var(--ui-neutral-fg-emphasis)",
							},
							"&[data-primary]:hover": {
								color: "var(--ui-neutral-bg, Canvas)",
								scale: "1.05",
							},
							"@media (pointer: coarse)": {
								inlineSize: "var(--ui-target-size, 2.75rem)",
								blockSize: "var(--ui-target-size, 2.75rem)",
							},
						}),
					],
					mix,
				)}
			>
				{children}
			</button>
		);
	};
}

/**
 * A native range styled as a thin bar that thickens under the pointer, its played part filled.
 * The fill follows the `value` prop and, once script runs, the `--ui-range-fill` a player sets.
 */
function PlayerBarRange(handle: Handle<PlayerBar.RangeProps>) {
	return () => {
		let { max = 100, mix, value, ...rest } = handle.props;
		let share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
		return (
			<input
				{...rest}
				type="range"
				min={rest.min ?? 0}
				max={max}
				value={String(value)}
				data-slot="player-bar-range"
				style={{ "--ui-range-fill": `${(share * 100).toFixed(2)}%` }}
				mix={mergeMix([rangeStyles()], mix)}
			/>
		);
	};
}

/** The range's track, fill and thumb across engines, with a larger hit area than it draws. */
function rangeStyles() {
	let track =
		"linear-gradient(to right, var(--ui-player-bar-fill, var(--ui-neutral-fg-emphasis)) var(--ui-range-fill, 0%), var(--ui-player-bar-track, color-mix(in oklch, currentColor 22%, transparent)) var(--ui-range-fill, 0%))";
	return raw({
		appearance: "none",
		display: "block",
		inlineSize: "100%",
		minInlineSize: "0",
		blockSize: "1rem",
		margin: "0",
		padding: "0",
		background: "transparent",
		cursor: "pointer",
		color: "var(--ui-neutral-fg-muted)",
		"&::-webkit-slider-runnable-track": {
			blockSize: "0.25rem",
			borderRadius: "999px",
			background: track,
		},
		"&::-moz-range-track": {
			blockSize: "0.25rem",
			borderRadius: "999px",
			background: track,
		},
		"&::-webkit-slider-thumb": {
			appearance: "none",
			inlineSize: "0.75rem",
			blockSize: "0.75rem",
			marginBlockStart: "-0.25rem",
			border: "0",
			borderRadius: "999px",
			backgroundColor: "var(--ui-neutral-fg-emphasis)",
			boxShadow: "0 1px 3px rgb(0 0 0 / 0.3)",
			opacity: "0",
			transition: "opacity 120ms ease",
		},
		"&::-moz-range-thumb": {
			inlineSize: "0.75rem",
			blockSize: "0.75rem",
			border: "0",
			borderRadius: "999px",
			backgroundColor: "var(--ui-neutral-fg-emphasis)",
			opacity: "0",
		},
		"&:hover, &:focus-visible": {
			"--ui-player-bar-fill": "var(--ui-brand-bg-solid)",
		},
		"&:hover::-webkit-slider-thumb, &:focus-visible::-webkit-slider-thumb": { opacity: "1" },
		"&:hover::-moz-range-thumb, &:focus-visible::-moz-range-thumb": { opacity: "1" },
		"&:focus-visible": {
			outline: "2px solid var(--ui-brand-ring)",
			outlineOffset: "2px",
			borderRadius: "999px",
		},
		"@media (pointer: coarse)": {
			blockSize: "1.75rem",
			"&::-webkit-slider-thumb": { opacity: "1" },
			"&::-moz-range-thumb": { opacity: "1" },
		},
	});
}

/** The seek bar: the time played, the slider and the track's length, in tabular figures. */
function PlayerBarSeek(handle: Handle<PlayerBar.SeekProps>) {
	return () => {
		let { current, duration, ...rest } = handle.props;
		let length = Number.isFinite(duration) && duration > 0 ? duration : 0;
		return (
			<div
				data-slot="player-bar-seek"
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "2.75rem minmax(0, 1fr) 2.75rem",
						alignItems: "center",
						gap: "0.5rem",
						inlineSize: "100%",
						maxInlineSize: "40rem",
						fontSize: "0.6875rem",
						lineHeight: "1rem",
						fontVariantNumeric: "tabular-nums",
						color: "var(--ui-neutral-fg-muted)",
						"& > :first-child": { textAlign: "end" },
					}),
				]}
			>
				<span data-slot="player-bar-current">{formatTrackTime(current)}</span>
				<PlayerBarRange
					{...rest}
					value={Math.min(current, length)}
					max={length || 1}
					step="any"
					aria-valuetext={`${formatTrackTime(current)} / ${formatTrackTime(length)}`}
				/>
				<span data-slot="player-bar-duration">{formatTrackTime(length)}</span>
			</div>
		);
	};
}

/**
 * The phone's form: a card with the cover, two lines and a play button, a hairline of
 * progress along its foot, and an expand button under everything that opens the full player.
 */
function PlayerBarMini(handle: Handle<PlayerBar.MiniProps>) {
	return () => {
		let { actions, art, expand, mix, progress, subtitle, title, ...rest } = handle.props;
		let share = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
		return (
			<div
				{...rest}
				data-slot="player-bar-mini"
				mix={mergeMix(
					[
						raw({
							position: "relative",
							display: "flex",
							alignItems: "center",
							gap: "0.625rem",
							padding: "0.375rem",
							paddingInlineEnd: "0.25rem",
							overflow: "clip",
							borderRadius: "var(--ui-radius-lg, 0.625rem)",
							color: "var(--ui-neutral-fg)",
							backgroundColor:
								"var(--ui-player-bar-mini-bg, color-mix(in oklch, var(--ui-surface-raised, Canvas) 88%, var(--ui-brand-bg-solid)))",
							boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.35), 0 0 0 1px var(--ui-neutral-border)",
							"& [data-slot=player-bar-mini-expand-slot] > *": {
								position: "absolute",
								inset: "0",
								zIndex: "0",
								margin: "0",
								padding: "0",
								border: "0",
								background: "transparent",
								cursor: "pointer",
								borderRadius: "inherit",
							},
							"& [data-slot=player-bar-mini-expand-slot] > :focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "-2px",
							},
							"& > :not([data-slot=player-bar-mini-expand-slot], [data-slot=player-bar-mini-progress])":
								{
									position: "relative",
									zIndex: "1",
									pointerEvents: "none",
								},
							"& > [data-slot=player-bar-mini-actions]": {
								pointerEvents: "auto",
								display: "flex",
								alignItems: "center",
							},
						}),
					],
					mix,
				)}
			>
				<span data-slot="player-bar-mini-expand-slot">{expand}</span>
				{art === undefined ? null : <ArtFrame size="2.5rem">{art}</ArtFrame>}
				<span mix={[raw({ display: "grid", flex: "1", minInlineSize: "0" })]}>
					<span
						mix={[
							raw({
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
								fontSize: "0.875rem",
								lineHeight: "1.25rem",
								fontWeight: "600",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{title}
					</span>
					{subtitle === undefined ? null : (
						<span
							mix={[
								raw({
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									fontSize: "0.75rem",
									lineHeight: "1rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{subtitle}
						</span>
					)}
				</span>
				<span data-slot="player-bar-mini-actions">{actions}</span>
				<span
					aria-hidden="true"
					data-slot="player-bar-mini-progress"
					mix={[
						raw({
							position: "absolute",
							insetInline: "0.625rem",
							insetBlockEnd: "0",
							blockSize: "2px",
							borderRadius: "999px",
							backgroundColor: "color-mix(in oklch, currentColor 18%, transparent)",
							"& > span": {
								display: "block",
								blockSize: "100%",
								borderRadius: "inherit",
								backgroundColor: "var(--ui-neutral-fg-emphasis)",
							},
						}),
					]}
				>
					<span style={{ inlineSize: `${(share * 100).toFixed(2)}%` }} />
				</span>
			</div>
		);
	};
}

PlayerBar.Track = PlayerBarTrack;
PlayerBar.Button = PlayerBarButton;
PlayerBar.Range = PlayerBarRange;
PlayerBar.Seek = PlayerBarSeek;
PlayerBar.Mini = PlayerBarMini;
