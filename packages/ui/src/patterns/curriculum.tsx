/**
 * A course or book curriculum: parts with their totals, each a list of numbered lessons a
 * visitor can open to see the subtopics or a preview link, under an optional totals row,
 * so "what's inside" reads at a glance and in depth without leaving the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronRightIcon } from "@sdxc/icons";
import { combine, raw } from "@sdxc/u/general";
import { container, vstack } from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import { Badge } from "../components/badge.js";
import { HeadingScope, resolveHeadingLevel, TAG_BY_LEVEL } from "../components/heading-scope.js";

/** Container the parts' column step queries. */
const CONTAINER = "ui-marketing-curriculum";

/** Translucent line between lessons. */
const HAIRLINE = "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))";

/** Arrangement {@link Curriculum} applies when `layout` is omitted. */
const DEFAULT_LAYOUT: Curriculum.Layout = "columns";

/** Width of the chevron track at a lesson row's inline start. */
const CHEVRON_TRACK = "1rem";

/** Width of the lesson-number track, wide enough for three mono digits. */
const NUMBER_TRACK = "2rem";

/** Gap between a lesson row's tracks. */
const TRACK_GAP = "0.75rem";

/** How far a lesson's body is indented, so it starts under the title. */
const BODY_INDENT = `calc(${CHEVRON_TRACK} + ${NUMBER_TRACK} + 2 * ${TRACK_GAP})`;

/**
 * Prop types for {@link Curriculum} and its compound parts.
 */
export namespace Curriculum {
	/**
	 * How parts sit: side by side from the `lg` container (`columns`), or one under the
	 * other at every width (`stack`) for a course with many or long parts.
	 */
	export type Layout = "columns" | "stack";

	/**
	 * Props accepted by {@link Curriculum}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Arrangement. Defaults to {@link DEFAULT_LAYOUT}. */
		layout?: Layout;
		/** Totals above the parts, such as a `StatStrip` of chapters, pages and hours. */
		summary?: RemixNode;
		/** {@link Curriculum.Part} children. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Curriculum.Part}.
	 */
	export interface PartProps extends Omit<TagProps<"section">, "title"> {
		/** The part's title, rendered as a heading at the ambient depth. */
		title: RemixNode;
		/** The part's totals, such as "5 chapters · 112 pages". */
		meta?: RemixNode;
		/** {@link Curriculum.Lesson} children. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Curriculum.Lesson}.
	 */
	export interface LessonProps extends Omit<TagProps<"li">, "title"> {
		/** The lesson's number as shown, such as "01". */
		number: RemixNode;
		/** The lesson's title. */
		title: RemixNode;
		/** Length at the row's inline end, such as "18 pages" or "12 min". */
		meta?: RemixNode;
		/** A short flag after the title, such as "Free" or "Preview", drawn as a {@link Badge}. */
		badge?: RemixNode;
		/** Starts the lesson expanded. */
		open?: boolean;
		/**
		 * What opens under the row: subtopics, usually a `CheckList`, and a preview link.
		 * Without children the row is static and draws no chevron.
		 */
		children?: RemixNode;
	}
}

/**
 * Lays the optional summary over the parts, and opens a heading scope so part titles sit
 * one level under the band's title.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the curriculum's markup.
 * @example
 * <Curriculum summary={<StatStrip>{totals}</StatStrip>}>
 * 	<Curriculum.Part title={t("part.one")} meta="5 chapters · 112 pages">
 * 		<Curriculum.Lesson number="01" title={t("ch.one")} meta="18 pages" badge="Free" />
 * 	</Curriculum.Part>
 * </Curriculum>
 */
export function Curriculum(handle: Handle<Curriculum.Props>) {
	return () => {
		let { children, layout, mix, summary, ...rest } = handle.props;
		let resolvedLayout = layout ?? DEFAULT_LAYOUT;

		return (
			<div
				{...rest}
				data-slot="curriculum"
				data-layout={resolvedLayout}
				mix={[
					container(CONTAINER),
					vstack({ gap: 10, align: "stretch" }),
					raw({ inlineSize: "100%" }),
					mix,
				]}
			>
				{summary ? <div data-slot="curriculum-summary">{summary}</div> : null}
				<HeadingScope>
					<div data-slot="curriculum-parts" mix={[parts(resolvedLayout)]}>
						{children}
					</div>
				</HeadingScope>
			</div>
		);
	};
}

/**
 * The parts' grid in one rule: one column, then, for `columns`, every part in one row of
 * equal tracks from the `lg` container whatever their count.
 */
function parts(layout: Curriculum.Layout) {
	return combine([
		raw({
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr)",
			alignItems: "start",
			rowGap: "3rem",
			columnGap: "2.5rem",
		}),
		layout === "columns"
			? at(
					"lg",
					CONTAINER,
					raw({
						gridTemplateColumns: "none",
						gridAutoFlow: "column",
						gridAutoColumns: "minmax(0, 1fr)",
					}),
				)
			: [],
	]);
}

