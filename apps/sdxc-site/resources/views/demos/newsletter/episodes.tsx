/**
 * The listening band: the latest episode in the browser's own player with its chapters
 * and transcript, then the three before it as a plain list. Every time and title is a
 * link, so the band plays and navigates with no script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { RssIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { m, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Heading, Link } from "@sdxc/ui";
import { EpisodePlayer, formatEpisodeTime, LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { renderNearView } from "~/resources/views/demos/near-view";
import {
	EPISODES,
	LATEST_AUDIO,
	LATEST_CAPTIONS,
	LATEST_CHAPTERS,
	LATEST_TRANSCRIPT,
} from "~/resources/views/demos/newsletter/episodes-data";

/** The latest episode, which the player plays. */
const [LATEST, ...EARLIER] = EPISODES;

/**
 * Renders the earlier episodes as a ruled list: the number and title as the link, the
 * guest under it, and the date and running time set in tabular figures on the right.
 */
function EarlierEpisodes() {
	return () => (
		<div mix={[raw({ marginBlockStart: "3rem" })]}>
			<Heading mix={[raw({ margin: "0 0 1rem", fontSize: "1.0625rem", fontWeight: "600" })]}>
				Earlier episodes
			</Heading>
			<ol
				mix={[
					m(0),
					p(0),
					raw({ listStyle: "none", borderBlockStart: "1px solid var(--ui-landing-hairline)" }),
				]}
			>
				{EARLIER.map((episode) => (
					<li
						key={episode.number}
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								justifyContent: "space-between",
								gap: "0.25rem 1.5rem",
								paddingBlock: "0.875rem",
								borderBlockEnd: "1px solid var(--ui-landing-hairline)",
							}),
						]}
					>
						<div mix={[raw({ minInlineSize: "0", flex: "1 1 18rem" })]}>
							<a
								href={`/examples/newsletter/episodes/${episode.number}`}
								mix={[fg("neutral.emphasis"), weight("medium"), raw({ textDecoration: "none" })]}
							>
								<span mix={[fg("neutral.muted"), raw({ fontVariantNumeric: "tabular-nums" })]}>
									{episode.number}.
								</span>{" "}
								{episode.title}
							</a>
							<p mix={[m(0), text("sm"), fg("neutral.muted")]}>{episode.guest}</p>
						</div>
						<p
							mix={[
								m(0),
								text("sm"),
								fg("neutral.muted"),
								raw({ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }),
							]}
						>
							<time dateTime={episode.dateTime}>{episode.date}</time> ·{" "}
							{formatEpisodeTime(episode.duration)}
						</p>
					</li>
				))}
			</ol>
		</div>
	);
}

/**
 * Renders the band's header, the player for the latest episode, and the earlier ones. The
 * note under the player says plainly that this page's audio is a placeholder.
 *
 * @returns The render function producing the band.
 */
export default function NewsletterEpisodes() {
	return () => (
		<LandingSection id="listen" ruled mix={[renderNearView(1150, 1500)]}>
			<LandingHeader
				eyebrow="Listen"
				description={
					<>
						Each episode is the letter read aloud, then the conversation it came from.{" "}
						<strong>Chapters and a full transcript</strong> come with every one.
					</>
				}
			>
				Hear the letter, with the people in it
			</LandingHeader>
			<EpisodePlayer
				src={LATEST_AUDIO}
				type="audio/mpeg"
				captions={{ src: LATEST_CAPTIONS, srclang: "en", label: "English" }}
				title={LATEST?.title}
				meta={
					<>
						Episode {LATEST?.number} · {LATEST?.guest} · {formatEpisodeTime(LATEST?.duration ?? 0)}
					</>
				}
				chapters={LATEST_CHAPTERS}
				transcript={LATEST_TRANSCRIPT}
				chaptersLabel="Chapters"
				transcriptLabel="Read the transcript"
				fallback={<a href={LATEST_AUDIO}>Download the episode</a>}
				note={
					<span mix={[text("sm")]}>
						This demo’s audio is a placeholder: a chime where each chapter starts, and quiet
						between.
					</span>
				}
				mix={[raw({ marginBlockStart: "2.5rem" })]}
			/>
			<EarlierEpisodes />
			<p mix={[m(0), raw({ marginBlockStart: "1.5rem" }), text("sm"), fg("neutral")]}>
				<Link
					href="/examples/newsletter/feed.xml"
					mix={[
						raw({ display: "inline-flex", alignItems: "center", gap: "0.5rem" }),
						weight("medium"),
					]}
				>
					<RssIcon aria-hidden="true" mix={[raw({ inlineSize: "1rem", blockSize: "1rem" })]} />
					Follow in any podcast app
				</Link>
			</p>
		</LandingSection>
	);
}
