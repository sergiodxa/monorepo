/**
 * Inkwell's home: a light overview of the publication's week. Four counts that open their
 * lists, the drafts in progress and what is queued to go out, the masthead's recent
 * activity, and a comments panel showing how one failing region keeps to its own box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { CalendarClockIcon, FileTextIcon, PenLineIcon, SendIcon, SparklesIcon } from "@sdxc/icons";
import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { divide } from "@sdxc/u/overflow";
import { m, p } from "@sdxc/u/size";
import { font, tabularNums, text, truncate, weight } from "@sdxc/u/typography";
import { Link, LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { Skeleton } from "@sdxc/ui/app/skeleton";
import { StatCard } from "@sdxc/ui/app/stat-card";
import { HeadingScope } from "@sdxc/ui/heading-scope";
import { RelativeTime } from "@sdxc/ui/relative-time";
import { Timeline } from "@sdxc/ui/timeline";

import type { Activity, Post } from "~/resources/views/demo-apps/inkwell/data";

import DemoAppFrame from "~/resources/views/demo-apps/frame";
import {
	ACTIVITY,
	findAuthor,
	minutesBefore,
	POSTS,
	postDate,
	wordCount,
} from "~/resources/views/demo-apps/inkwell/data";
import { FrameRegion, TextBar } from "~/resources/views/demo-apps/inkwell/placeholders";
import {
	frameHref,
	href,
	Initials,
	SerifTitle,
	SLUG,
} from "~/resources/views/demo-apps/inkwell/shell";

/** The icon each kind of activity carries on the timeline. */
const ACTIVITY_ICON: Record<Activity["kind"], () => RemixNode> = {
	published: () => <SendIcon />,
	edited: () => <PenLineIcon />,
	scheduled: () => <CalendarClockIcon />,
	created: () => <SparklesIcon />,
	commented: () => <FileTextIcon />,
};

/** How many activity lines show before the rest fold into "N more". */
const VISIBLE_ACTIVITY = 4;

/** The comments panel's frame name, which its Retry link reloads on its own. */
const COMMENTS_FRAME = "inkwell-comments";

/**
 * The minimum heights the activity feed's region holds: the four visible events and the fold
 * at a phone's column and at the overview's side column, where the lines wrap less.
 */
export const ACTIVITY_REGION = { narrow: "19rem", wide: "14rem" } as const;

/** The minimum heights the comments panel's region holds, for its error state at either width. */
export const COMMENTS_REGION = { narrow: "18rem", wide: "15rem" } as const;

/** One of the overview's four counts: what it counts, the list it opens and its last line. */
interface Stat {
	label: string;
	status: Post["status"];
	count: (now: Date) => number;
	footer?: string;
	/** The change since last month, set on the line under the label instead of a footer. */
	delta?: { value: string; comparison: string };
}

/** The overview's counts, in the order the cards show them. */
const STATS: Stat[] = [
	{
		label: "Drafts",
		status: "draft",
		count: () => drafts().length,
		footer: "One edited in the last hour",
	},
	{
		label: "Scheduled",
		status: "scheduled",
		count: () => scheduled().length,
		footer: "Both in the next week",
	},
	{
		label: "Published this month",
		status: "published",
		count: () => publishedThisMonth().length,
		delta: { value: "+1", comparison: "vs. last month" },
	},
	{
		label: "Changed since publishing",
		status: "published",
		count: () => POSTS.filter((post) => post.changed).length,
		footer: "Live copies are older than the drafts",
	},
];

/** The posts still in the drawer. */
function drafts(): Post[] {
	return POSTS.filter((post) => post.status === "draft");
}

/** The queued posts, the next to go out first. */
function scheduled(): Post[] {
	return POSTS.filter((post) => post.status === "scheduled").sort(
		(a, b) => (a.scheduledInMinutes ?? 0) - (b.scheduledInMinutes ?? 0),
	);
}

