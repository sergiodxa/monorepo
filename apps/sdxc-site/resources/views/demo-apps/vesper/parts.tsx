/**
 * The pieces Vesper's screens share: a title as a card, a shelf of them, a poster grid, the
 * billboard hero, the play and My List buttons, and the empty state. Each reads the catalogue
 * and the viewer, so a screen is a matter of which titles go where.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Toast } from "@sdxc/ui/app";
import type { Handle, RemixNode } from "remix/component";

import { BookmarkIcon, CheckIcon, InfoIcon, PlayIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { Button, LinkButton } from "@sdxc/ui";
import { TitleHero, VideoCard, VideoShelf } from "@sdxc/ui/video";
import { generateUUID } from "@sdxc/uuid/v4";
import { Frame } from "remix/component";

import type { Progress, Title } from "./data";
import type { Viewer } from "./state";

import { KeyArt } from "./art";
import {
	actionHref,
	findEpisode,
	findTitle,
	genreNames,
	href,
	formatMinutes,
	lengthLabel,
	trendingRank,
	watchHref,
} from "./data";
import { GUTTER } from "./shell";

/** The shelves' paging button names. */
const SHELF_LABELS: VideoShelf.Labels = { previous: "Previous titles", next: "More titles" };

/** A title's year, first genre and length, the meta line a card carries. */
export function cardMeta(title: Title): string {
	return [title.year, genreNames(title)[0], lengthLabel(title)].filter(Boolean).join(" · ");
}

namespace TitleCard {
	export interface Props {
		title: Title;
		shape?: VideoCard.Shape;
		/** Shows the title's rank this week on its art's corner, for the trending row. */
		ranked?: boolean;
	}
}

/** A title as a card linking to its page, with its art, badge and meta line. */
export function TitleCard(handle: Handle<TitleCard.Props>) {
	return () => {
		let { ranked = false, shape = "landscape", title } = handle.props;
		let rank = ranked ? trendingRank(title.id) : undefined;
		return (
			<VideoCard
				href={href(`title/${title.id}`)}
				title={title.name}
				shape={shape}
				art={
					<span>
						<KeyArt title={title} />
						{rank === undefined ? null : (
							<span
								mix={[
									raw({
										position: "absolute",
										insetBlockStart: "0.5rem",
										insetInlineEnd: "0.5rem",
									}),
								]}
							>
								<RankMark rank={rank} size={1.625} />
							</span>
						)}
						<CardPeek title={title} />
					</span>
				}
				meta={cardMeta(title)}
				badge={title.badge}
				data-rmx-prefetch="intent"
			/>
		);
	};
}

/**
 * What a card shows under a hovering pointer or keyboard focus: the title's line and facts
 * rising over the foot of its art, so a row can be skimmed without opening each title. It is
 * decorative, since the page the card opens says the same, and stays away on touch screens.
 */
function CardPeek(handle: Handle<{ title: Title }>) {
	return () => {
		let { title } = handle.props;
		return (
			<span
				aria-hidden="true"
				mix={[
					raw({
						position: "absolute",
						insetInline: "0",
						insetBlockEnd: "0",
						display: "grid",
						gap: "0.375rem",
						padding: "2.5rem 0.75rem 0.75rem",
						background:
							"linear-gradient(to top, rgb(8 6 12 / 0.96) 0%, rgb(8 6 12 / 0.85) 55%, rgb(8 6 12 / 0))",
						color: "oklch(0.96 0.005 300)",
						textAlign: "start",
						opacity: "0",
						translate: "0 0.5rem",
						transition: "opacity 200ms ease, translate 240ms cubic-bezier(0.2, 0.7, 0.2, 1)",
						"@media (hover: none)": { display: "none" },
						"[data-slot=video-card]:is(:hover, :focus-visible) &": {
							opacity: "1",
							translate: "0 0",
						},
					}),
					motionReduce(raw({ transition: "none", translate: "0 0" })),
				]}
			>
				<span
					mix={[
						raw({
							display: "-webkit-box",
							WebkitLineClamp: "2",
							WebkitBoxOrient: "vertical",
							overflow: "hidden",
							fontSize: "0.8125rem",
							lineHeight: "1.25rem",
							fontWeight: "550",
						}),
					]}
				>
					{title.tagline}
				</span>
				<span
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							fontSize: "0.75rem",
							color: "oklch(0.8 0.01 300)",
						}),
					]}
				>
					<span
						mix={[
							raw({
								paddingInline: "0.3rem",
								borderRadius: "0.25rem",
								boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.4)",
							}),
						]}
					>
						{title.rating}
					</span>
					{lengthLabel(title)}
				</span>
			</span>
		);
	};
}

