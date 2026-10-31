/**
 * The reader drawn for the public pages: its window with the sidebar every signed-in page
 * wears, and the three faces the hero switches between — the queue, a post read in place,
 * and one feed's own page. Labels come from the app's own dictionary, so it reads as the app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import {
	BookmarkCheckIcon,
	BookmarkIcon,
	CircleCheckIcon,
	CircleIcon,
	ExternalLinkIcon,
	FolderIcon,
	InboxIcon,
	PinIcon,
	RssIcon,
	SearchIcon,
	SettingsIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { ProductFrame } from "@sdxc/ui/patterns";

import type { SamplePost } from "~/resources/components/marketing/sample-data";

import {
	SAMPLE_ARTICLE,
	SAMPLE_FEEDS,
	SAMPLE_POSTS,
} from "~/resources/components/marketing/sample-data";

/** A hairline in the marketing palette, the same line the frame's chrome draws. */
export const HAIRLINE = "1px solid var(--ui-marketing-hairline, var(--ui-neutral-border))";

/**
 * The narrowest width the window lays out at. Below it a phone's media slot scales the
 * window down; above it the window reflows the way the app does, gaining its sidebar on a
 * wide stage just as the app gains its rail on a wide screen.
 */
const DESIGN_WIDTH = "24rem";

/** The container the window's body answers to, named so a nested query never catches it. */
const WINDOW = "reader-window";

/** Inline size at which the window shows the sidebar beside its page. */
const RAIL_AT = "44rem";

/** Inline size at which a queue row keeps its title and its source on one line. */
const WIDE_ROW_AT = "34rem";

/** The folder each sample folder key is labelled with, as the sample account named them. */
const FOLDER_NAMES = { news: "News", engineering: "Engineering", reading: "Reading" } as const;

namespace ReaderWindow {
	export interface Props {
		/** Describes what the window shows, for the frame's text alternative. */
		label: string;
		/** The window title in the frame's chrome. */
		title: string;
		/** The path the address bar shows after the reader's host. */
		path: string;
		t: Translate;
		/** Which sidebar entry is the page on screen. */
		active?: "reading" | "saved" | "feed";
		children: RemixNode;
	}
}

/**
 * The framed app window. It is one image to assistive technology, named by `label`, and
 * everything drawn inside is hidden from it. The window holds still, so it needs no
 * reduced-motion variant.
 */
export function ReaderWindow(handle: Handle<ReaderWindow.Props>) {
	return () => {
		let { active = "reading", children, label, path, t, title } = handle.props;

		return (
			<ProductFrame
				lights
				title={title}
				url={`reader.sergiodxa.com${path}`}
				designWidth={DESIGN_WIDTH}
				fit="scale"
				role="img"
				aria-label={label}
			>
				<div aria-hidden="true" data-slot="product-mockup" mix={[container(WINDOW)]}>
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "minmax(0, 1fr)",
								textAlign: "start",
								fontSize: "0.8125rem",
								lineHeight: "1.25rem",
								minBlockSize: "100%",
							}),
							at(RAIL_AT, WINDOW, raw({ gridTemplateColumns: "13.5rem minmax(0, 1fr)" })),
						]}
					>
						<Sidebar t={t} active={active} />
						<div mix={[raw({ minInlineSize: "0", padding: "1rem 1.125rem 1.25rem" })]}>
							{children}
						</div>
					</div>
				</div>
			</ProductFrame>
		);
	};
}