/** The posts that went live in the last thirty days. */
function publishedThisMonth(): Post[] {
	return POSTS.filter(
		(post) => post.status === "published" && (post.publishedMinutesAgo ?? 0) < 30 * 24 * 60,
	);
}

/**
 * The overview. Every count and row links to the screen that acts on it; nothing here is a
 * second copy of the posts list. The counts, the panels' rows, the activity and the comments
 * stream in as frames under a header that answers at once.
 */
export function HomeScreen() {
	return () => {
		let draftCount = drafts().length;
		let queued = scheduled();
		let nextOut = queued[0];

		return (
			<div mix={[vstack({ gap: 6, align: "stretch" })]}>
				<PageHeader
					title={<SerifTitle>Good morning, Maya</SerifTitle>}
					description={`${draftCount} drafts in progress and ${queued.length} posts queued. The next one goes out ${nextOut ? "in two days" : "when you schedule it"}.`}
					primaryAction={
						<LinkButton href={href("posts/new")} color="brand" size="sm">
							New post
						</LinkButton>
					}
				/>
				<DemoAppFrame app={SLUG} part="home/stats" fallback={<StatsPlaceholder />} />
				<HeadingScope level={2}>
					<div
						mix={[
							raw({
								display: "grid",
								gap: "1.5rem",
								gridTemplateColumns: "minmax(0, 1fr)",
								"@container ui-app-content (min-width: 56rem)": {
									gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
								},
							}),
						]}
					>
						<div mix={[vstack({ gap: 6, align: "stretch" })]}>
							<Panel
								title="Drafts in progress"
								link={{ href: href("posts?status=draft"), label: "All drafts" }}
							>
								<DemoAppFrame
									app={SLUG}
									part="home/drafts"
									fallback={<RowsPlaceholder rows={draftCount} lead="initials" />}
								/>
							</Panel>
							<Panel
								title="Going out next"
								link={{ href: href("posts?status=scheduled"), label: "All scheduled" }}
							>
								<DemoAppFrame
									app={SLUG}
									part="home/scheduled"
									fallback={<RowsPlaceholder rows={queued.length} lead="leaf" />}
								/>
							</Panel>
						</div>
						<div mix={[vstack({ gap: 6, align: "stretch" })]}>
							<Panel title="Recent activity">
								<div mix={[p(4)]}>
									<FrameRegion {...ACTIVITY_REGION}>
										<DemoAppFrame
											app={SLUG}
											part="home/activity"
											fallback={<ActivityPlaceholder />}
										/>
									</FrameRegion>
								</div>
							</Panel>
							<Panel title="Reader comments">
								<FrameRegion {...COMMENTS_REGION}>
									<DemoAppFrame
										app={SLUG}
										part="home/comments"
										name={COMMENTS_FRAME}
										fallback={<CommentsPlaceholder />}
									/>
								</FrameRegion>
							</Panel>
						</div>
					</div>
				</HeadingScope>
			</div>
		);
	};
}

/** Props accepted by the overview's frame bodies. */
interface HomePartProps {
	now: Date;
}

/** The four counts as cards, each opening the list it counts. */
export function HomeStats(handle: Handle<HomePartProps>) {
	return () => {
		let { now } = handle.props;
		return (
			<StatCard.Group variant="cards" aria-label="This month">
				{STATS.map((stat) => (
					<StatCard href={href(`posts?status=${stat.status}`)}>
						<StatCard.Label>{stat.label}</StatCard.Label>
						<StatCard.Value>{stat.count(now)}</StatCard.Value>
						{stat.delta === undefined ? null : (
							<StatCard.Delta trend="up" comparison={stat.delta.comparison}>
								{stat.delta.value}
							</StatCard.Delta>
						)}
						{stat.footer === undefined ? null : <StatCard.Footer>{stat.footer}</StatCard.Footer>}
					</StatCard>
				))}
			</StatCard.Group>
		);
	};
}