/**
 * One part: its title and totals over a ruled list of lessons.
 *
 * @param handle Runtime handle carrying the host `<section>`'s props.
 * @returns The render function producing the part's markup.
 * @example
 * <Curriculum.Part title="Foundations" meta="4 chapters · 86 pages">{lessons}</Curriculum.Part>
 */
Curriculum.Part = function CurriculumPart(handle: Handle<Curriculum.PartProps>) {
	return () => {
		let { children, meta, mix, title, ...rest } = handle.props;
		let Tag = TAG_BY_LEVEL[resolveHeadingLevel(handle)];

		return (
			<section
				{...rest}
				data-slot="curriculum-part"
				mix={[vstack({ gap: 4, align: "stretch" }), raw({ minInlineSize: "0" }), mix]}
			>
				<header mix={[vstack({ gap: 1, align: "start" })]}>
					<Tag
						data-slot="curriculum-part-title"
						mix={[
							raw({
								margin: "0",
								fontSize: "var(--ui-text-xl, 1.25rem)",
								lineHeight: "1.75rem",
								fontWeight: "600",
								letterSpacing: "-0.01em",
								color: "var(--ui-neutral-fg-emphasis)",
								textWrap: "balance",
							}),
						]}
					>
						{title}
					</Tag>
					{meta ? (
						<p data-slot="curriculum-part-meta" mix={[monoMeta(), raw({ margin: "0" })]}>
							{meta}
						</p>
					) : null}
				</header>
				<ol data-slot="curriculum-lessons" mix={[lessonList()]}>
					{children}
				</ol>
			</section>
		);
	};
};

/** Mono, muted, tabular small print shared by part totals, lesson numbers and lesson meta. */
function monoMeta() {
	return raw({
		fontFamily: "var(--ui-font-mono, ui-monospace, monospace)",
		fontSize: "var(--ui-text-sm, 0.875rem)",
		lineHeight: "1.5rem",
		fontVariantNumeric: "tabular-nums",
		color: "var(--ui-neutral-fg-muted)",
	});
}

/** The lesson list: unstyled, with a hairline above every row and under the last. */
function lessonList() {
	return combine([
		raw({ listStyle: "none", margin: "0", padding: "0" }),
		when("& > li", raw({ borderBlockStart: `1px solid ${HAIRLINE}` })),
		when("& > li:last-child", raw({ borderBlockEnd: `1px solid ${HAIRLINE}` })),
	]);
}

/**
 * The summary row in one rule: chevron, number, title (with its badge) and meta tracks on a
 * shared first baseline, at least 44px tall, so the meta stays at the inline end however
 * far the title wraps. Only an expandable row takes the pointer cursor and hover underline.
 */