/** One entry of the sidebar: an icon, a name and the count waiting in it. */
function RailEntry(
	handle: Handle<{ icon: RemixNode; label: string; count?: number; current?: boolean }>,
) {
	return () => {
		let { count, current = false, icon, label } = handle.props;
		return (
			<div
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						padding: "0.3125rem 0.5rem",
						borderRadius: "0.375rem",
						minInlineSize: "0",
						color: current ? "var(--ui-neutral-fg-emphasis)" : "var(--ui-neutral-fg)",
						backgroundColor: current ? "var(--ui-neutral-bg-tint-hover)" : "transparent",
						fontWeight: current ? "600" : "400",
					}),
				]}
			>
				<span mix={[raw({ display: "inline-flex", color: "var(--ui-neutral-fg-muted)" })]}>
					{icon}
				</span>
				<span
					mix={[
						raw({
							flex: "1",
							minInlineSize: "0",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}),
					]}
				>
					{label}
				</span>
				{count ? (
					<span
						mix={[
							raw({
								fontVariantNumeric: "tabular-nums",
								fontSize: "0.75rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						{count}
					</span>
				) : null}
			</div>
		);
	};
}

/** A small caps label over one band of the sidebar, as the app names its groups. */
function RailHeading(handle: Handle<{ label: string }>) {
	return () => (
		<p
			mix={[
				raw({
					margin: "0.75rem 0 0.25rem",
					padding: "0 0.5rem",
					fontSize: "0.6875rem",
					fontWeight: "600",
					letterSpacing: "0.04em",
					textTransform: "uppercase",
					color: "var(--ui-neutral-fg-muted)",
				}),
			]}
		>
			{handle.props.label}
		</p>
	);
}

/**
 * The sidebar: the search box, the queue and the saved shelf, then the feeds — pinned
 * first, then each folder, then the unfiled ones, and the quiet ones last.
 */
function Sidebar(handle: Handle<{ t: Translate; active: "reading" | "saved" | "feed" }>) {
	return () => {
		let { active, t } = handle.props;
		let unread = SAMPLE_FEEDS.reduce((total, feed) => total + feed.unread, 0);
		let pinned = SAMPLE_FEEDS.filter((feed) => feed.pinned);
		let unfiled = SAMPLE_FEEDS.filter((feed) => feed.folder === null && !feed.quiet);
		let quiet = SAMPLE_FEEDS.filter((feed) => feed.quiet);
		let folders = (["news", "engineering", "reading"] as const).map((key) => ({
			name: FOLDER_NAMES[key],
			count: SAMPLE_FEEDS.filter((feed) => feed.folder === key).reduce(
				(total, feed) => total + feed.unread,
				0,
			),
		}));

		return (
			<div
				mix={[
					raw({ display: "none", padding: "0.875rem 0.625rem", borderInlineEnd: HAIRLINE }),
					at(RAIL_AT, WINDOW, raw({ display: "block" })),
				]}
			>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							padding: "0.375rem 0.5rem",
							marginBlockEnd: "0.625rem",
							border: HAIRLINE,
							borderRadius: "0.375rem",
							color: "var(--ui-neutral-fg-muted)",
							fontSize: "0.75rem",
						}),
					]}
				>
					<SearchIcon size={14} />
					<span>{t("search.placeholder")}</span>
				</div>
				<RailEntry
					icon={<InboxIcon size={14} />}
					label={t("nav.reading")}
					count={unread}
					current={active === "reading"}
				/>
				<RailEntry
					icon={<BookmarkIcon size={14} />}
					label={t("nav.saved")}
					current={active === "saved"}
				/>

				<RailHeading label={t("nav.pinned")} />
				{pinned.map((feed) => (
					<RailEntry
						key={feed.title}
						icon={<PinIcon size={14} />}
						label={feed.title}
						count={feed.unread}
					/>
				))}

				<RailHeading label={t("nav.feeds")} />
				{folders.map((folder) => (
					<RailEntry
						key={folder.name}
						icon={<FolderIcon size={14} />}
						label={folder.name}
						count={folder.count}
					/>
				))}
				{unfiled.map((feed) => (
					<RailEntry
						key={feed.title}
						icon={<RssIcon size={14} />}
						label={feed.title}
						count={feed.unread}
						current={active === "feed" && feed.title === "Harbor Daily"}
					/>
				))}

				<RailHeading label={t("nav.quiet")} />
				{quiet.map((feed) => (
					<RailEntry key={feed.title} icon={<RssIcon size={14} />} label={feed.title} />
				))}

				<div
					mix={[
						raw({
							marginBlockStart: "0.75rem",
							paddingBlockStart: "0.5rem",
							borderBlockStart: HAIRLINE,
						}),
					]}
				>
					<RailEntry icon={<SettingsIcon size={14} />} label={t("nav.settings")} />
				</div>
			</div>
		);
	};
}

/** A page heading inside the window, at the app's own size. */
function PageHeading(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<p
			mix={[
				raw({
					margin: "0",
					fontSize: "1.125rem",
					lineHeight: "1.5rem",
					fontWeight: "600",
					color: "var(--ui-neutral-fg-emphasis)",
					fontFamily: "var(--ui-font-sans)",
				}),
			]}
		>
			{handle.props.children}
		</p>
	);
}

/** A quiet control drawn as the app's small outlined buttons. */
function Control(handle: Handle<{ children: RemixNode; pressed?: boolean }>) {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					gap: "0.375rem",
					padding: "0.1875rem 0.5rem",
					borderRadius: "0.375rem",
					border: HAIRLINE,
					fontSize: "0.75rem",
					whiteSpace: "nowrap",
					color: handle.props.pressed ? "var(--ui-neutral-fg-emphasis)" : "var(--ui-neutral-fg)",
					backgroundColor: handle.props.pressed ? "var(--ui-neutral-bg-tint-hover)" : "transparent",
					fontWeight: handle.props.pressed ? "600" : "400",
				}),
			]}
		>
			{handle.props.children}
		</span>
	);
}