/**
 * The counts' placeholder: the same four cards with their labels and footers, a bar where each
 * number goes and the delta's room held, so the cards keep their height when the counts land.
 */
export function StatsPlaceholder() {
	return () => (
		<StatCard.Group variant="cards" aria-hidden="true">
			{STATS.map((stat) => (
				<StatCard>
					<StatCard.Label>{stat.label}</StatCard.Label>
					<StatCard.Value>
						<TextBar width="1.5ch" />
					</StatCard.Value>
					{stat.delta === undefined ? null : (
						<StatCard.Delta
							trend="up"
							comparison={stat.delta.comparison}
							mix={[raw({ visibility: "hidden" })]}
						>
							{stat.delta.value}
						</StatCard.Delta>
					)}
					{stat.footer === undefined ? null : <StatCard.Footer>{stat.footer}</StatCard.Footer>}
				</StatCard>
			))}
		</StatCard.Group>
	);
}

/** The drafts in progress, most recently edited first as the fixtures order them. */
export function DraftList(handle: Handle<HomePartProps>) {
	return () => (
		<ul mix={[m(0), p(0), raw({ listStyle: "none" }), divide("block", "neutral")]}>
			{drafts().map((post) => (
				<DraftRow post={post} now={handle.props.now} />
			))}
		</ul>
	);
}

/** The queued posts, the next to go out first. */
export function ScheduledList(handle: Handle<HomePartProps>) {
	return () => (
		<ul mix={[m(0), p(0), raw({ listStyle: "none" }), divide("block", "neutral")]}>
			{scheduled().map((post) => (
				<ScheduledRow post={post} now={handle.props.now} />
			))}
		</ul>
	);
}

/** Props accepted by {@link RowsPlaceholder}. */
interface RowsPlaceholderProps {
	rows: number;
	/** What leads each row: an author's initials or a calendar leaf. */
	lead: "initials" | "leaf";
}

/**
 * A panel list's placeholder: as many rows as the list has, each with its lead, a title line
 * and a byline line set in the real rows' type, so every row keeps its height.
 */
export function RowsPlaceholder(handle: Handle<RowsPlaceholderProps>) {
	return () => {
		let { rows, lead } = handle.props;
		return (
			<ul
				aria-hidden="true"
				mix={[m(0), p(0), raw({ listStyle: "none" }), divide("block", "neutral")]}
			>
				{Array.from({ length: rows }, (_, row) => (
					<li mix={[hstack({ gap: 3, align: "center" }), raw({ padding: "0.75rem 1rem" })]}>
						{lead === "leaf" ? (
							<CalendarLeaf date={null} />
						) : (
							<Skeleton
								mix={[
									raw({
										inlineSize: "1.5rem",
										blockSize: "1.5rem",
										flexShrink: "0",
										borderRadius: "9999px",
									}),
								]}
							/>
						)}
						<span
							mix={[
								vstack({ gap: 0, align: "stretch" }),
								raw({ flex: "1 1 auto", minInlineSize: "0" }),
							]}
						>
							<span mix={[font("serif"), weight("semibold"), raw({ fontSize: "1rem" })]}>
								<TextBar width={row % 2 === 0 ? "60%" : "45%"} />
							</span>
							<span mix={[text("xs")]}>
								<TextBar width="35%" />
							</span>
						</span>
					</li>
				))}
			</ul>
		);
	};
}

/** The masthead's latest events, the older ones folded behind "N more events". */
export function ActivityFeed(handle: Handle<HomePartProps>) {
	return () => {
		let { now } = handle.props;
		return (
			<Timeline>
				{ACTIVITY.slice(0, VISIBLE_ACTIVITY).map((entry) => (
					<ActivityEvent entry={entry} now={now} />
				))}
				<Timeline.More summary={`${ACTIVITY.length - VISIBLE_ACTIVITY} more events`}>
					{ACTIVITY.slice(VISIBLE_ACTIVITY).map((entry) => (
						<ActivityEvent entry={entry} now={now} />
					))}
				</Timeline.More>
			</Timeline>
		);
	};
}

