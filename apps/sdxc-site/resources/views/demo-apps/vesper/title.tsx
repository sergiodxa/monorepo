/**
 * A title's page over its own art: the name, facts and synopsis with the action that fits where
 * the viewer is (play, or resume the episode they left), then tabs kept in the address for the
 * season's episodes, titles like it, and its details.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { CheckIcon, ChevronDownIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { Menu } from "@sdxc/ui";
import { EpisodeList } from "@sdxc/ui/video";

import type { Progress, Season, Title } from "./data";
import type { Viewer } from "./state";

import { KeyArt, stillFrame } from "./art";
import {
	CONTINUE,
	formatMinutes,
	genreNames,
	href,
	lengthLabel,
	similarTitles,
	visibleTitles,
	watchHref,
} from "./data";
import { HERO_LETTERING, ListFrame, PlayButton, RankLine, TitleCard } from "./parts";
import { GUTTER, TOP_BAR } from "./shell";

namespace TitlePage {
	export interface Props {
		title: Title;
		viewer: Viewer;
		/** The season the address picks; the first when it names none or one the title lacks. */
		season: Season | undefined;
		/** The tab the address picks. */
		tab: TitleTab;
		/** The page path the My List post returns to. */
		back: string;
	}
}

/** The sections a title's page swaps between, kept in the address as `?tab=`. */
export type TitleTab = "episodes" | "more" | "details";

/**
 * The tab an address asks for, falling back to the episodes of a series or the suggestions for
 * a film, and never the episodes of a film.
 */
export function titleTab(title: Title, asked: string | null): TitleTab {
	if (asked === "more" || asked === "details") return asked;
	if (asked === "episodes" && title.kind === "series") return "episodes";
	return title.kind === "series" ? "episodes" : "more";
}

/** What each age rating means, as the details tab spells it out. */
const RATING_MEANING: Record<string, string> = {
	"All ages": "Suitable for every age",
	"13+": "Recommended for ages 13 and up",
	"16+": "Recommended for ages 16 and up",
	"18+": "For adults only",
};

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
		let { back, season, tab, title, viewer } = handle.props;
		let progress = progressFor(viewer, title);
		let action = primaryAction(title, progress);
		let id = `vesper-hero-${title.id}`;
		return (
			<article
				aria-labelledby={id}
				mix={[
					raw({
						containerType: "inline-size",
						position: "relative",
						isolation: "isolate",
						marginBlockStart: `calc(-1 * ${TOP_BAR})`,
						paddingBlock: `calc(${TOP_BAR} + clamp(2rem, 8vh, 5rem)) 3rem`,
						paddingInline: GUTTER,
					}),
				]}
			>
				<Backdrop title={title} />
				<div mix={[raw({ display: "grid", gap: "1.125rem", maxInlineSize: "42rem" })]}>
					{title.original ? (
						<span
							mix={[
								raw({
									fontSize: "0.75rem",
									fontWeight: "700",
									letterSpacing: "0.28em",
									textTransform: "uppercase",
									color: "var(--ui-color-brand-300)",
								}),
							]}
						>
							Vesper Original
						</span>
					) : null}
					<h1
						id={id}
						mix={[
							raw({
								margin: "0",
								fontSize: "clamp(2.5rem, 7cqi, 5rem)",
								lineHeight: "0.95",
								color: "oklch(0.98 0.01 85)",
								textWrap: "balance",
								textShadow: "0 2px 24px rgb(0 0 0 / 0.5)",
								...HERO_LETTERING[title.lettering],
							}),
						]}
					>
						{title.name}
					</h1>
					<div mix={[raw({ display: "grid", gap: "0.5rem" })]}>
						<p mix={[raw({ display: "flex", gap: "0.375rem", margin: "0" })]}>
							<Badge>{title.rating}</Badge>
							<Badge>HD</Badge>
							<Badge>CC</Badge>
						</p>
						<p mix={[raw({ margin: "0", fontSize: "0.9375rem", color: "var(--ui-neutral-fg)" })]}>
							{[title.year, lengthLabel(title), genreNames(title).join(", ")].join(" • ")}
						</p>
					</div>
					<RankLine title={title} />
					<p
						mix={[
							raw({
								margin: "0",
								fontSize: "clamp(1rem, 2.2cqi, 1.1875rem)",
								lineHeight: "1.6",
								color: "var(--ui-neutral-fg-emphasis)",
								textWrap: "pretty",
								textShadow: "0 1px 10px rgb(0 0 0 / 0.6)",
							}),
						]}
					>
						{title.synopsis}
					</p>
					<div
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								alignItems: "center",
								gap: "0.75rem",
								marginBlockStart: "0.5rem",
							}),
						]}
					>
						<PlayButton href={action.href} label={action.label} />
						<ListFrame title={title} back={back} compact />
					</div>
				</div>
				<TitleTabs title={title} tab={tab} season={season} />
				<div mix={[raw({ paddingBlockStart: "1.75rem" })]}>
					{tab === "episodes" && season !== undefined ? (
						<Episodes title={title} season={season} progress={progress} />
					) : null}
					{tab === "more" ? <MoreLikeThis title={title} viewer={viewer} /> : null}
					{tab === "details" ? <Details title={title} /> : null}
				</div>
			</article>
		);
	};
}