function lessonSummary(expandable: boolean) {
	return combine([
		raw({
			display: "grid",
			gridTemplateColumns: `${CHEVRON_TRACK} ${NUMBER_TRACK} minmax(0, 1fr) auto`,
			columnGap: TRACK_GAP,
			alignItems: "baseline",
			minBlockSize: "2.75rem",
			boxSizing: "border-box",
			paddingBlock: "0.625rem",
			cursor: expandable ? "pointer" : "default",
			listStyle: "none",
			outlineOffset: "2px",
		}),
		when("&::-webkit-details-marker", raw({ display: "none" })),
		when("&::marker", raw({ content: '""' })),
		when(
			'& > [data-slot="curriculum-lesson-chevron"]',
			raw({
				alignSelf: "start",
				display: "grid",
				placeItems: "center",
				blockSize: "1.5rem",
				color: "var(--ui-neutral-fg-muted)",
			}),
		),
		when(
			'& > [data-slot="curriculum-lesson-chevron"] > svg',
			raw({ inlineSize: "1rem", blockSize: "1rem" }),
		),
		when(
			'& > [data-slot="curriculum-lesson-chevron"] > svg',
			motionSafe(raw({ transition: "rotate 200ms" })),
		),
		expandable
			? when(
					'&:hover > [data-slot="curriculum-lesson-title"]',
					raw({
						textDecoration: "underline",
						textUnderlineOffset: "0.2em",
						textDecorationThickness: "1px",
					}),
				)
			: [],
	]);
}

/**
 * One lesson as a native disclosure row: the summary shows the chevron, number, title,
 * badge and meta; the children open under the title and the chevron turns while open.
 *
 * @param handle Runtime handle carrying the host `<li>`'s props.
 * @returns The render function producing the lesson's list item.
 * @example
 * <Curriculum.Lesson number="03" title={t("ch.measure")} meta="22 pages" badge="Preview">
 * 	<CheckList>{subtopics}</CheckList>
 * </Curriculum.Lesson>
 */
Curriculum.Lesson = function CurriculumLesson(handle: Handle<Curriculum.LessonProps>) {
	return () => {
		let { badge, children, meta, mix, number, open, title, ...rest } = handle.props;

		let row = (
			<>
				<span data-slot="curriculum-lesson-chevron" aria-hidden="true">
					{children ? <ChevronRightIcon /> : null}
				</span>
				<span data-slot="curriculum-lesson-number" mix={[monoMeta()]}>
					{number}
				</span>
				<span
					data-slot="curriculum-lesson-title"
					mix={[
						raw({
							fontSize: "var(--ui-text-base, 1rem)",
							lineHeight: "1.5rem",
							fontWeight: "500",
							color: "var(--ui-neutral-fg-emphasis)",
							textWrap: "pretty",
							overflowWrap: "anywhere",
						}),
					]}
				>
					{title}
					{badge ? (
						<Badge
							variant="secondary"
							color="brand"
							data-slot="curriculum-lesson-badge"
							mix={[raw({ marginInlineStart: "0.5rem", verticalAlign: "0.0625rem" })]}
						>
							{badge}
						</Badge>
					) : null}
				</span>
				<span
					data-slot="curriculum-lesson-meta"
					mix={[monoMeta(), raw({ textAlign: "end", whiteSpace: "nowrap" })]}
				>
					{meta}
				</span>
			</>
		);

		if (!children) {
			return (
				<li {...rest} data-slot="curriculum-lesson" mix={mix}>
					<div data-slot="curriculum-lesson-row" mix={[lessonSummary(false)]}>
						{row}
					</div>
				</li>
			);
		}

		return (
			<li {...rest} data-slot="curriculum-lesson" mix={mix}>
				<details
					open={open}
					mix={[
						when(
							'&[open] > summary > [data-slot="curriculum-lesson-chevron"] > svg',
							raw({ rotate: "90deg" }),
						),
					]}
				>
					<summary data-slot="curriculum-lesson-row" mix={[lessonSummary(true)]}>
						{row}
					</summary>
					<div
						data-slot="curriculum-lesson-body"
						mix={[
							raw({
								display: "flex",
								flexDirection: "column",
								alignItems: "stretch",
								gap: "0.75rem",
								paddingInlineStart: BODY_INDENT,
								paddingBlockEnd: "1rem",
								fontSize: "var(--ui-text-sm, 0.875rem)",
								lineHeight: "1.5rem",
								color: "var(--ui-neutral-fg)",
							}),
						]}
					>
						{children}
					</div>
				</details>
			</li>
		);
	};
};