/** The activity feed's placeholder: a line for each visible event and one for the fold. */
export function ActivityPlaceholder() {
	return () => (
		<Skeleton.List
			rows={VISIBLE_ACTIVITY + 1}
			avatar
			lines={1}
			mix={[raw({ "--ui-skeleton-list-row-block-size": "2.5rem" })]}
		/>
	);
}

/**
 * The comments panel, standing in for a service that failed: its error keeps to the panel,
 * and Retry reloads just this frame, or the whole overview where nothing runs on the page.
 */
export function ReaderComments() {
	return () => (
		<div mix={[raw({ flex: "1 1 auto", display: "grid", alignContent: "center" })]}>
			<HeadingScope level={3}>
				<Empty kind="error" size="compact">
					<Empty.Title>Couldn't load comments</Empty.Title>
					<Empty.Description>
						The comments service didn't answer. Your posts and drafts are unaffected.
					</Empty.Description>
					<Empty.Action>
						<LinkButton
							href={href()}
							data-rmx-target={COMMENTS_FRAME}
							data-rmx-src={frameHref("home/comments")}
							data-rmx-history="replace"
							data-rmx-reset-scroll="manual"
							variant="outline"
							color="neutral"
							size="sm"
						>
							Retry
						</LinkButton>
					</Empty.Action>
					<Empty.RequestId label="Request ID">req_7f3a9c21e0</Empty.RequestId>
				</Empty>
			</HeadingScope>
		</div>
	);
}

/** The comments panel's placeholder: three comment lines, each with its reader's avatar. */
export function CommentsPlaceholder() {
	return () => <Skeleton.List rows={3} avatar mix={[raw({ paddingBlock: "0.5rem" })]} />;
}

/** Props accepted by {@link Panel}. */
interface PanelProps {
	title: string;
	/** A "View all" link to the list the panel previews. */
	link?: { href: string; label: string };
	children: RemixNode;
}