/**
 * The title's art behind the whole page, fading into the page toward the text and the foot,
 * so the tabs and their content sit on the picture as they scroll up over it.
 */
function Backdrop(handle: Handle<{ title: Title }>) {
	return () => (
		<div
			aria-hidden="true"
			mix={[
				raw({
					position: "absolute",
					insetInline: "0",
					insetBlockStart: "0",
					blockSize: "min(100vh, 64rem)",
					zIndex: "-1",
					overflow: "clip",
					"&::after": {
						content: '""',
						position: "absolute",
						inset: "0",
						background:
							"linear-gradient(to right, var(--ui-bg) 0%, color-mix(in oklch, var(--ui-bg), transparent 25%) 35%, transparent 70%), linear-gradient(to top, var(--ui-bg) 0%, color-mix(in oklch, var(--ui-bg), transparent 35%) 35%, transparent 70%)",
					},
				}),
			]}
		>
			<KeyArt title={handle.props.title} named={false} priority />
		</div>
	);
}

/** A filled chip for a rating or a format, the way the facts mark them. */
function Badge(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<span
			mix={[
				raw({
					paddingInline: "0.375rem",
					borderRadius: "0.25rem",
					fontSize: "0.8125rem",
					fontWeight: "700",
					lineHeight: "1.5rem",
					color: "var(--ui-neutral-fg-emphasis)",
					backgroundColor: "rgb(255 255 255 / 0.16)",
				}),
			]}
		>
			{handle.props.children}
		</span>
	);
}

/**
 * The tabs that swap the page's lower half, each a link that puts its tab in the address, so a
 * tab is a link a visitor can send and Back returns to the last one.
 */
function TitleTabs(handle: Handle<{ title: Title; tab: TitleTab; season: Season | undefined }>) {
	return () => {
		let { season, tab, title } = handle.props;
		let seasonQuery = season === undefined || season.number === 1 ? "" : `&season=${season.number}`;
		let tabs: Array<{ id: TitleTab; label: string }> = [
			...(title.kind === "series" ? [{ id: "episodes" as const, label: "Episodes" }] : []),
			{ id: "more", label: "More like this" },
			{ id: "details", label: "Details" },
		];
		return (
			<nav
				aria-label={`${title.name} sections`}
				mix={[
					raw({
						display: "flex",
						gap: "clamp(1.25rem, 4cqi, 3rem)",
						marginBlockStart: "clamp(2rem, 6vh, 3.5rem)",
						borderBlockEnd: "1px solid rgb(255 255 255 / 0.14)",
						overflowX: "auto",
						scrollbarWidth: "none",
					}),
				]}
			>
				{tabs.map((entry) => (
					<a
						href={href(
							`title/${title.id}?tab=${entry.id}${entry.id === "episodes" ? seasonQuery : ""}`,
						)}
						aria-current={entry.id === tab ? "page" : undefined}
						mix={[
							raw({
								position: "relative",
								flexShrink: "0",
								paddingBlock: "0.875rem",
								fontSize: "clamp(0.9375rem, 2cqi, 1.125rem)",
								fontWeight: "600",
								letterSpacing: "0.12em",
								textTransform: "uppercase",
								color: "var(--ui-neutral-fg-muted)",
								textDecoration: "none",
								"&::after": {
									content: '""',
									position: "absolute",
									insetInline: "0",
									insetBlockEnd: "-1px",
									blockSize: "3px",
									borderRadius: "3px",
									backgroundColor: "var(--ui-neutral-fg-emphasis)",
									scale: "0 1",
									transition: "scale 180ms ease",
								},
							}),
							when("&:hover", raw({ color: "var(--ui-neutral-fg)" })),
							when(
								"&[aria-current='page']",
								raw({ color: "var(--ui-neutral-fg-emphasis)", "&::after": { scale: "1 1" } }),
							),
							when(
								"&:focus-visible",
								raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
							),
							motionReduce(raw({ "&::after": { transition: "none" } })),
						]}
					>
						{entry.label}
					</a>
				))}
			</nav>
		);
	};
}