namespace ResumeCard {
	export interface Props {
		progress: Progress;
	}
}

/**
 * A title the viewer is part way through, linking straight back into playback where they left
 * it, its episode in the meta line and the share watched along the art.
 */
export function ResumeCard(handle: Handle<ResumeCard.Props>) {
	return () => {
		let { progress } = handle.props;
		let title = findTitle(progress.title);
		if (title === undefined) return null;
		let found =
			progress.season === undefined || progress.episode === undefined
				? undefined
				: findEpisode(title, progress.season, progress.episode);
		let minutes = found?.episode.minutes ?? title.minutes ?? 0;
		let left = `${formatMinutes(Math.max(1, Math.round(minutes * (1 - progress.share))))} left`;
		let meta =
			found === undefined ? left : `S${found.season.number}:E${found.episode.number} · ${left}`;
		let percent = Math.round(progress.share * 100);
		return (
			<VideoCard
				href={watchHref(title, progress.season, progress.episode)}
				title={title.name}
				art={<KeyArt title={title} />}
				meta={meta}
				progress={progress.share}
				progressLabel={`${percent}% watched`}
			/>
		);
	};
}

namespace TitleShelf {
	export interface Props {
		id: string;
		title: RemixNode;
		titles: Title[];
		shape?: VideoCard.Shape;
		/** A "See all" link's page path. */
		more?: string;
		/** Marks each card with its rank this week. */
		ranked?: boolean;
	}
}

/** A shelf of title cards, with a "See all" link when the shelf has a page of its own. */
export function TitleShelf(handle: Handle<TitleShelf.Props>) {
	return () => {
		let { id, more, ranked = false, shape = "landscape", title, titles } = handle.props;
		if (titles.length === 0) return null;
		return (
			<VideoShelf
				id={`vesper-${id}`}
				title={title}
				size={shape}
				labels={SHELF_LABELS}
				action={more === undefined ? undefined : <SeeAll page={more} />}
			>
				{titles.map((entry) => (
					<VideoShelf.Item>
						<TitleCard title={entry} shape={shape} ranked={ranked} />
					</VideoShelf.Item>
				))}
			</VideoShelf>
		);
	};
}

/** The quiet link beside a shelf's heading to the shelf's own page. */
function SeeAll(handle: Handle<{ page: string }>) {
	return () => (
		<a
			href={href(handle.props.page)}
			mix={[
				raw({
					color: "var(--ui-neutral-fg-muted)",
					fontWeight: "550",
					textDecoration: "none",
				}),
				when("&:hover", raw({ color: "var(--ui-brand-fg)" })),
				when(
					"&:focus-visible",
					raw({
						outline: "2px solid var(--ui-brand-ring)",
						outlineOffset: "2px",
						borderRadius: "2px",
					}),
				),
			]}
		>
			See all
		</a>
	);
}

namespace PosterGrid {
	export interface Props {
		titles: Title[];
		/** The grid's name, such as "Series, Drama". */
		label: string;
	}
}

/** Titles as a wrapping grid of landscape cards, as many to a row as fit. */
export function PosterGrid(handle: Handle<PosterGrid.Props>) {
	return () => {
		let { label, titles } = handle.props;
		return (
			<ul
				aria-label={label}
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(15rem, 100%), 1fr))",
						gap: "1.5rem 0.875rem",
						margin: "0",
						padding: "0",
						listStyle: "none",
					}),
				]}
			>
				{titles.map((title) => (
					<li>
						<TitleCard title={title} />
					</li>
				))}
			</ul>
		);
	};
}

/** The page's padded column, lined up with the shelves' first cards. */
export function Gutter(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<div mix={[raw({ paddingInline: GUTTER, minInlineSize: "0" })]}>{handle.props.children}</div>
	);
}