namespace QueueRows {
	export interface Props {
		posts: SamplePost[];
		t: Translate;
		/** Whether rows name their feed, which a single feed's page leaves out. */
		showSource?: boolean;
	}
}

/**
 * Posts as the timeline draws them: the read mark, the title in the reading face with the
 * feed's own line muted beside it, the feed and the time, and the save mark. A read post
 * fades back, which is what lets a reader scan for what is left.
 */
export function QueueRows(handle: Handle<QueueRows.Props>) {
	return () => {
		let { posts, showSource = true, t } = handle.props;
		return (
			<ol mix={[raw({ listStyle: "none", margin: "0", padding: "0" })]}>
				{posts.map((post) => (
					<li
						key={post.title}
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
								padding: "0.5rem 0",
								borderBlockEnd: HAIRLINE,
								opacity: post.read ? "0.6" : "1",
							}),
						]}
					>
						<span
							mix={[
								raw({
									display: "inline-flex",
									flexShrink: "0",
									color: post.read ? "var(--ui-neutral-fg-muted)" : "var(--ui-brand-fg)",
								}),
							]}
						>
							{post.read ? <CircleCheckIcon size={15} /> : <CircleIcon size={15} />}
						</span>
						<div
							mix={[
								raw({ flex: "1", minInlineSize: "0" }),
								at(
									WIDE_ROW_AT,
									WINDOW,
									raw({ display: "flex", alignItems: "baseline", gap: "0.75rem" }),
								),
							]}
						>
							<p
								mix={[
									raw({
										flex: "1",
										minInlineSize: "0",
										margin: "0",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
										fontFamily: "var(--ui-font-reading)",
										color: "var(--ui-neutral-fg-emphasis)",
									}),
								]}
							>
								{post.flagged ? (
									<span
										mix={[
											raw({
												marginInlineEnd: "0.5rem",
												fontSize: "0.75rem",
												fontWeight: "500",
												color: "var(--ui-brand-fg)",
												fontFamily: "var(--ui-font-sans)",
											}),
										]}
									>
										{t("timeline.flagged")}
									</span>
								) : null}
								<span mix={[raw({ fontWeight: "500" })]}>{post.title}</span>
								<span
									mix={[raw({ marginInlineStart: "0.5rem", color: "var(--ui-neutral-fg-muted)" })]}
								>
									{post.summary}
								</span>
							</p>
							<p
								mix={[
									raw({
										display: "flex",
										gap: "0.5rem",
										margin: "0.125rem 0 0",
										fontSize: "0.75rem",
										color: "var(--ui-neutral-fg-muted)",
										whiteSpace: "nowrap",
									}),
									at(WIDE_ROW_AT, WINDOW, raw({ margin: "0" })),
								]}
							>
								{showSource ? <span>{post.feed}</span> : null}
								<span
									mix={[
										raw({
											fontVariantNumeric: "tabular-nums",
											minInlineSize: "4.5rem",
											textAlign: "end",
										}),
									]}
								>
									{post.time}
								</span>
							</p>
						</div>
						<span
							mix={[
								raw({
									display: "inline-flex",
									flexShrink: "0",
									color: post.saved ? "var(--ui-brand-fg)" : "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{post.saved ? <BookmarkCheckIcon size={15} /> : <BookmarkIcon size={15} />}
						</span>
					</li>
				))}
			</ol>
		);
	};
}

namespace QueueView {
	export interface Props {
		t: Translate;
		/** The posts the queue holds; the sample account's morning when omitted. */
		posts?: SamplePost[];
		/** Feeds the page knows have posts on the way, said under the heading. */
		waiting?: number;
	}
}

/**
 * The queue: its heading, the read-state filter set to Unread, the two sweeping controls,
 * the line saying what is still arriving, and the posts newest first.
 */
export function QueueView(handle: Handle<QueueView.Props>) {
	return () => {
		let { posts = SAMPLE_POSTS, t, waiting = 2 } = handle.props;
		return (
			<div mix={[raw({ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "0.75rem" })]}>
				<div
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							justifyContent: "space-between",
							gap: "0.5rem",
						}),
					]}
				>
					<PageHeading>{t("reading.heading")}</PageHeading>
					<div mix={[raw({ display: "flex", gap: "0.375rem" })]}>
						<Control>{t("reading.filter.all")}</Control>
						<Control pressed>{t("reading.filter.unread")}</Control>
						<Control>{t("timeline.markAllRead.submit")}</Control>
					</div>
				</div>
				{waiting > 0 ? (
					<p
						mix={[
							raw({
								margin: "0",
								padding: "0.5rem 0.75rem",
								borderRadius: "0.375rem",
								fontSize: "0.75rem",
								color: "var(--ui-brand-fg-emphasis)",
								backgroundColor: "var(--ui-brand-bg-tint)",
							}),
						]}
					>
						{t("reading.waiting", { count: waiting })}
					</p>
				) : null}
				<QueueRows posts={posts} t={t} />
			</div>
		);
	};
}