/** Everything about the title in three columns: what it is, its facts, and who made it. */
function Details(handle: Handle<{ title: Title }>) {
	return () => {
		let { title } = handle.props;
		return (
			<section
				aria-label="Details"
				mix={[
					raw({
						display: "grid",
						gap: "1.5rem 3rem",
						"@container (min-width: 52rem)": {
							gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)",
						},
					}),
				]}
			>
				<div mix={[raw({ display: "grid", alignContent: "start", gap: "0.875rem" })]}>
					<h2
						mix={[
							raw({ margin: "0", fontSize: "1.375rem", color: "var(--ui-neutral-fg-emphasis)" }),
						]}
					>
						{title.name}
					</h2>
					<p
						mix={[
							raw({
								margin: "0",
								fontSize: "1.0625rem",
								lineHeight: "1.7",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{title.synopsis}
					</p>
					<p mix={[raw({ margin: "0", lineHeight: "1.6", color: "var(--ui-neutral-fg)" })]}>
						{title.tagline}
					</p>
				</div>
				<dl mix={[detailList()]}>
					<DetailRow label="Released">{String(title.year)}</DetailRow>
					<DetailRow label="Length">
						{title.kind === "film" ? formatMinutes(title.minutes ?? 0) : lengthLabel(title)}
					</DetailRow>
					<DetailRow label="Genres">{genreNames(title).join(", ")}</DetailRow>
					<DetailRow label="Rating">
						<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.5rem" })]}>
							<Badge>{title.rating}</Badge>
							{RATING_MEANING[title.rating] ?? ""}
						</span>
					</DetailRow>
				</dl>
				<dl mix={[detailList()]}>
					<DetailRow label={title.kind === "film" ? "Directed by" : "Created by"}>
						{title.creators.join(", ")}
					</DetailRow>
					<DetailRow label="Cast">
						{title.cast.map((person) => (
							<span mix={[raw({ display: "block" })]}>{person}</span>
						))}
					</DetailRow>
				</dl>
			</section>
		);
	};
}

/** A column of label and value pairs in the details tab. */
function detailList() {
	return raw({ display: "grid", alignContent: "start", gap: "1rem", margin: "0" });
}

/** One detail: a muted label over its value. */
function DetailRow(handle: Handle<{ label: string; children: RemixNode }>) {
	return () => (
		<div mix={[raw({ display: "grid", gap: "0.25rem" })]}>
			<dt mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
				{handle.props.label}
			</dt>
			<dd mix={[raw({ margin: "0", lineHeight: "1.6", color: "var(--ui-neutral-fg-emphasis)" })]}>
				{handle.props.children}
			</dd>
		</div>
	);
}

namespace Episodes {
	export interface Props {
		title: Title;
		season: Season;
		progress: Progress | undefined;
	}
}

/**
 * The episodes: the season picked from a menu of links that put it in the address, its
 * rating, then each episode numbered, the one the viewer is on lit and every other divided.
 */
function Episodes(handle: Handle<Episodes.Props>) {
	return () => {
		let { progress, season, title } = handle.props;
		let seasons = title.seasons ?? [];
		return (
			<section aria-label="Episodes">
				<div
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							justifyContent: "space-between",
							gap: "0.75rem 1.5rem",
						}),
					]}
				>
					{seasons.length > 1 ? (
						<SeasonPicker title={title} season={season} seasons={seasons} />
					) : null}
				</div>
				<p
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							margin: "0.75rem 0 1rem",
							color: "var(--ui-neutral-fg)",
						}),
					]}
				>
					<strong mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
						Season {season.number}:
					</strong>
					<Badge>{title.rating}</Badge>
					<span>
						{season.year} · {season.episodes.length} episodes
					</span>
				</p>
				<EpisodeList
					aria-label={`${title.name}, season ${season.number}`}
					mix={[
						raw({
							gap: "0",
							"& > li + li": { borderBlockStart: "1px solid rgb(255 255 255 / 0.1)" },
							"& a": { borderRadius: "0.5rem" },
							"& a[aria-current]": { backgroundColor: "rgb(255 255 255 / 0.08)" },
						}),
					]}
				>
					{season.episodes.map((episode) => {
						let share = watchedShare(progress, season.number, episode.number);
						let current = progress?.season === season.number && progress.episode === episode.number;
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
			</section>
		);
	};
}

