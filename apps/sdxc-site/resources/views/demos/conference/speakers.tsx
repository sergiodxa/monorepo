/**
 * The twelve speakers as a wall of printed portraits: each a halftone bust in one ink with the
 * speaker's initials overprinted in the other, then the name, the job and the talk, linked to
 * the slot the schedule gives it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { LandingHeader, LandingSection } from "@sdxc/ui/landing";
import { css } from "remix/component";

import type { Speaker } from "~/resources/views/demos/conference/data";

import { SPEAKERS, talkSlot, TRACKS } from "~/resources/views/demos/conference/data";
import { BLEND, BLUE, DISPLAY, halftone, MONO, PINK } from "~/resources/views/demos/conference/ink";
import { renderNearView } from "~/resources/views/demos/near-view";

/**
 * Renders the band: four portraits across from the `lg` container, three from `md`, two on a
 * phone, so twelve speakers always fill whole rows.
 *
 * @returns The render function producing the band.
 */
export default function ConferenceSpeakers() {
	return () => (
		<LandingSection id="speakers" mix={[renderNearView(1740, 2666)]}>
			<LandingHeader
				eyebrow="Speakers · 12"
				layout="split"
				description={
					<>
						People who ship the features they talk about: browser engineers, accessibility leads and
						the teams who <strong>put new APIs in front of millions of users</strong>.
					</>
				}
				parts={{ title: [css({ textTransform: "uppercase" })] }}
			>
				Twelve people, no sales pitches
			</LandingHeader>
			<ul
				mix={css({
					listStyle: "none",
					margin: "0",
					padding: "0",
					display: "grid",
					gap: "2rem 1.25rem",
					gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
					"@container (min-width: 48rem)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
					"@container (min-width: 64rem)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
				})}
			>
				{SPEAKERS.map((person, index) => (
					<SpeakerCard key={person.id} person={person} index={index} />
				))}
			</ul>
		</LandingSection>
	);
}

/**
 * One speaker: the portrait, their name and job, and their talk with its time and room. The
 * inks swap from one card to the next, so neighbours never print alike.
 */
function SpeakerCard(handle: Handle<{ person: Speaker; index: number }>) {
	return () => {
		let { person, index } = handle.props;
		let slot = talkSlot(person.id);
		let pink = index % 2 === 0;
		return (
			<li
				id={`speaker-${person.id}`}
				mix={css({ display: "grid", alignContent: "start", gap: "0.75rem" })}
			>
				<Portrait
					name={person.name}
					dots={pink ? PINK : BLUE}
					letters={pink ? BLUE : PINK}
					index={index}
				/>
				<div mix={css({ display: "grid", gap: "0.25rem" })}>
					<h3
						mix={css({
							margin: "0",
							fontFamily: DISPLAY,
							fontWeight: "900",
							fontSynthesis: "none",
							fontSize: "clamp(1.375rem, 1.1rem + 1cqi, 1.875rem)",
							lineHeight: "1",
							textTransform: "uppercase",
						})}
					>
						{person.name}
					</h3>
					<p mix={css({ margin: "0", fontSize: "0.875rem" })}>{person.role}</p>
				</div>
				<a
					href={`#talk-${person.id}`}
					mix={css({
						display: "grid",
						gap: "0.25rem",
						paddingBlockStart: "0.625rem",
						borderBlockStart: `2px solid ${BLUE}`,
						color: "inherit",
						textDecoration: "none",
						"&:hover > span:first-child": { color: "var(--ui-brand-fg)" },
					})}
				>
					<span mix={css({ fontWeight: "700", lineHeight: "1.3", textWrap: "balance" })}>
						{person.talk}
					</span>
					{slot ? (
						<span
							mix={css({
								fontFamily: MONO,
								fontSize: "0.75rem",
								textTransform: "uppercase",
								letterSpacing: "0.06em",
							})}
						>
							{slot.time} · {TRACKS[slot.track].name}
						</span>
					) : null}
				</a>
			</li>
		);
	};
}

/**
 * A printed bust: a head and shoulders cut from a halftone screen in one ink, the initials set
 * huge in the other and overprinted, pushed off register by a different amount on each card.
 * Drawn entirely in CSS and hidden from assistive tech, since the name follows it.
 */
function Portrait(handle: Handle<{ name: string; dots: string; letters: string; index: number }>) {
	return () => {
		let { name, dots, letters, index } = handle.props;
		let initials = name
			.split(" ")
			.map((part) => part[0])
			.slice(0, 2)
			.join("");
		let shift = ((index * 37) % 9) - 4;
		return (
			<div
				aria-hidden="true"
				mix={css({
					position: "relative",
					aspectRatio: "4 / 5",
					overflow: "clip",
					containerType: "inline-size",
					boxShadow: `inset 0 0 0 2px ${BLUE}`,
				})}
			>
				<div
					mix={css({
						position: "absolute",
						inset: "0",
						background: halftone(dots, "6px"),
						maskImage: `radial-gradient(circle at ${50 + shift}% 36%, #000 0 21%, transparent 21.5%), radial-gradient(ellipse 46% 34% at ${50 + shift}% 100%, #000 0 99%, transparent 100%)`,
					})}
				/>
				<span
					mix={css({
						position: "absolute",
						insetInlineStart: `${6 + shift}%`,
						insetBlockEnd: "-0.12em",
						fontFamily: DISPLAY,
						fontWeight: "900",
						fontSynthesis: "none",
						fontSize: "62cqi",
						lineHeight: "1",
						color: letters,
						mixBlendMode: BLEND,
						textTransform: "uppercase",
					})}
				>
					{initials}
				</span>
			</div>
		);
	};
}
