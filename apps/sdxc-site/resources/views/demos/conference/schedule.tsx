/**
 * The day as a timeline: one row per slot, the time set large down the left, the main stage
 * in a pink column and the side stage in a blue one, with breaks running across both. On a
 * phone, three radios pick both rooms or one, by CSS alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { LandingHeader, LandingSection } from "@sdxc/ui/landing";
import { css } from "remix/component";

import type { Slot, Talk, Track } from "~/resources/views/demos/conference/data";

import { SLOTS, speaker, TRACKS } from "~/resources/views/demos/conference/data";
import { BLUE, DISPLAY, MONO, PINK } from "~/resources/views/demos/conference/ink";
import { renderNearView } from "~/resources/views/demos/near-view";

/** The name the track radios share, unique on the page. */
const FILTER_NAME = "overprint-track";

/** The narrow layout, where the rooms stack and the track filter shows. */
const NARROW = "@container overprint-schedule (max-width: 47.99rem)";

/** The wide layout, where the rooms sit side by side. */
const WIDE = "@container overprint-schedule (min-width: 48rem)";

/**
 * Renders the schedule band.
 *
 * @returns The render function producing the band.
 */
export default function ConferenceSchedule() {
	return () => (
		<LandingSection id="schedule" mix={[renderNearView(1900, 3300)]}>
			<LandingHeader
				eyebrow="Thursday 15 April · Programme"
				layout="split"
				description={
					<>
						Two rooms run side by side from 09:30, and every break is shared, so{" "}
						<strong>you never miss coffee to catch a talk</strong>. All times are Rotterdam time.
					</>
				}
				parts={{ title: [css({ textTransform: "uppercase" })] }}
			>
				Two rooms, one day
			</LandingHeader>
			<div
				data-slot="overprint-schedule"
				mix={css({
					containerType: "inline-size",
					containerName: "overprint-schedule",
					display: "grid",
					gap: "1.5rem",
				})}
			>
				<TrackFilter />
				<ol
					aria-label="The day's sessions"
					mix={css({
						listStyle: "none",
						margin: "0",
						padding: "0",
						borderBlockStart: `3px solid ${BLUE}`,
					})}
				>
					{SLOTS.map((slot) => (
						<SlotRow key={slot.time} slot={slot} />
					))}
				</ol>
			</div>
		</LandingSection>
	);
}

/**
 * The phone's room picker: three radios in a ruled strip. It shows only in the narrow layout,
 * where both rooms would otherwise stack into one long list.
 */
function TrackFilter() {
	return () => (
		<fieldset
			mix={css({
				margin: "0",
				padding: "0",
				border: "0",
				minInlineSize: "0",
				[WIDE]: { display: "none" },
			})}
		>
			<legend
				mix={css({
					marginBlockEnd: "0.5rem",
					padding: "0",
					fontFamily: MONO,
					fontSize: "0.75rem",
					fontWeight: "700",
					textTransform: "uppercase",
					letterSpacing: "0.1em",
				})}
			>
				Show
			</legend>
			<div
				mix={css({
					display: "grid",
					gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
					border: `2px solid ${BLUE}`,
				})}
			>
				<TrackOption value="both" label="Both rooms" checked />
				<TrackOption value="main" label={TRACKS.main.name} />
				<TrackOption value="side" label={TRACKS.side.name} />
			</div>
		</fieldset>
	);
}

/** One option of {@link TrackFilter}: a hidden radio whose label fills with ink when picked. */
function TrackOption(handle: Handle<{ value: "both" | Track; label: string; checked?: boolean }>) {
	return () => {
		let { value, label, checked } = handle.props;
		let ink = value === "main" ? PINK : BLUE;
		return (
			<label
				mix={css({
					position: "relative",
					display: "grid",
					placeItems: "center",
					minBlockSize: "2.75rem",
					paddingInline: "0.25rem",
					textAlign: "center",
					fontFamily: MONO,
					fontSize: "0.8125rem",
					fontWeight: "700",
					textTransform: "uppercase",
					cursor: "pointer",
					"& + &": { borderInlineStart: `2px solid ${BLUE}` },
					"&:has(:checked)": { backgroundColor: ink, color: "var(--ui-bg)" },
					"&:has(:focus-visible)": { outline: `3px solid ${PINK}`, outlineOffset: "2px" },
				})}
			>
				<input
					type="radio"
					name={FILTER_NAME}
					value={value}
					defaultChecked={checked}
					mix={css({
						position: "absolute",
						inset: "0",
						opacity: "0",
						margin: "0",
						cursor: "pointer",
					})}
				/>
				{label}
			</label>
		);
	};
}

/**
 * One slot: the time, then the two rooms side by side, or one item both rooms share across
 * them. Rows share one column template, so every room lines up down the day.
 */
function SlotRow(handle: Handle<{ slot: Slot }>) {
	return () => {
		let { slot } = handle.props;
		return (
			<li
				mix={css({
					display: "grid",
					gap: "0.75rem 1.5rem",
					paddingBlock: "1.25rem",
					borderBlockEnd: `1px solid ${BLUE}`,
					gridTemplateColumns: "4.75rem minmax(0, 1fr)",
					[WIDE]: { gridTemplateColumns: "7.5rem minmax(0, 1fr) minmax(0, 1fr)" },
				})}
			>
				<time
					dateTime={`2027-04-15T${slot.time}+02:00`}
					mix={css({
						fontFamily: DISPLAY,
						fontWeight: "900",
						fontSynthesis: "none",
						fontSize: "clamp(1.75rem, 1.2rem + 2cqi, 2.75rem)",
						lineHeight: "0.9",
						fontVariantNumeric: "tabular-nums",
					})}
				>
					{slot.time}
				</time>
				{"shared" in slot ? (
					<SharedCell title={slot.shared.title} note={slot.shared.note} />
				) : (
					<>
						<TalkCell track="main" talk={slot.main} />
						{"speaker" in slot.side ? (
							<TalkCell track="side" talk={slot.side} />
						) : (
							<NoteCell track="side" title={slot.side.title} note={slot.side.note} />
						)}
					</>
				)}
			</li>
		);
	};
}

