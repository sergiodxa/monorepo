/**
 * Noor's notifications: likes, reposts and follows grouped under one line ("Ana Sousa and 3
 * others liked your post") with the faces of who acted, and replies and mentions drawn as
 * posts you can answer. The newest unread ones carry a tint until they are seen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { AtSignIcon, BellIcon, HeartIcon, Repeat2Icon, UserPlusIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Empty } from "@sdxc/ui/app/empty";

import type { Notification, Person } from "~/resources/views/demo-apps/chorus/data";
import type { VisitorState } from "~/resources/views/demo-apps/chorus/state";

import { NOTIFICATIONS, findPerson, href } from "~/resources/views/demo-apps/chorus/data";
import {
	FeedTabs,
	TitleBar,
	postById,
	repliedPerson,
} from "~/resources/views/demo-apps/chorus/feed";
import {
	PersonAvatar,
	compact,
	fullDate,
	shortAge,
} from "~/resources/views/demo-apps/chorus/parts";
import { PostCard } from "~/resources/views/demo-apps/chorus/post";
import { ChorusShell } from "~/resources/views/demo-apps/chorus/shell";

/** The notification tabs: everything, or only what names Noor. */
export type NotificationTab = "all" | "mentions";

/** How many faces a group shows before the count takes over. */
const FACES = 6;

/**
 * The sentence a grouped notification reads as, naming the first person and counting the
 * rest: one name alone, two names joined, or "and N others".
 *
 * @param notification The notification.
 * @returns The sentence, such as "Ana Sousa and 3 others liked your post".
 */
export function groupSentence(notification: Notification): string {
	let people = notification.people.flatMap((handle) => findPerson(handle) ?? []);
	let others = people.length - 1 + (notification.others ?? 0);
	let first = people[0]?.name ?? "Someone";
	let who = "";
	if (others === 0) who = first;
	else if (others === 1 && people[1]) who = `${first} and ${people[1].name}`;
	else who = `${first} and ${others.toLocaleString("en")} others`;
	let verb = {
		like: "liked your post",
		repost: "reposted your post",
		follow: "followed you",
		reply: "replied to your post",
		mention: "mentioned you",
		post: "shared a new post",
	}[notification.kind];
	return `${who} ${verb}`;
}

/** The icon and its colour for each kind of group. */
function kindIcon(kind: Notification["kind"]): { icon: RemixNode; colour: string } {
	if (kind === "like")
		return {
			icon: <HeartIcon size={26} fill="currentColor" aria-hidden="true" />,
			colour: "oklch(0.6 0.2 5)",
		};
	if (kind === "repost")
		return { icon: <Repeat2Icon size={26} aria-hidden="true" />, colour: "oklch(0.58 0.15 152)" };
	if (kind === "follow")
		return { icon: <UserPlusIcon size={26} aria-hidden="true" />, colour: "var(--ui-brand-fg)" };
	if (kind === "mention")
		return { icon: <AtSignIcon size={26} aria-hidden="true" />, colour: "var(--ui-brand-fg)" };
	return {
		icon: <BellIcon size={26} fill="currentColor" aria-hidden="true" />,
		colour: "var(--ui-brand-fg)",
	};
}

namespace GroupRow {
	export interface Props {
		notification: Notification;
		state: VisitorState;
		now: number;
	}
}

