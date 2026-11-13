/**
 * Last year's talks as a wall of video stills printed in two inks: the most watched one large,
 * eight around it, each a frame with its running time and a play mark, linked to the recording.
 * Every still is drawn in CSS, a halftone of one ink graded over a flat of the other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { LinkButton } from "@sdxc/ui";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";
import { css } from "remix/component";

import type { PastTalk } from "~/resources/views/demos/conference/data";

import { PAST_TALKS } from "~/resources/views/demos/conference/data";
import { BLUE, DISPLAY, halftone, MONO, PAPER, PINK } from "~/resources/views/demos/conference/ink";
import { renderNearView } from "~/resources/views/demos/near-view";

/**
 * Renders the band: four columns from the `lg` container with the first talk two by two, two
 * columns on a phone with the first across both, so nine stills always fill whole rows.
 *
 * @returns The render function producing the band.
 */
export default function ConferenceTalks() {
	return () => (
		<LandingSection id="talks" mix={[renderNearView(890, 1282)]}>
			<LandingHeader
				eyebrow="Overprint 2026 · On video"
				layout="split"
				description={
					<>
						Every talk from last year, captioned and free to watch.{" "}
						<strong>This year's go up within a week</strong> of the day, and ticket holders get them
						the same night.
					</>
				}
				action={
					<LinkButton
						href="/examples/overprint/videos"
						variant="surface"
						mix={[landingCtaChrome()]}
					>
						All 2026 videos
					</LinkButton>
				}
				parts={{ title: [css({ textTransform: "uppercase" })] }}
			>
				Last year, on the wall
			</LandingHeader>
			<ul
				mix={css({
					listStyle: "none",
					margin: "0",
					padding: "0",
					display: "grid",
					gap: "1.25rem",
					gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
					"@container (min-width: 64rem)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
				})}
			>
				{PAST_TALKS.map((talk, index) => (
					<VideoTile key={talk.slug} talk={talk} index={index} />
				))}
			</ul>
		</LandingSection>
	);
}

/** One recording: the still, then its title and speaker, the whole tile one link. */
function VideoTile(handle: Handle<{ talk: PastTalk; index: number }>) {
	return () => {
		let { talk, index } = handle.props;
		let lead = index === 0;
		return (
			<li
				mix={css({
					display: "flex",
					gridColumn: lead ? "span 2" : "auto",
					"@container (min-width: 64rem)": { gridRow: lead ? "span 2" : "auto" },
				})}
			>
				<a
					href={`/examples/overprint/videos/${talk.slug}`}
					mix={css({
						flex: "1",
						display: "flex",
						flexDirection: "column",
						gap: "0.625rem",
						color: "inherit",
						textDecoration: "none",
						"&:hover [data-slot='talk-title']": { color: "var(--ui-brand-fg)" },
						"&:focus-visible": { outline: `3px solid ${PINK}`, outlineOffset: "3px" },
					})}
				>
					<Still index={index} length={talk.length} lead={lead} />
					<span mix={css({ display: "grid", gap: "0.125rem" })}>
						<span
							data-slot="talk-title"
							mix={css({
								fontWeight: "700",
								fontSize: lead ? "1.375rem" : "1rem",
								lineHeight: "1.25",
								textWrap: "balance",
							})}
						>
							{talk.title}
						</span>
						<span mix={css({ fontSize: "0.875rem" })}>
							{talk.speaker}
							<span
								mix={css({ position: "absolute", clipPath: "inset(50%)", whiteSpace: "nowrap" })}
							>
								, {talk.length}
							</span>
						</span>
					</span>
				</a>
			</li>
		);
	};
}

/**
 * A video still in two inks: a flat of one, a graded halftone of the other at an angle that
 * turns from tile to tile, the talk's number huge, a play mark and the running time.
 */
function Still(handle: Handle<{ index: number; length: string; lead: boolean }>) {
	return () => {
		let { index, length, lead } = handle.props;
		let base = index % 2 === 0 ? BLUE : PINK;
		let dots = index % 2 === 0 ? PINK : BLUE;
		let angle = (index * 67) % 360;
		return (
			<span
				aria-hidden="true"
				mix={css({
					position: "relative",
					display: "block",
					flex: "1",
					minBlockSize: "0",
					aspectRatio: "16 / 9",
					overflow: "clip",
					containerType: "size",
					backgroundColor: base,
				})}
			>
				<span
					mix={css({
						position: "absolute",
						inset: "0",
						background: halftone(dots, lead ? "10px" : "7px"),
						maskImage: `linear-gradient(${angle}deg, #000 10%, transparent 75%)`,
					})}
				/>
				<span
					mix={css({
						position: "absolute",
						insetInlineStart: "4%",
						insetBlockEnd: "-0.1em",
						fontFamily: DISPLAY,
						fontWeight: "900",
						fontSynthesis: "none",
						fontSize: "48cqb",
						lineHeight: "1",
						color: PAPER,
					})}
				>
					{String(index + 1).padStart(2, "0")}
				</span>
				<span
					mix={css({
						position: "absolute",
						insetBlockStart: "50%",
						insetInlineStart: "50%",
						translate: "-50% -50%",
						display: "grid",
						placeItems: "center",
						inlineSize: lead ? "4.5rem" : "2.75rem",
						aspectRatio: "1",
						borderRadius: "50%",
						backgroundColor: PAPER,
					})}
				>
					<svg viewBox="0 0 10 10" width="40%" height="40%">
						<path d="M 2.5 1 L 9 5 L 2.5 9 Z" fill={base} />
					</svg>
				</span>
				<span
					mix={css({
						position: "absolute",
						insetBlockEnd: "0.5rem",
						insetInlineEnd: "0.5rem",
						paddingInline: "0.375rem",
						backgroundColor: PAPER,
						color: BLUE,
						fontFamily: MONO,
						fontSize: "0.75rem",
						fontWeight: "700",
						fontVariantNumeric: "tabular-nums",
					})}
				>
					{length}
				</span>
			</span>
		);
	};
}