/** The room label above a talk, in the room's ink, and only in the narrow layout. */
function RoomTag(handle: Handle<{ track: Track }>) {
	return () => {
		let { track } = handle.props;
		return (
			<span
				mix={css({
					fontFamily: MONO,
					fontSize: "0.75rem",
					fontWeight: "700",
					textTransform: "uppercase",
					letterSpacing: "0.08em",
					color: track === "main" ? "var(--ui-brand-fg)" : BLUE,
				})}
			>
				{TRACKS[track].name}
			</span>
		);
	};
}

/**
 * A talk in one room: its title, the speaker linked to their card, the length, and a keynote
 * stamp. Its id is the speaker's talk anchor, which their card links to.
 */
function TalkCell(handle: Handle<{ track: Track; talk: Talk }>) {
	return () => {
		let { track, talk } = handle.props;
		let person = speaker(talk.speaker);
		let ink = track === "main" ? PINK : BLUE;
		return (
			<article
				id={`talk-${person.id}`}
				data-track={track}
				mix={css({
					display: "grid",
					alignContent: "start",
					gap: "0.375rem",
					gridColumn: "2",
					paddingInlineStart: "0.875rem",
					borderInlineStart: `6px solid ${ink}`,
					[WIDE]: { gridColumn: track === "main" ? "2" : "3" },
					[NARROW]: {
						'[data-slot="overprint-schedule"]:has(input[value="main"]:checked) &[data-track="side"]':
							{
								display: "none",
							},
						'[data-slot="overprint-schedule"]:has(input[value="side"]:checked) &[data-track="main"]':
							{
								display: "none",
							},
					},
				})}
			>
				<span
					mix={css({
						display: "flex",
						flexWrap: "wrap",
						gap: "0.25rem 0.75rem",
						alignItems: "center",
					})}
				>
					<RoomTag track={track} />
					{talk.keynote ? (
						<span
							mix={css({
								paddingInline: "0.375rem",
								backgroundColor: PINK,
								color: "oklch(0.18 0.05 264)",
								fontFamily: MONO,
								fontSize: "0.6875rem",
								fontWeight: "700",
								textTransform: "uppercase",
								letterSpacing: "0.08em",
							})}
						>
							Keynote
						</span>
					) : null}
				</span>
				<h3
					mix={css({
						margin: "0",
						fontSize: "1.1875rem",
						fontWeight: "700",
						lineHeight: "1.25",
						textWrap: "balance",
					})}
				>
					{person.talk}
				</h3>
				<p mix={css({ margin: "0", fontSize: "0.9375rem" })}>
					<a
						href={`#speaker-${person.id}`}
						mix={css({ color: "inherit", textUnderlineOffset: "0.15em" })}
					>
						{person.name}
					</a>
					<span mix={css({ fontFamily: MONO, fontSize: "0.8125rem" })}> · {talk.minutes} min</span>
				</p>
			</article>
		);
	};
}

/** A session in one room that is not a talk, such as the streamed keynote or the speaker Q&A. */
function NoteCell(handle: Handle<{ track: Track; title: string; note: string }>) {
	return () => {
		let { track, title, note } = handle.props;
		return (
			<div
				data-track={track}
				mix={css({
					display: "grid",
					alignContent: "start",
					gap: "0.375rem",
					gridColumn: "2",
					paddingInlineStart: "0.875rem",
					borderInlineStart: `6px dotted ${BLUE}`,
					[WIDE]: { gridColumn: "3" },
					[NARROW]: {
						'[data-slot="overprint-schedule"]:has(input[value="main"]:checked) &[data-track="side"]':
							{
								display: "none",
							},
						'[data-slot="overprint-schedule"]:has(input[value="side"]:checked) &[data-track="main"]':
							{
								display: "none",
							},
					},
				})}
			>
				<RoomTag track={track} />
				<p mix={css({ margin: "0", fontSize: "1.0625rem", fontWeight: "700", lineHeight: "1.25" })}>
					{title}
				</p>
				<p mix={css({ margin: "0", fontSize: "0.9375rem" })}>{note}</p>
			</div>
		);
	};
}

/** Doors, breaks, lunch and the party: one line across both rooms, printed as a halftone strip. */
function SharedCell(handle: Handle<{ title: string; note: string }>) {
	return () => {
		let { title, note } = handle.props;
		return (
			<div
				mix={css({
					display: "flex",
					flexWrap: "wrap",
					alignItems: "baseline",
					gap: "0.25rem 1rem",
					gridColumn: "2",
					alignSelf: "center",
					[WIDE]: { gridColumn: "2 / -1" },
				})}
			>
				<p
					mix={css({
						margin: "0",
						fontFamily: DISPLAY,
						fontWeight: "900",
						fontSynthesis: "none",
						fontSize: "clamp(1.375rem, 1rem + 1.5cqi, 2rem)",
						lineHeight: "1",
						textTransform: "uppercase",
						color: "var(--ui-brand-fg)",
					})}
				>
					{title}
				</p>
				<p mix={css({ margin: "0", fontSize: "0.9375rem" })}>{note}</p>
			</div>
		);
	};
}