/** A titled card on the overview, with an optional link to the full list it previews. */
function Panel(handle: Handle<PanelProps>) {
	return () => {
		let { title, link, children } = handle.props;
		return (
			<section
				mix={[
					rounded("lg"),
					border({ color: "neutral", width: 1 }),
					raw({ backgroundColor: "var(--ui-bg)", overflow: "hidden" }),
				]}
			>
				<header
					mix={[
						hstack({ gap: 2, align: "center" }),
						raw({
							padding: "0.75rem 1rem",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					<h2 mix={[m(0), font("serif"), text("base"), weight("semibold"), fg("neutral.emphasis")]}>
						{title}
					</h2>
					{link === undefined ? null : (
						<Link href={link.href} mix={[raw({ marginInlineStart: "auto" }), text("sm")]}>
							{link.label}
						</Link>
					)}
				</header>
				{children}
			</section>
		);
	};
}

/** Props accepted by {@link DraftRow}. */
interface DraftRowProps {
	post: Post;
	now: Date;
}

/** A draft as the overview lists it: title, author, length and the last edit. */
function DraftRow(handle: Handle<DraftRowProps>) {
	return () => {
		let { post, now } = handle.props;
		let author = findAuthor(post.authorId);
		return (
			<li mix={[hstack({ gap: 3, align: "center" }), raw({ padding: "0.75rem 1rem" })]}>
				<Initials author={author} />
				<span
					mix={[
						vstack({ gap: 0, align: "stretch" }),
						raw({ flex: "1 1 auto", minInlineSize: "0" }),
					]}
				>
					<a
						href={href(`posts/${post.id}`)}
						mix={[
							font("serif"),
							weight("semibold"),
							fg("neutral.emphasis"),
							truncate(),
							raw({ textDecoration: "none", fontSize: "1rem" }),
						]}
					>
						{post.title}
					</a>
					<span mix={[text("xs"), fg("neutral.muted"), truncate()]}>
						{`${author.name} · ${wordCount(post)} words`}
					</span>
				</span>
				<span mix={[text("xs"), fg("neutral.muted"), tabularNums(), raw({ whiteSpace: "nowrap" })]}>
					<RelativeTime
						date={minutesBefore(now, post.editedMinutesAgo)}
						now={now}
						locale="en-US"
						local
					/>
				</span>
			</li>
		);
	};
}

/** A queued post: when it goes out, as a calendar leaf, beside its title and author. */
function ScheduledRow(handle: Handle<DraftRowProps>) {
	return () => {
		let { post, now } = handle.props;
		let date = postDate(post, now);
		let author = findAuthor(post.authorId);
		return (
			<li mix={[hstack({ gap: 3, align: "center" }), raw({ padding: "0.75rem 1rem" })]}>
				<CalendarLeaf date={date} />
				<span
					mix={[
						vstack({ gap: 0, align: "stretch" }),
						raw({ flex: "1 1 auto", minInlineSize: "0" }),
					]}
				>
					<a
						href={href(`posts/${post.id}`)}
						mix={[
							font("serif"),
							weight("semibold"),
							fg("neutral.emphasis"),
							truncate(),
							raw({ textDecoration: "none", fontSize: "1rem" }),
						]}
					>
						{post.title}
					</a>
					<span mix={[text("xs"), fg("neutral.muted"), truncate()]}>
						{author.name}
						{" · "}
						<RelativeTime date={date} now={now} locale="en-US" local />
					</span>
				</span>
			</li>
		);
	};
}

/** Props accepted by {@link CalendarLeaf}. */
interface CalendarLeafProps {
	/** The day it shows, or `null` for a placeholder leaf of the same size. */
	date: Date | null;
}

/** When a queued post goes out, as a small calendar leaf of month over day. */
function CalendarLeaf(handle: Handle<CalendarLeafProps>) {
	return () => {
		let { date } = handle.props;
		let blank = "\u00a0";
		return (
			<span
				aria-hidden="true"
				mix={[
					vstack({ gap: 0, align: "center" }),
					rounded("md"),
					raw({
						inlineSize: "2.75rem",
						paddingBlock: "0.25rem",
						flexShrink: "0",
						backgroundColor: date === null ? "var(--ui-neutral-border)" : "var(--ui-brand-bg-tint)",
						color: "var(--ui-brand-fg)",
						lineHeight: "1.1",
					}),
				]}
			>
				<span mix={[text("xs"), weight("semibold"), raw({ textTransform: "uppercase" })]}>
					{date === null
						? blank
						: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}
				</span>
				<span mix={[font("serif"), weight("semibold"), raw({ fontSize: "1.125rem" })]}>
					{date === null
						? blank
						: date.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" })}
				</span>
			</span>
		);
	};
}

/** Props accepted by {@link ActivityEvent}. */
interface ActivityEventProps {
	entry: Activity;
	now: Date;
}

/** One line of history: who did what to which post, and when. */
function ActivityEvent(handle: Handle<ActivityEventProps>) {
	return () => {
		let { entry, now } = handle.props;
		let author = findAuthor(entry.authorId);
		let post = POSTS.find((candidate) => candidate.id === entry.postId);
		return (
			<Timeline.Event
				icon={ACTIVITY_ICON[entry.kind]()}
				tone={entry.tone}
				avatar={<Initials author={author} />}
				actor={author.name}
				time={
					<RelativeTime
						date={minutesBefore(now, entry.minutesAgo)}
						now={now}
						locale="en-US"
						local
					/>
				}
			>
				{`${entry.verb} `}
				<a href={href(`posts/${entry.postId}`)} mix={[fg("neutral.emphasis"), font("serif")]}>
					{post?.title ?? entry.postId}
				</a>
			</Timeline.Event>
		);
	};
}