/**
 * One post read in place: where it came from, its title and byline, and the article the
 * reader fetched from the publisher, set in the reading face with the original a click away.
 */
export function ArticleView(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		return (
			<article
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr)",
						gap: "0.75rem",
						maxInlineSize: "38rem",
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							justifyContent: "space-between",
							gap: "0.5rem",
						}),
					]}
				>
					<span mix={[raw({ fontSize: "0.75rem", color: "var(--ui-brand-fg)" })]}>
						{t("post.source", { feed: SAMPLE_ARTICLE.feed })}
					</span>
					<div mix={[raw({ display: "flex", gap: "0.375rem" })]}>
						<Control pressed>
							<BookmarkCheckIcon size={13} />
							{t("timeline.saved")}
						</Control>
						<Control>
							{t("post.original")}
							<ExternalLinkIcon size={12} />
						</Control>
					</div>
				</div>
				<p
					mix={[
						raw({
							margin: "0",
							fontFamily: "var(--ui-font-serif)",
							fontSize: "1.5rem",
							lineHeight: "1.2",
							color: "var(--ui-neutral-fg-emphasis)",
							textWrap: "balance",
						}),
					]}
				>
					{SAMPLE_ARTICLE.title}
				</p>
				<p mix={[raw({ margin: "0", fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}>
					{t("post.article.byline", { byline: SAMPLE_ARTICLE.byline })} · {SAMPLE_ARTICLE.date}
				</p>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "0.625rem",
							paddingBlockStart: "0.75rem",
							borderBlockStart: HAIRLINE,
							fontFamily: "var(--ui-font-serif)",
							fontSize: "0.9375rem",
							lineHeight: "1.6",
							color: "var(--ui-neutral-fg)",
						}),
					]}
				>
					{SAMPLE_ARTICLE.paragraphs.map((paragraph) => (
						<p key={paragraph} mix={[raw({ margin: "0" })]}>
							{paragraph}
						</p>
					))}
				</div>
			</article>
		);
	};
}

/**
 * One feed's own page: its name and when it was last checked, the span its posts stay for,
 * and the app's suggestion for a busy feed that keeps everything, over its newest posts.
 */
export function FeedView(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		let harbor = SAMPLE_FEEDS.find((feed) => feed.title === "Harbor Daily");
		let posts = SAMPLE_POSTS.filter((post) => post.feed === "Harbor Daily");
		return (
			<div mix={[raw({ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "0.75rem" })]}>
				<div
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							justifyContent: "space-between",
							gap: "0.5rem",
						}),
					]}
				>
					<div>
						<PageHeading>Harbor Daily</PageHeading>
						<p
							mix={[raw({ margin: "0", fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}
						>
							{harbor?.host} · {t("feeds.show.checked", { date: "6 min ago" })}
						</p>
					</div>
					<div mix={[raw({ display: "flex", gap: "0.375rem" })]}>
						<Control>{t("feeds.check.submit")}</Control>
						<Control>{t("timeline.markFeedRead")}</Control>
					</div>
				</div>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "0.5rem",
							padding: "0.75rem",
							borderRadius: "0.5rem",
							border: HAIRLINE,
						}),
					]}
				>
					<p
						mix={[
							raw({
								margin: "0",
								fontSize: "0.75rem",
								fontWeight: "600",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{t("feeds.velocity.legend")}
					</p>
					<div mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.375rem" })]}>
						{(["breaking", "news", "article", "essay", "evergreen"] as const).map((span) => (
							<Control key={span} pressed={span === "evergreen"}>
								{t(`feeds.velocity.name.${span}`)}
								<span mix={[raw({ color: "var(--ui-neutral-fg-muted)", fontWeight: "400" })]}>
									{t(`feeds.velocity.window.${span}`)}
								</span>
							</Control>
						))}
					</div>
					<p
						mix={[
							raw({
								margin: "0",
								fontSize: "0.75rem",
								color: "var(--ui-warning-fg)",
							}),
						]}
					>
						{t("feeds.velocity.suggestion", { count: harbor?.perDay ?? 0 })}
					</p>
				</div>
				<QueueRows posts={posts} t={t} showSource={false} />
			</div>
		);
	};
}
