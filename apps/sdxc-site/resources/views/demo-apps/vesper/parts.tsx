/**
 * The pieces Vesper's screens share: a title as a card, a shelf of them, a poster grid, the
 * billboard hero, the play and My List buttons, and the empty state. Each reads the catalogue
 * and the viewer, so a screen is a matter of which titles go where.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { BookmarkIcon, CheckIcon, InfoIcon, PlayIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Button, LinkButton } from "@sdxc/ui";
import { VideoCard, VideoShelf } from "@sdxc/ui/video";

import type { Progress, Title } from "./data";
import type { Viewer } from "./state";

import { KeyArt } from "./art";
import {
	actionHref,
	findEpisode,
	findTitle,
	genreNames,
	href,
	lengthLabel,
	watchHref,
} from "./data";
import { GUTTER, TOP_BAR } from "./shell";

/** The shelves' paging button names. */
const SHELF_LABELS: VideoShelf.Labels = { previous: "Previous titles", next: "More titles" };

/** A title's year, first genre and length, the meta line a card carries. */
export function cardMeta(title: Title): string {
	return [title.year, genreNames(title)[0], lengthLabel(title)].filter(Boolean).join(" · ");
}

namespace TitleCard {
	export interface Props {
		title: Title;
		/** Distinguishes two cards of one title on a page, for the art's gradient ids. */
		variant: string;
		shape?: VideoCard.Shape;
	}
}

/** A title as a card linking to its page, with its art, badge and meta line. */
export function TitleCard(handle: Handle<TitleCard.Props>) {
	return () => {
		let { shape = "landscape", title, variant } = handle.props;
		return (
			<VideoCard
				href={href(`title/${title.id}`)}
				title={title.name}
				shape={shape}
				art={<KeyArt title={title} variant={variant} />}
				meta={cardMeta(title)}
				badge={title.badge}
				data-rmx-prefetch="intent"
			/>
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
		let meta =
			found === undefined
				? lengthLabel(title)
				: `S${found.season.number}:E${found.episode.number} · ${found.episode.title}`;
		let percent = Math.round(progress.share * 100);
		return (
			<VideoCard
				href={watchHref(title, progress.season, progress.episode)}
				title={title.name}
				art={<KeyArt title={title} variant="resume" />}
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
	}
}

/** A shelf of title cards, with a "See all" link when the shelf has a page of its own. */
export function TitleShelf(handle: Handle<TitleShelf.Props>) {
	return () => {
		let { id, more, shape = "landscape", title, titles } = handle.props;
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
						<TitleCard title={entry} variant={id} shape={shape} />
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
		/** Prefixes each card's art ids. */
		variant: string;
		/** The grid's name, such as "Series, Drama". */
		label: string;
	}
}

/** Titles as a wrapping grid of posters, as many to a row as fit. */
export function PosterGrid(handle: Handle<PosterGrid.Props>) {
	return () => {
		let { label, titles, variant } = handle.props;
		return (
			<ul
				aria-label={label}
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(9.5rem, 42%), 1fr))",
						gap: "1.5rem 0.875rem",
						margin: "0",
						padding: "0",
						listStyle: "none",
					}),
				]}
			>
				{titles.map((title) => (
					<li>
						<TitleCard title={title} variant={variant} shape="poster" />
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
					gap: "0.75rem",
					paddingInline: GUTTER,
					paddingBlock: "0.5rem 1.5rem",
				}),
			]}
		>
			<h1
				mix={[
					raw({
						margin: "0",
						fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
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
			color="brand"
			variant="solid"
			size="lg"
			mix={[heroButton()]}
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

namespace ListButton {
	export interface Props {
		title: Title;
		viewer: Viewer;
		/** The page the post returns to, with its query. */
		back: string;
		/** Draws only the icon, named for assistive tech. */
		compact?: boolean;
	}
}

/**
 * Adds a title to My List or takes it off, as a post that answers with a toast. The button
 * is a toggle, pressed while the title is on the list, so it is announced as one.
 */
export function ListButton(handle: Handle<ListButton.Props>) {
	return () => {
		let { back, compact = false, title, viewer } = handle.props;
		let listed = viewer.list.includes(title.id);
		let label = listed ? "On My List" : "My List";
		return (
			<form
				method="post"
				action={actionHref(`title/${title.id}/list`)}
				mix={[raw({ display: "contents" })]}
			>
				<input type="hidden" name="back" value={back} />
				<input type="hidden" name="on" value={listed ? "false" : "true"} />
				<Button
					type="submit"
					id={`vesper-list-${title.id}`}
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
			</form>
		);
	};
}

namespace Billboard {
	export interface Props {
		title: Title;
		/** The level of the title's heading: 1 on a title's page, 2 on home under its own heading. */
		level: 1 | 2;
		/** The eyebrow over the name, such as "Vesper Original". */
		eyebrow?: string;
		/** Synopsis or tagline under the meta row. */
		children?: RemixNode;
		/** The buttons. */
		actions: RemixNode;
		/** Taller on home, shorter on a title's page where the episodes follow. */
		size?: "feature" | "title";
	}
}

/**
 * The full-bleed hero: the title's art behind the top bar, faded into the page at its foot
 * and toward its text, with the name in the title's own lettering, its facts and its actions.
 */
export function Billboard(handle: Handle<Billboard.Props>) {
	return () => {
		let { actions, children, eyebrow, level, size = "feature", title } = handle.props;
		let feature = size === "feature";
		return (
			<section
				aria-labelledby={`vesper-hero-${title.id}`}
				mix={[
					raw({
						position: "relative",
						isolation: "isolate",
						display: "grid",
						alignContent: "end",
						marginBlockStart: `calc(-1 * ${TOP_BAR})`,
						minBlockSize: feature ? "min(88svh, 52rem)" : "min(70svh, 40rem)",
						paddingInline: GUTTER,
						paddingBlock: `calc(${TOP_BAR} + 2rem) clamp(2rem, 6vh, 4.5rem)`,
						overflow: "clip",
					}),
				]}
			>
				<div
					mix={[
						raw({
							position: "absolute",
							inset: "0",
							zIndex: "-1",
							"& > [data-key-art]": { position: "absolute", inset: "0" },
							"&::after": {
								content: '""',
								position: "absolute",
								inset: "0",
								background:
									"linear-gradient(to top, var(--ui-bg) 0%, color-mix(in oklch, var(--ui-bg), transparent 30%) 22%, transparent 55%), linear-gradient(to right, color-mix(in oklch, var(--ui-bg), transparent 15%) 0%, transparent 62%)",
							},
						}),
					]}
				>
					<KeyArt title={title} variant={`hero-${size}`} named={false} />
				</div>
				<div mix={[raw({ display: "grid", gap: "1rem", maxInlineSize: "38rem" })]}>
					{eyebrow === undefined ? null : (
						<span
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.5rem",
									fontSize: "0.75rem",
									fontWeight: "700",
									letterSpacing: "0.28em",
									textTransform: "uppercase",
									color: "var(--ui-color-brand-300)",
								}),
							]}
						>
							{eyebrow}
						</span>
					)}
					<TitleName title={title} level={level} />
					<FactRow title={title} />
					{children === undefined ? null : (
						<p
							mix={[
								raw({
									margin: "0",
									fontSize: "clamp(0.9375rem, 1.3vw, 1.0625rem)",
									lineHeight: "1.6",
									color: "var(--ui-neutral-fg)",
									textWrap: "pretty",
									textShadow: "0 1px 8px rgb(0 0 0 / 0.5)",
								}),
							]}
						>
							{children}
						</p>
					)}
					<div
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								gap: "0.625rem",
								marginBlockStart: "0.25rem",
							}),
						]}
					>
						{actions}
					</div>
				</div>
			</section>
		);
	};
}

