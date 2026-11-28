/**
 * Understory's feed, the blog's index: on the first unfiltered page, curated ways in ("Start
 * here" and the series), then the one mixed feed as a garden of cards in date order, narrowed
 * by type through `?type=` and by topic through links to each topic's page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { leading, pretty, text, weight } from "@sdxc/u/typography";
import { Avatar } from "@sdxc/ui";

import type { DemoBlogPost } from "~/app/services/demo-blogs";
import type { DemoBlogContext, DemoBlogFeedView } from "~/resources/views/demo-blogs";

import { countKinds, countTags, listSeries } from "~/app/services/demo-blogs";
import { TAGS_PAGE } from "~/resources/views/demo-blogs";
import {
	CardGrid,
	FilterChips,
	GardenCard,
	kindHue,
	labelFace,
	partTitle,
	Pager,
	quietLink,
	SectionTitle,
	tinted,
	WIDE_QUERY,
	Wrap,
} from "~/resources/views/demo-blogs/understory/parts";

/** What each series builds, for its card; a series missing here shows its first part's lead. */
const SERIES_BLURBS: Record<string, string> = {
	"Sync from scratch":
		"A sync engine for a notes app, built from a change log, a hybrid clock and a merge.",
};

/** The evergreen posts "Start here" offers beside the featured essay, by path. */
const START_HERE = ["articles/conflicts-are-a-product-decision", "glossary/crdt"];

namespace FeedPage {
	export interface Props {
		view: DemoBlogFeedView;
		context: DemoBlogContext;
	}
}

/** One page of the feed, with the curated strips on the first unfiltered page only. */
export function FeedPage(handle: Handle<FeedPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let kind = view.type === null ? null : context.site.kinds[view.type];
		return (
			<Wrap>
				{view.featured !== null ? (
					<>
						<Welcome context={context} />
						<StartHere context={context} featured={view.featured} />
						<SeriesStrip context={context} />
					</>
				) : null}
				<section aria-labelledby="garden-title" mix={[vstack({ gap: 5, align: "stretch" })]}>
					<SectionTitle
						id="garden-title"
						note={kind === null || kind === undefined ? "newest first" : kind.description}
					>
						{kind === null || kind === undefined ? "Everything in the garden" : kind.label}
					</SectionTitle>
					<FilterBar context={context} type={view.type} />
					<CardGrid slot="understory-garden">
						{view.feed.map((post) => (
							<GardenCard context={context} post={post} />
						))}
					</CardGrid>
					<Pager page={view.page} pageCount={view.pageCount} pageHref={view.pageHref} />
				</section>
			</Wrap>
		);
	};
}

namespace Welcome {
	export interface Props {
		context: DemoBlogContext;
	}
}

/** The greeting: what the garden grows and who tends it, in one serif sentence. */
function Welcome(handle: Handle<Welcome.Props>) {
	return () => {
		let { site } = handle.props.context;
		return (
			<header mix={[vstack({ gap: 4, align: "start" }), raw({ maxInlineSize: "48rem" })]}>
				<h1
					mix={[
						m(0),
						raw({ fontSize: "clamp(2rem, 1.3rem + 2.6vw, 3.25rem)", lineHeight: 1.08 }),
						fg("neutral.emphasis"),
					]}
				>
					Notes from under the canopy of{" "}
					<em mix={[raw({ color: "var(--ui-brand-fg)" })]}>local-first</em> software.
				</h1>
				<div mix={[hstack({ gap: 3, align: "start" })]}>
					<Avatar size="md">
						<Avatar.Fallback>{site.author.initials}</Avatar.Fallback>
					</Avatar>
					<p
						mix={[
							m(0),
							pretty(),
							fg("neutral"),
							raw({ fontFamily: "var(--demo-blog-reading-font)" }),
						]}
					>
						{site.author.bio}
					</p>
				</div>
			</header>
		);
	};
}

namespace StartHere {
	export interface Props {
		context: DemoBlogContext;
		featured: DemoBlogPost;
	}
}