/** A grouped notification: its icon, the faces of who acted, the sentence and the post's text. */
function GroupRow(handle: Handle<GroupRow.Props>) {
	return () => {
		let { notification, state } = handle.props;
		let people = notification.people.flatMap((person) => findPerson(person) ?? []);
		let post = notification.post ? postById(notification.post, state) : undefined;
		let target = post ? href(`post/${post.id}`) : href(`u/${people[0]?.handle ?? ""}`);
		let { colour, icon } = kindIcon(notification.kind);
		let sentence = groupSentence(notification);
		return (
			<article
				data-unread={notification.unread ? "" : undefined}
				aria-label={sentence}
				mix={[
					raw({
						position: "relative",
						display: "grid",
						gridTemplateColumns: "2.5rem minmax(0, 1fr)",
						columnGap: "0.75rem",
						padding: "0.75rem 1rem",
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
					}),
					when(
						"&[data-unread]",
						raw({
							backgroundColor: "color-mix(in oklch, var(--ui-brand-bg-tint) 70%, transparent)",
						}),
					),
					when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
				]}
			>
				<span mix={[raw({ display: "flex", justifyContent: "flex-end", color: colour })]}>
					{icon}
				</span>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "0.5rem",
							minInlineSize: "0",
							gridTemplateColumns: "minmax(0, 1fr)",
						}),
					]}
				>
					<span mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.25rem" })]}>
						{people.slice(0, FACES).map((person) => (
							<a
								href={href(`u/${person.handle}`)}
								aria-label={person.name}
								mix={[
									raw({
										position: "relative",
										zIndex: "1",
										display: "inline-flex",
										borderRadius: "999px",
									}),
								]}
							>
								<PersonAvatar person={person} size={2} />
							</a>
						))}
					</span>
					<p mix={[raw({ margin: "0", fontSize: "0.9375rem", lineHeight: "1.4" })]}>
						<a
							href={target}
							mix={[
								raw({
									color: "inherit",
									textDecoration: "none",
									"&::after": { content: '""', position: "absolute", inset: "0" },
								}),
								when("&:focus-visible", raw({ outline: "2px solid var(--ui-brand-ring)" })),
							]}
						>
							<SentenceText notification={notification} people={people} />
						</a>{" "}
						<time
							datetime={notification.at}
							title={fullDate(notification.at)}
							mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}
						>
							·{" "}
							{shortAge(
								Math.max(0, Date.parse("2026-11-12T15:00:00Z") - Date.parse(notification.at)),
								notification.at,
							)}
						</time>
						{notification.unread ? (
							<span
								mix={[
									raw({
										position: "absolute",
										inlineSize: "1px",
										overflow: "hidden",
										clipPath: "inset(50%)",
									}),
								]}
							>
								, unread
							</span>
						) : null}
					</p>
					{post ? (
						<p
							mix={[
								raw({
									margin: "0",
									fontSize: "0.9375rem",
									lineHeight: "1.4",
									color: "var(--ui-neutral-fg-muted)",
									display: "-webkit-box",
									WebkitLineClamp: "3",
									WebkitBoxOrient: "vertical",
									overflow: "hidden",
								}),
							]}
						>
							{post.text.replaceAll("`", "")}
						</p>
					) : null}
				</div>
			</article>
		);
	};
}

/** The sentence with the first name in bold, as a timeline reads a group. */
function SentenceText(handle: Handle<{ notification: Notification; people: Person[] }>) {
	return () => {
		let { notification, people } = handle.props;
		let sentence = groupSentence(notification);
		let first = people[0]?.name ?? "";
		return (
			<>
				<strong>{first}</strong>
				{sentence.slice(first.length)}
			</>
		);
	};
}

namespace NotificationsScreen {
	export interface Props {
		tab: NotificationTab;
		state: VisitorState;
		now: number;
	}
}

/** Renders the notifications with one of their tabs open. */
export function NotificationsScreen(handle: Handle<NotificationsScreen.Props>) {
	return () => {
		let { now, state, tab } = handle.props;
		let shown = NOTIFICATIONS.filter(
			(notification) =>
				tab === "all" || notification.kind === "reply" || notification.kind === "mention",
		);
		let page = tab === "all" ? "notifications" : "notifications?tab=mentions";
		return (
			<ChorusShell
				current="notifications"
				phoneBar
				header={
					<>
						<TitleBar title="Notifications" />
						<FeedTabs
							label="Notification filters"
							tabs={[
								{ label: "All", href: href("notifications"), current: tab === "all" },
								{
									label: "Mentions",
									href: href("notifications?tab=mentions"),
									current: tab === "mentions",
								},
							]}
						/>
					</>
				}
			>
				{shown.length === 0 ? (
					<Empty kind="cleared" icon={<AtSignIcon />}>
						<Empty.Title>Nothing to see here yet</Empty.Title>
						<Empty.Description>When someone mentions you, you'll find it here.</Empty.Description>
					</Empty>
				) : (
					<section aria-label={tab === "all" ? "All notifications" : "Mentions"}>
						{shown.map((notification) => {
							let post = notification.post ? postById(notification.post, state) : undefined;
							if ((notification.kind === "reply" || notification.kind === "mention") && post) {
								return (
									<PostCard
										post={post}
										replyingTo={
											notification.kind === "reply" ? repliedPerson(post, state) : undefined
										}
										returnTo={page}
										now={now}
									/>
								);
							}
							return <GroupRow notification={notification} state={state} now={now} />;
						})}
					</section>
				)}
				<p
					mix={[
						raw({
							margin: "0",
							padding: "2rem 1rem 3rem",
							textAlign: "center",
							fontSize: "0.9375rem",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					{compact(NOTIFICATIONS.length)} notifications from the last week.
				</p>
			</ChorusShell>
		);
	};
}