/** The type each lettering sets a name in on the hero, larger and tighter than on a card. */
const HERO_LETTERING: Record<Title["lettering"], Record<string, string>> = {
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
		fontSize: "clamp(1.75rem, 4.2vw, 3.5rem)",
	},
	condensed: {
		fontFamily: "'Avenir Next Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif",
		fontWeight: "800",
		textTransform: "uppercase",
		letterSpacing: "0",
		fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
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
		fontSize: "clamp(1.75rem, 4.2vw, 3.25rem)",
	},
};

/** The title's name as the hero's heading, in its own lettering. */
function TitleName(handle: Handle<{ title: Title; level: 1 | 2 }>) {
	return () => {
		let { level, title } = handle.props;
		let mix = [
			raw({
				margin: "0",
				fontSize: "clamp(2.25rem, 6vw, 4.75rem)",
				lineHeight: "0.95",
				color: "oklch(0.98 0.01 85)",
				textWrap: "balance",
				textShadow: "0 2px 24px rgb(0 0 0 / 0.45)",
				...HERO_LETTERING[title.lettering],
			}),
		];
		let id = `vesper-hero-${title.id}`;
		return level === 1 ? (
			<h1 id={id} mix={mix}>
				{title.name}
			</h1>
		) : (
			<h2 id={id} mix={mix}>
				{title.name}
			</h2>
		);
	};
}

/** The hero's facts: rating, year, length and genres, the rating boxed. */
export function FactRow(handle: Handle<{ title: Title }>) {
	return () => {
		let { title } = handle.props;
		return (
			<p
				mix={[
					raw({
						display: "flex",
						flexWrap: "wrap",
						alignItems: "center",
						gap: "0.375rem 0.75rem",
						margin: "0",
						fontSize: "0.9375rem",
						color: "var(--ui-neutral-fg-emphasis)",
						fontVariantNumeric: "tabular-nums",
					}),
				]}
			>
				<span
					mix={[
						raw({
							paddingInline: "0.375rem",
							borderRadius: "0.25rem",
							boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.45)",
							fontSize: "0.8125rem",
							fontWeight: "600",
						}),
					]}
				>
					{title.rating}
				</span>
				<span>{title.year}</span>
				<span>{lengthLabel(title)}</span>
				<span mix={[raw({ color: "var(--ui-neutral-fg)" })]}>{genreNames(title).join(" · ")}</span>
			</p>
		);
	};
}

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