/** A screen's heading row for screens without a hero, clear of the top bar. */
export function ScreenHeading(handle: Handle<{ title: string; children?: RemixNode }>) {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					justifyItems: "center",
					gap: "1.5rem",
					paddingInline: GUTTER,
					paddingBlock: "clamp(0.5rem, 3vh, 2rem) 2rem",
					textAlign: "center",
					"& nav ul": { justifyContent: "center" },
				}),
			]}
		>
			<h1
				mix={[
					raw({
						margin: "0",
						fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
						lineHeight: "1.1",
						fontWeight: "700",
						letterSpacing: "-0.02em",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				{handle.props.title}
			</h1>
			{handle.props.children}
		</div>
	);
}

/** The large, rounded call to action the hero and title page share. */
function heroButton() {
	return raw({
		blockSize: "2.875rem",
		paddingInline: "1.375rem",
		borderRadius: "999px",
		fontSize: "1rem",
		fontWeight: "650",
		gap: "0.5rem",
		"& svg": { inlineSize: "1.125rem", blockSize: "1.125rem" },
	});
}

namespace PlayButton {
	export interface Props {
		href: string;
		/** "Play", "Resume" or "Play S1:E1". */
		label: string;
	}
}

/** The primary action: start or resume playback. */
export function PlayButton(handle: Handle<PlayButton.Props>) {
	return () => (
		<LinkButton
			href={handle.props.href}
			color="neutral"
			variant="solid"
			size="lg"
			mix={[
				heroButton(),
				raw({ backgroundColor: "oklch(0.98 0 0)", color: "oklch(0.12 0.01 295)" }),
				when("&:hover", raw({ backgroundColor: "oklch(0.86 0 0)" })),
			]}
		>
			<PlayIcon aria-hidden="true" fill="currentColor" />
			{handle.props.label}
		</LinkButton>
	);
}

/** The hero's secondary action, to the title's page. */
export function InfoButton(handle: Handle<{ href: string }>) {
	return () => (
		<LinkButton
			href={handle.props.href}
			color="neutral"
			variant="surface"
			size="lg"
			mix={[heroButton(), raw({ backgroundColor: "rgb(255 255 255 / 0.14)", color: "white" })]}
		>
			<InfoIcon aria-hidden="true" />
			More info
		</LinkButton>
	);
}

/** Names the frame one title's My List button lives in, apart for the icon-only one. */
export const LIST_FRAME_PREFIX = "vesper-list-";

/**
 * The name of the frame a title's My List button lives in on a page.
 *
 * @example listFrameName("tidewater", true) // "vesper-list-icon-tidewater"
 */
export function listFrameName(id: string, compact: boolean): string {
	return `${LIST_FRAME_PREFIX}${compact ? "icon-" : ""}${id}`;
}

namespace ListButton {
	export interface Props {
		title: Title;
		viewer: Viewer;
		/** The page the post returns to, with its query. */
		back: string;
		/** Draws only the icon, named for assistive tech. */
		compact?: boolean;
		/** The toast the post that redrew the button named, raised once by the browser. */
		toast?: Omit<Toast.Flash, "id">;
	}
}

/**
 * The My List button in its own frame, loaded with the page it sits on: a post reloads only
 * this frame, so the button flips and its toast rises while the page, its scroll and every
 * shelf stay put. Without script the post loads the page again.
 */
export function ListFrame(handle: Handle<Omit<ListButton.Props, "toast" | "viewer">>) {
	return () => {
		let { back, compact = false, title } = handle.props;
		return <Frame name={listFrameName(title.id, compact)} src={href(back)} />;
	};
}

/**
 * Adds a title to My List or takes it off, as a post that answers with a toast. The button
 * is a toggle, pressed while the title is on the list, so it is announced as one.
 */
export function ListButton(handle: Handle<ListButton.Props>) {
	return () => {
		let { back, compact = false, title, toast, viewer } = handle.props;
		let listed = viewer.list.includes(title.id);
		let label = listed ? "On My List" : "My List";
		return (
			<form
				method="post"
				action={actionHref(`title/${title.id}/list`)}
				data-rmx-target={listFrameName(title.id, compact)}
				data-rmx-reset-scroll="manual"
				data-rmx-reset-focus="manual"
				mix={[raw({ display: "contents" })]}
			>
				<input type="hidden" name="back" value={back} />
				<input type="hidden" name="on" value={listed ? "false" : "true"} />
				<Button
					type="submit"
					id={`vesper-list-${compact ? "icon-" : ""}${title.id}`}
					color="neutral"
					variant="surface"
					size="lg"
					aria-pressed={listed ? "true" : "false"}
					aria-label={compact ? "My List" : undefined}
					mix={[
						heroButton(),
						raw({ backgroundColor: "rgb(255 255 255 / 0.14)", color: "white" }),
						compact ? raw({ inlineSize: "2.875rem", paddingInline: "0" }) : raw({}),
					]}
				>
					{listed ? <CheckIcon aria-hidden="true" /> : <BookmarkIcon aria-hidden="true" />}
					{compact ? null : label}
				</Button>
				{toast === undefined ? null : (
					<template data-main-toast={generateUUID()} data-toast={JSON.stringify(toast)} />
				)}
			</form>
		);
	};
}

namespace Billboard {
	export interface Props {
		title: Title;
		/** The eyebrow over the name, such as "Vesper Original". */
		eyebrow?: string;
		/** Synopsis or tagline under the facts. */
		children?: RemixNode;
		/** The buttons. */
		actions: RemixNode;
	}
}

/**
 * The home's featured title as a rounded card set in from the page's edges: its art, the name
 * in the title's own lettering, its facts, where it ranks this week and its actions.
 */
export function Billboard(handle: Handle<Billboard.Props>) {
	return () => {
		let { actions, children, eyebrow, title } = handle.props;
		let id = `vesper-hero-${title.id}`;
		return (
			<TitleHero
				size="feature"
				aria-labelledby={id}
				art={<KeyArt title={title} named={false} priority />}
				mix={[
					raw({
						"--ui-title-hero-offset": "0px",
						"--ui-title-hero-inset": "clamp(1.25rem, 4cqi, 3.5rem)",
						"--ui-title-hero-accent": "var(--ui-color-brand-300)",
						"--ui-title-hero-feature-size": "min(74svh, 46rem)",
						"--ui-title-hero-fade": "oklch(0.1 0.012 295)",
						marginInline: GUTTER,
						borderRadius: "1rem",
						boxShadow: "0 0 0 1px rgb(255 255 255 / 0.06), 0 30px 60px -30px rgb(0 0 0 / 0.8)",
					}),
				]}
			>
				{eyebrow === undefined ? null : <TitleHero.Eyebrow>{eyebrow}</TitleHero.Eyebrow>}
				<TitleHero.Title
					id={id}
					level={2}
					mix={[raw({ color: "oklch(0.98 0.01 85)", ...HERO_LETTERING[title.lettering] })]}
				>
					{title.name}
				</TitleHero.Title>
				<DottedFacts title={title} />
				<RankLine title={title} />
				{children === undefined ? null : <TitleHero.Summary>{children}</TitleHero.Summary>}
				<TitleHero.Actions>{actions}</TitleHero.Actions>
			</TitleHero>
		);
	};
}

/** A title's kind, first genre, year, length and rating as one line, dotted between. */
export function DottedFacts(handle: Handle<{ title: Title }>) {
	return () => {
		let { title } = handle.props;
		let facts = [
			title.kind === "film" ? "Film" : "Series",
			genreNames(title)[0] ?? "",
			String(title.year),
			lengthLabel(title),
			title.rating,
		].filter((fact) => fact !== "");
		return (
			<TitleHero.Facts mix={[raw({ fontWeight: "600" })]}>
				{facts.map((fact, index) => (
					<>
						{index === 0 ? null : (
							<span aria-hidden="true" mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
								•
							</span>
						)}
						<span>{fact}</span>
					</>
				))}
			</TitleHero.Facts>
		);
	};
}

/** Where a title ranks this week, beside a small ember mark, for the titles that rank at all. */
export function RankLine(handle: Handle<{ title: Title }>) {
	return () => {
		let { title } = handle.props;
		let rank = trendingRank(title.id);
		if (rank === undefined) return null;
		return (
			<p
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.625rem",
						margin: "0",
						fontSize: "1.0625rem",
						fontWeight: "700",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				<RankMark rank={rank} />
				{`#${rank} in ${title.kind === "film" ? "films" : "series"} this week`}
			</p>
		);
	};
}

/** A small ember square holding a rank, Vesper's mark for the week's most watched. */
export function RankMark(handle: Handle<{ rank: number; size?: number }>) {
	return () => {
		let { rank, size = 1.75 } = handle.props;
		return (
			<span
				aria-hidden="true"
				mix={[
					raw({
						display: "inline-grid",
						placeItems: "center",
						inlineSize: `${size}rem`,
						blockSize: `${size}rem`,
						flexShrink: "0",
						borderRadius: "0.3rem",
						fontSize: `${size * 0.5}rem`,
						fontWeight: "800",
						lineHeight: "1",
						color: "oklch(0.18 0.03 40)",
						background:
							"linear-gradient(160deg, var(--ui-color-brand-300), var(--ui-color-brand-600))",
						boxShadow: "0 2px 8px rgb(0 0 0 / 0.4)",
					}),
				]}
			>
				{`#${rank}`}
			</span>
		);
	};
}

/** The type each lettering sets a name in on the hero, sized against the hero's width. */
export const HERO_LETTERING: Record<Title["lettering"], Record<string, string>> = {
	serif: {
		fontFamily: "Didot, 'Bodoni 72', 'Bodoni MT', 'Playfair Display', Georgia, serif",
		fontWeight: "400",
		textTransform: "uppercase",
		letterSpacing: "0.08em",
	},
	wide: {
		fontFamily: "'Avenir Next', Avenir, 'Segoe UI', system-ui, sans-serif",
		fontWeight: "600",
		textTransform: "uppercase",
		letterSpacing: "0.22em",
		fontSize: "clamp(1.75rem, 6cqi, 3.5rem)",
	},
	condensed: {
		fontFamily: "'Avenir Next Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif",
		fontWeight: "800",
		textTransform: "uppercase",
		letterSpacing: "0",
		fontSize: "clamp(2.75rem, 10cqi, 5.5rem)",
	},
	script: {
		fontFamily: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif",
		fontWeight: "700",
		fontStyle: "italic",
		letterSpacing: "-0.02em",
	},
	mono: {
		fontFamily: "'SF Mono', ui-monospace, Menlo, Consolas, monospace",
		fontWeight: "500",
		textTransform: "uppercase",
		letterSpacing: "0.16em",
		fontSize: "clamp(1.75rem, 6cqi, 3.25rem)",
	},
};

namespace Blank {
	export interface Props {
		title: string;
		/** `1` where the empty state is the whole screen, such as the 404. Default: `2`. */
		level?: 1 | 2;
		children: RemixNode;
		action?: RemixNode;
	}
}

/** An empty state: a drawn crescent, what's missing and the way on. */
export function Blank(handle: Handle<Blank.Props>) {
	return () => {
		let { action, children, level = 2, title } = handle.props;
		let headingMix = [
			raw({ margin: "0", fontSize: "1.25rem", color: "var(--ui-neutral-fg-emphasis)" }),
		];
		return (
			<div
				mix={[
					raw({
						display: "grid",
						justifyItems: "center",
						gap: "0.75rem",
						paddingBlock: "4rem",
						paddingInline: GUTTER,
						textAlign: "center",
					}),
				]}
			>
				<svg width="56" height="56" viewBox="0 0 32 32" aria-hidden="true">
					<path
						d="M20.5 5.5a11 11 0 1 0 6 19.6A12.5 12.5 0 0 1 20.5 5.5Z"
						fill="var(--ui-neutral-bg-tint-pressed)"
					/>
				</svg>
				{level === 1 ? <h1 mix={headingMix}>{title}</h1> : <h2 mix={headingMix}>{title}</h2>}
				<p
					mix={[
						raw({
							margin: "0",
							maxInlineSize: "28rem",
							color: "var(--ui-neutral-fg)",
							lineHeight: "1.6",
						}),
					]}
				>
					{children}
				</p>
				{action}
			</div>
		);
	};
}

export namespace Chips {
	export interface Props {
		label: string;
		/** Each chip's text, the page it links to and whether it is the one applied. */
		chips: Array<{ label: string; page: string; current: boolean }>;
	}
}

/**
 * A row of filter chips, each a link that puts its filter in the address, so a filtered view
 * is a link a visitor can send; the applied one is marked current.
 */
export function Chips(handle: Handle<Chips.Props>) {
	return () => {
		let { chips, label } = handle.props;
		return (
			<nav aria-label={label}>
				<ul
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							gap: "0.5rem",
							margin: "0",
							padding: "0",
							listStyle: "none",
						}),
					]}
				>
					{chips.map((chip) => (
						<li>
							<a
								href={href(chip.page)}
								aria-current={chip.current ? "page" : undefined}
								mix={[
									raw({
										display: "inline-flex",
										alignItems: "center",
										blockSize: "2.25rem",
										paddingInline: "0.875rem",
										borderRadius: "999px",
										fontSize: "0.875rem",
										fontWeight: "550",
										color: "var(--ui-neutral-fg)",
										textDecoration: "none",
										boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.16)",
									}),
									when(
										"&:hover",
										raw({
											backgroundColor: "rgb(255 255 255 / 0.08)",
											color: "var(--ui-neutral-fg-emphasis)",
										}),
									),
									when(
										"&[aria-current='page']",
										raw({
											backgroundColor: "var(--ui-color-neutral-50)",
											color: "var(--ui-color-neutral-950)",
											boxShadow: "none",
										}),
									),
									when(
										"&:focus-visible",
										raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
									),
								]}
							>
								{chip.label}
							</a>
						</li>
					))}
				</ul>
			</nav>
		);
	};
}
