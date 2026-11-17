/**
 * A title's page: its hero with the action that fits where the viewer is (play, or resume
 * the episode they left), the season picked in the address with its episodes, more like it,
 * and the people who made it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { EpisodeList } from "@sdxc/ui/video";

import type { Progress, Season, Title } from "./data";
import type { Viewer } from "./state";

import { KeyArt, stillFrame } from "./art";
import { CONTINUE, genreNames, similarTitles, visibleTitles, watchHref } from "./data";
import { Billboard, Chips, Gutter, ListFrame, PlayButton, TitleShelf } from "./parts";

namespace TitlePage {
	export interface Props {
		title: Title;
		viewer: Viewer;
		/** The season the address picks; the first when it names none or one the title lacks. */
		season: Season | undefined;
		/** The page path the My List post returns to. */
		back: string;
	}
}

/**
 * Where the viewer is in this title, if anywhere.
 *
 * @returns The profile's progress entry for the title.
 */
export function progressFor(viewer: Viewer, title: Title): Progress | undefined {
	return (CONTINUE[viewer.profile.id] ?? []).find((entry) => entry.title === title.id);
}

/** The primary action: resume where the viewer left off, or play from the start. */
function primaryAction(
	title: Title,
	progress: Progress | undefined,
): { href: string; label: string } {
	if (progress === undefined) {
		return {
			href: watchHref(title),
			label: title.kind === "series" ? "Play S1:E1" : "Play",
		};
	}
	if (progress.season === undefined || progress.episode === undefined) {
		return { href: watchHref(title), label: "Resume" };
	}
	return {
		href: watchHref(title, progress.season, progress.episode),
		label: `Resume S${progress.season}:E${progress.episode}`,
	};
}

/**
 * How much of an episode the viewer has seen: everything before the one they are on, that
 * one's share, and nothing after.
 */
function watchedShare(
	progress: Progress | undefined,
	season: number,
	episode: number,
): number | undefined {
	if (progress?.season === undefined || progress.episode === undefined) return undefined;
	if (season < progress.season || (season === progress.season && episode < progress.episode))
		return 1;
	if (season === progress.season && episode === progress.episode) return progress.share;
	return undefined;
}

/** What a screen reader hears for an episode's bar. */
function watchedLabel(share: number | undefined): string | undefined {
	if (share === undefined) return undefined;
	return share === 1 ? "Watched" : `${Math.round(share * 100)}% watched`;
}

/** Renders the title's page. */
export default function TitlePage(handle: Handle<TitlePage.Props>) {
	return () => {
		let { back, season, title, viewer } = handle.props;
		let progress = progressFor(viewer, title);
		let action = primaryAction(title, progress);
		return (
			<div mix={[raw({ display: "grid", gap: "clamp(2rem, 4vw, 3rem)" })]}>
				<Billboard
					title={title}
					level={1}
					size="title"
					eyebrow={title.original ? "Vesper Original" : undefined}
					actions={
						<>
							<PlayButton href={action.href} label={action.label} />
							<ListFrame title={title} back={back} />
						</>
					}
				>
					{title.synopsis}
				</Billboard>
				{season === undefined ? null : (
					<Episodes title={title} season={season} progress={progress} />
				)}
				<TitleShelf
					id="similar"
					title="More like this"
					titles={similarTitles(title, visibleTitles(viewer.profile))}
				/>
				<About title={title} />
			</div>
		);
	};
}

namespace Episodes {
	export interface Props {
		title: Title;
		season: Season;
		progress: Progress | undefined;
	}
}

/** The episodes section: the season picker as links in the address, then the season's list. */
function Episodes(handle: Handle<Episodes.Props>) {
	return () => {
		let { progress, season, title } = handle.props;
		let seasons = title.seasons ?? [];
		return (
			<section aria-labelledby="vesper-episodes">
				<Gutter>
					<div
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								alignItems: "center",
								justifyContent: "space-between",
								gap: "0.75rem 1.5rem",
								marginBlockEnd: "0.75rem",
							}),
						]}
					>
						<h2
							id="vesper-episodes"
							mix={[
								raw({ margin: "0", fontSize: "1.375rem", color: "var(--ui-neutral-fg-emphasis)" }),
							]}
						>
							Episodes
						</h2>
						{seasons.length > 1 ? (
							<Chips
								label="Seasons"
								chips={seasons.map((entry) => ({
									label: `Season ${entry.number}`,
									page: `title/${title.id}?season=${entry.number}`,
									current: entry.number === season.number,
								}))}
							/>
						) : (
							<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
								Season {season.number} · {season.year}
							</span>
						)}
					</div>
					<EpisodeList
						aria-label={`${title.name}, season ${season.number}`}
						mix={[raw({ marginInline: "-0.75rem", maxInlineSize: "64rem" })]}
					>
						{season.episodes.map((episode) => {
							let share = watchedShare(progress, season.number, episode.number);
							let current =
								progress?.season === season.number && progress.episode === episode.number;
							return (
								<EpisodeList.Item
									href={watchHref(title, season.number, episode.number)}
									number={episode.number}
									title={episode.title}
									still={
										<KeyArt
											title={title}
											frame={stillFrame(season.number, episode.number)}
											named={false}
										/>
									}
									duration={`${episode.minutes}m`}
									synopsis={episode.synopsis}
									progress={share}
									progressLabel={watchedLabel(share)}
									current={current}
								/>
							);
						})}
					</EpisodeList>
				</Gutter>
			</section>
		);
	};
}

/** The title's credits and facts as label and value rows. */
function About(handle: Handle<{ title: Title }>) {
	return () => {
		let { title } = handle.props;
		let rows: Array<[string, string]> = [
			[title.kind === "film" ? "Directed by" : "Created by", title.creators.join(", ")],
			["Starring", title.cast.join(", ")],
			["Genres", genreNames(title).join(", ")],
			["Rating", title.rating],
			["About", title.tagline],
		];
		return (
			<section aria-labelledby="vesper-about">
				<Gutter>
					<h2
						id="vesper-about"
						mix={[
							raw({
								margin: "0 0 1rem",
								fontSize: "1.375rem",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						About {title.name}
					</h2>
					<dl
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "max-content minmax(0, 1fr)",
								gap: "0.625rem 1.5rem",
								margin: "0",
								maxInlineSize: "48rem",
								fontSize: "0.9375rem",
								lineHeight: "1.5",
							}),
						]}
					>
						{rows.map(([label, value]) => (
							<>
								<dt mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>{label}</dt>
								<dd mix={[raw({ margin: "0", color: "var(--ui-neutral-fg)" })]}>{value}</dd>
							</>
						))}
					</dl>
				</Gutter>
			</section>
		);
	};
}