/** The featured essay large, with two evergreen picks beside it for a first visit. */
function StartHere(handle: Handle<StartHere.Props>) {
	return () => {
		let { context, featured } = handle.props;
		let picks = START_HERE.flatMap((path) => {
			let post = context.posts.find((entry) => entry.path === path);
			return post !== undefined && post.path !== featured.path ? [post] : [];
		});
		return (
			<section
				aria-labelledby="start-here"
				data-slot="understory-start-here"
				mix={[vstack({ gap: 4, align: "stretch" })]}
			>
				<SectionTitle id="start-here" note="if you are new here">
					Start here
				</SectionTitle>
				<div
					mix={[
						raw({ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1fr)" }),
						media(
							WIDE_QUERY,
							raw({ gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: "1.25rem" }),
						),
					]}
				>
					<GardenCard context={context} post={featured} span={false} />
					<div mix={[vstack({ gap: 4, align: "stretch" })]}>
						{picks.map((post) => (
							<GardenCard context={context} post={post} span={false} />
						))}
					</div>
				</div>
			</section>
		);
	};
}

namespace SeriesStrip {
	export interface Props {
		context: DemoBlogContext;
	}
}

/** Every series as a card listing its parts in reading order, so a series reads as one thing. */
function SeriesStrip(handle: Handle<SeriesStrip.Props>) {
	return () => {
		let { context } = handle.props;
		let names = [...new Set(context.posts.flatMap((post) => post.series ?? []))];
		if (names.length === 0) return null;
		return (
			<section
				aria-labelledby="series-title"
				data-slot="understory-series"
				mix={[vstack({ gap: 4, align: "stretch" })]}
			>
				<SectionTitle id="series-title" note="read in order">
					Series
				</SectionTitle>
				{names.map((name) => {
					let parts = listSeries(context.posts, name);
					let first = parts[0];
					return (
						<div
							mix={[
								tinted(kindHue(first?.kind ?? "tutorials")),
								p(5),
								raw({ display: "grid", gap: "1rem 2rem", gridTemplateColumns: "minmax(0, 1fr)" }),
								media(
									"(min-width: 56rem)",
									raw({ gridTemplateColumns: "minmax(0, 18rem) minmax(0, 1fr)" }),
								),
							]}
						>
							<div mix={[vstack({ gap: 2, align: "start" })]}>
								<p mix={[m(0), ...labelFace(), fg("neutral.muted")]}>
									{parts.length} parts · {parts.reduce((sum, part) => sum + part.minutes, 0)} min
								</p>
								<h3 mix={[m(0), text("2xl"), leading("tight"), fg("neutral.emphasis")]}>{name}</h3>
								<p mix={[m(0), text("sm"), fg("neutral"), pretty()]}>
									{SERIES_BLURBS[name] ?? first?.description}
								</p>
							</div>
							<ol
								mix={[
									m(0),
									p(0),
									listStyle("none"),
									raw({ display: "grid", gap: "0.75rem", gridTemplateColumns: "minmax(0, 1fr)" }),
									media(
										"(min-width: 40rem)",
										raw({ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }),
									),
								]}
							>
								{parts.map((part) => (
									<li
										mix={[
											vstack({ gap: 1, align: "start" }),
											raw({
												paddingInlineStart: "0.875rem",
												borderInlineStart: "2px solid var(--ui-brand-border)",
											}),
										]}
									>
										<span mix={[...labelFace(), fg("brand"), weight("semibold")]}>
											Part {part.part}
										</span>
										<a
											href={context.href(part.path)}
											mix={[
												quietLink(),
												fg("neutral.emphasis"),
												weight("semibold"),
												raw({ fontFamily: "var(--demo-blog-heading-font)" }),
											]}
										>
											{partTitle(part.title, name)}
										</a>
										<span mix={[text("sm"), fg("neutral.muted"), pretty()]}>
											{part.description}
										</span>
									</li>
								))}
							</ol>
						</div>
					);
				})}
			</section>
		);
	};
}

namespace FilterBar {
	export interface Props {
		context: DemoBlogContext;
		type: string | null;
	}
}

/**
 * Type chips with counts over the whole garden, then topic links with counts. The type is
 * `?type=` on the feed itself; a topic is its own page, since topics cross every type.
 */
function FilterBar(handle: Handle<FilterBar.Props>) {
	return () => {
		let { context, type } = handle.props;
		let { href, posts, site } = context;
		let types: FilterChips.Chip[] = [
			{ label: "Everything", href: href(), count: posts.length, current: type === null },
			...countKinds(site, posts).map(({ count, kind }) => ({
				label: site.kinds[kind]?.label ?? kind,
				href: `${href()}?type=${kind}`,
				count,
				current: type === kind,
				hue: kindHue(kind),
			})),
		];
		return (
			<div data-slot="understory-filters" mix={[vstack({ gap: 3, align: "stretch" })]}>
				<FilterChips label="Filter by type" chips={types} />
				<nav aria-label="Browse by topic">
					<p
						mix={[
							m(0),
							hstack({ gap: 1, align: "baseline" }),
							raw({ flexWrap: "wrap", columnGap: "0.875rem" }),
							text("sm"),
							fg("neutral.muted"),
						]}
					>
						<span mix={[...labelFace(), raw({ textTransform: "uppercase" })]}>Topics</span>
						{countTags(posts).map(({ count, tag }) => (
							<a href={href(`${TAGS_PAGE}/${tag}`)} mix={[quietLink(), fg("neutral.emphasis")]}>
								#{tag}
								<span mix={[fg("neutral.muted")]}> {count}</span>
							</a>
						))}
					</p>
				</nav>
			</div>
		);
	};
}