/**
 * The season picker: a box naming the season shown that opens a menu of every season, each a
 * link that puts it in the address.
 */
function SeasonPicker(handle: Handle<{ title: Title; season: Season; seasons: Season[] }>) {
	return () => {
		let { season, seasons, title } = handle.props;
		let menu = `vesper-seasons-${title.id}`;
		return (
			<>
				<button
					type="button"
					commandfor={menu}
					command="toggle-popover"
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "1.5rem",
							blockSize: "2.75rem",
							paddingInline: "1rem 0.875rem",
							border: "0",
							borderRadius: "999px",
							font: "inherit",
							fontSize: "1rem",
							fontWeight: "650",
							color: "var(--ui-neutral-fg-emphasis)",
							backgroundColor: "rgb(255 255 255 / 0.16)",
							cursor: "pointer",
						}),
						when("&:hover", raw({ backgroundColor: "rgb(255 255 255 / 0.24)" })),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
						),
					]}
				>
					Season {season.number}
					<ChevronDownIcon aria-hidden="true" size={18} />
				</button>
				<Menu id={menu} placement="bottom-start" aria-label="Seasons">
					{seasons.map((entry) => (
						<Menu.Item
							href={href(`title/${title.id}?tab=episodes&season=${entry.number}`)}
							aria-current={entry.number === season.number ? "page" : undefined}
						>
							<CheckIcon
								aria-hidden="true"
								size={16}
								mix={[
									raw({
										marginInlineEnd: "0.5rem",
										opacity: entry.number === season.number ? "1" : "0",
									}),
								]}
							/>
							{`Season ${entry.number}`}
							<span
								mix={[
									raw({
										marginInlineStart: "auto",
										paddingInlineStart: "1.5rem",
										color: "var(--ui-neutral-fg-muted)",
									}),
								]}
							>
								{entry.episodes.length} episodes
							</span>
						</Menu.Item>
					))}
				</Menu>
			</>
		);
	};
}

/** Titles like this one as a grid of cards, for the "More like this" tab. */
function MoreLikeThis(handle: Handle<{ title: Title; viewer: Viewer }>) {
	return () => {
		let { title, viewer } = handle.props;
		let titles = similarTitles(title, visibleTitles(viewer.profile));
		return (
			<ul
				aria-label={`More like ${title.name}`}
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(15rem, 100%), 1fr))",
						gap: "1.5rem 1rem",
						margin: "0",
						padding: "0",
						listStyle: "none",
					}),
				]}
			>
				{titles.map((entry) => (
					<li>
						<TitleCard title={entry} />
					</li>
				))}
			</ul>
		);
	};
}
