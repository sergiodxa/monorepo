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
import { StatCard } from "@sdxc/ui/app/stat-card";
import { HeadingScope } from "@sdxc/ui/heading-scope";
import { RelativeTime } from "@sdxc/ui/relative-time";
import { Timeline } from "@sdxc/ui/timeline";

import type { Activity, Post } from "~/resources/views/demo-apps/inkwell/data";

import {
	ACTIVITY,
	findAuthor,
	minutesBefore,
	POSTS,
	postDate,
	wordCount,
} from "~/resources/views/demo-apps/inkwell/data";
import { href, Initials, SerifTitle } from "~/resources/views/demo-apps/inkwell/shell";

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

/** Props accepted by {@link HomeScreen}. */
interface HomeScreenProps {
	now: Date;
}

/**
 * The overview. Every count and row links to the screen that acts on it; nothing here is a
 * second copy of the posts list.
 */
export function HomeScreen(handle: Handle<HomeScreenProps>) {
	return () => {
		let { now } = handle.props;
		let drafts = POSTS.filter((post) => post.status === "draft");
		let scheduled = POSTS.filter((post) => post.status === "scheduled").sort(
			(a, b) => (a.scheduledInMinutes ?? 0) - (b.scheduledInMinutes ?? 0),
		);
		let changed = POSTS.filter((post) => post.changed);
		let published = POSTS.filter(
			(post) => post.status === "published" && (post.publishedMinutesAgo ?? 0) < 30 * 24 * 60,
		);
		let nextOut = scheduled[0];

		return (
			<div mix={[vstack({ gap: 6, align: "stretch" })]}>
				<PageHeader
					title={<SerifTitle>Good morning, Maya</SerifTitle>}
					description={`${drafts.length} drafts in progress and ${scheduled.length} posts queued. The next one goes out ${nextOut ? "in two days" : "when you schedule it"}.`}
					primaryAction={
						<LinkButton href={href("posts/new")} color="brand" size="sm">
							New post
						</LinkButton>
					}
				/>
				<StatCard.Group variant="cards" aria-label="This month">
					<StatCard href={href("posts?status=draft")}>
						<StatCard.Label>Drafts</StatCard.Label>
						<StatCard.Value>{drafts.length}</StatCard.Value>
						<StatCard.Footer>One edited in the last hour</StatCard.Footer>
					</StatCard>
					<StatCard href={href("posts?status=scheduled")}>
						<StatCard.Label>Scheduled</StatCard.Label>
						<StatCard.Value>{scheduled.length}</StatCard.Value>
						<StatCard.Footer>Both in the next week</StatCard.Footer>
					</StatCard>
					<StatCard href={href("posts?status=published")}>
						<StatCard.Label>Published this month</StatCard.Label>
						<StatCard.Value>{published.length}</StatCard.Value>
						<StatCard.Delta trend="up" comparison="vs. last month">
							+1
						</StatCard.Delta>
					</StatCard>
					<StatCard href={href("posts?status=published")}>
						<StatCard.Label>Changed since publishing</StatCard.Label>
						<StatCard.Value>{changed.length}</StatCard.Value>
						<StatCard.Footer>Live copies are older than the drafts</StatCard.Footer>
					</StatCard>
				</StatCard.Group>
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
								<ul mix={[m(0), p(0), raw({ listStyle: "none" }), divide("block", "neutral")]}>
									{drafts.map((post) => (
										<DraftRow post={post} now={now} />
									))}
								</ul>
							</Panel>
							<Panel
								title="Going out next"
								link={{ href: href("posts?status=scheduled"), label: "All scheduled" }}
							>
								<ul mix={[m(0), p(0), raw({ listStyle: "none" }), divide("block", "neutral")]}>
									{scheduled.map((post) => (
										<ScheduledRow post={post} now={now} />
									))}
								</ul>
							</Panel>
						</div>
						<div mix={[vstack({ gap: 6, align: "stretch" })]}>
							<Panel title="Recent activity">
								<div mix={[p(4)]}>
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
								</div>
							</Panel>
							<Panel title="Reader comments">
								<HeadingScope level={3}>
									<Empty kind="error" size="compact">
										<Empty.Title>Couldn't load comments</Empty.Title>
										<Empty.Description>
											The comments service didn't answer. Your posts and drafts are unaffected.
										</Empty.Description>
										<Empty.Action>
											<LinkButton href={href()} variant="outline" color="neutral" size="sm">
												Retry
											</LinkButton>
										</Empty.Action>
										<Empty.RequestId label="Request ID">req_7f3a9c21e0</Empty.RequestId>
									</Empty>
								</HeadingScope>
							</Panel>
						</div>
					</div>
				</HeadingScope>
			</div>
		);
	};
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
				<span
					aria-hidden="true"
					mix={[
						vstack({ gap: 0, align: "center" }),
						rounded("md"),
						raw({
							inlineSize: "2.75rem",
							paddingBlock: "0.25rem",
							flexShrink: "0",
							backgroundColor: "var(--ui-brand-bg-tint)",
							color: "var(--ui-brand-fg)",
							lineHeight: "1.1",
						}),
					]}
				>
					<span mix={[text("xs"), weight("semibold"), raw({ textTransform: "uppercase" })]}>
						{date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}
					</span>
					<span mix={[font("serif"), weight("semibold"), raw({ fontSize: "1.125rem" })]}>
						{date.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" })}
					</span>
				</span>
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
