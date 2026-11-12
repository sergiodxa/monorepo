/**
 * Chorus's home: the For you and Following timelines, a composer on top, and the "Show N new
 * posts" pill that rises while the visitor reads. The pill is plain CSS and a link, so new
 * posts arrive with or without script, and it appears without motion when motion is reduced.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowUpIcon, UsersIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";

import type { FeedItem } from "~/resources/views/demo-apps/chorus/feed";
import type { VisitorState } from "~/resources/views/demo-apps/chorus/state";

import { ChorusComposer } from "~/resources/views/demo-apps/chorus/composer";
import {
	ARRIVALS,
	FOR_YOU,
	ME,
	POSTS,
	findPerson,
	href,
} from "~/resources/views/demo-apps/chorus/data";
import {
	Feed,
	FeedEnd,
	FeedTabs,
	continuesAsThread,
	postById,
} from "~/resources/views/demo-apps/chorus/feed";
import { PersonAvatar } from "~/resources/views/demo-apps/chorus/parts";
import { ChorusShell, TABLET } from "~/resources/views/demo-apps/chorus/shell";
import { follows, viewPost } from "~/resources/views/demo-apps/chorus/state";

/** The two timelines. */
export type FeedKind = "for-you" | "following";

/** How long a reader is on the page before the first new posts are offered. */
const PILL_DELAY = "6s";

namespace HomeScreen {
	export interface Props {
		feed: FeedKind;
		/** How many batches of new posts the visitor has revealed. */
		arrived: number;
		state: VisitorState;
		now: number;
		/** A refused post's text and why, to show in the composer again. */
		draft?: { value: string; issue: string };
	}
}

/**
 * The page path of a timeline with some batches revealed, as forms return to it.
 *
 * @param feed The timeline.
 * @param arrived How many batches of new posts to show.
 */
export function homePage(feed: FeedKind, arrived = 0): string {
	let query = new URLSearchParams();
	if (feed === "following") query.set("feed", "following");
	if (arrived > 0) query.set("arrived", String(arrived));
	let search = query.toString();
	return search === "" ? "" : `?${search}`;
}

/**
 * The address of a timeline with some batches revealed.
 *
 * @param feed The timeline.
 * @param arrived How many batches of new posts to show.
 */
export function homeHref(feed: FeedKind, arrived = 0): string {
	return href(homePage(feed, arrived));
}

/**
 * The posts a timeline shows, top first: the visitor's own, then the batches they revealed,
 * newest batch first, then the timeline itself. Following keeps only people the visitor
 * follows, newest first.
 */
export function timeline(feed: FeedKind, arrived: number, state: VisitorState): FeedItem[] {
	let fresh: FeedItem[] = [...state.posts]
		.filter((post) => post.replyTo === undefined)
		.reverse()
		.flatMap((post) => {
			let view = postById(post.id, state);
			return view ? [{ post: view }] : [];
		});
	let revealed: FeedItem[] = ARRIVALS.slice(0, arrived)
		.reverse()
		.flatMap((batch, index) =>
			batch.map((post) => ({ post: viewPost(post, state), arrived: index === 0 })),
		);
	let followed = (handle: string) => {
		let person = findPerson(handle);
		return person !== undefined && (person.handle === ME.handle || follows(state, person));
	};

	if (feed === "following") {
		let posts = POSTS.filter((post) => post.replyTo === undefined && followed(post.author))
			.map((post) => viewPost(post, state))
			.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
			.map((post) => ({ post, threadLink: continuesAsThread(post) }));
		return [...fresh, ...revealed.filter((item) => followed(item.post.author)), ...posts];
	}

	let entries = FOR_YOU.flatMap((entry) => {
		let post = postById(entry.post, state);
		if (!post) return [];
		return [
			{
				post,
				repostedBy: entry.repostedBy ? findPerson(entry.repostedBy) : undefined,
				threadLink: continuesAsThread(post),
			},
		];
	});
	return [...fresh, ...revealed, ...entries];
}

/** The pill offering the next batch, with its authors' faces; it rises after a pause. */
function NewPostsPill(handle: Handle<{ feed: FeedKind; arrived: number }>) {
	return () => {
		let { arrived, feed } = handle.props;
		let batch = ARRIVALS[arrived];
		if (!batch) return null;
		let people = batch.flatMap((post) => findPerson(post.author) ?? []).slice(0, 3);
		return (
			<div
				mix={[
					raw({
						position: "sticky",
						insetBlockStart: "4.25rem",
						zIndex: "15",
						display: "flex",
						justifyContent: "center",
						blockSize: "0",
					}),
				]}
			>
				<a
					href={homeHref(feed, arrived + 1)}
					data-slot="chorus-new-posts"
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.5rem",
							blockSize: "2.5rem",
							paddingInline: "0.75rem 1rem",
							borderRadius: "999px",
							color: "white",
							backgroundColor: "var(--ui-brand-bg-solid)",
							fontSize: "0.9375rem",
							fontWeight: "700",
							textDecoration: "none",
							boxShadow: "0 8px 24px -10px var(--ui-color-brand-700), 0 1px 3px rgb(0 0 0 / 0.15)",
							animation: `chorus-pill-in 420ms cubic-bezier(0.2, 0.8, 0.2, 1) ${PILL_DELAY} both`,
							"@keyframes chorus-pill-in": {
								from: { opacity: "0", translate: "0 -1rem", visibility: "hidden" },
								to: { opacity: "1", translate: "0 0", visibility: "visible" },
							},
						}),
						when("&:hover", raw({ backgroundColor: "var(--ui-brand-bg-solid-hover)" })),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "3px" }),
						),
						motionReduce(raw({ animationDuration: "1ms" })),
					]}
				>
					<ArrowUpIcon size={16} aria-hidden="true" />
					<span
						mix={[raw({ display: "inline-flex", "& > * + *": { marginInlineStart: "-0.5rem" } })]}
					>
						{people.map((person) => (
							<span
								mix={[
									raw({
										display: "inline-flex",
										borderRadius: "999px",
										boxShadow: "0 0 0 2px var(--ui-brand-bg-solid)",
									}),
								]}
							>
								<PersonAvatar person={person} size={1.5} />
							</span>
						))}
					</span>
					Show {batch.length} new posts
				</a>
			</div>
		);
	};
}

/** Renders the home screen. */
export function HomeScreen(handle: Handle<HomeScreen.Props>) {
	return () => {
		let { arrived, draft, feed, now, state } = handle.props;
		let items = timeline(feed, arrived, state);
		return (
			<ChorusShell
				current="home"
				phoneBar
				header={
					<FeedTabs
						label="Timelines"
						tabs={[
							{ label: "For you", href: homeHref("for-you"), current: feed === "for-you" },
							{ label: "Following", href: homeHref("following"), current: feed === "following" },
						]}
					/>
				}
			>
				<h1
					mix={[
						raw({
							position: "absolute",
							inlineSize: "1px",
							blockSize: "1px",
							overflow: "hidden",
							clipPath: "inset(50%)",
						}),
					]}
				>
					{feed === "following" ? "Home: Following" : "Home: For you"}
				</h1>
				<div
					mix={[
						raw({
							display: draft ? "block" : "none",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
							[`@media ${TABLET}`]: { display: "block" },
						}),
					]}
				>
					<ChorusComposer
						id="home"
						from={homePage(feed, arrived)}
						placeholder="Share something with your circle"
						value={draft?.value}
						issue={draft?.issue}
					/>
				</div>
				<NewPostsPill feed={feed} arrived={arrived} />
				{items.length === 0 ? (
					<Empty kind="first-run" icon={<UsersIcon />}>
						<Empty.Title>Follow people to fill this timeline</Empty.Title>
						<Empty.Description>
							Following shows posts from the people you follow, newest first.
						</Empty.Description>
						<Empty.Action>
							<LinkButton href={href("explore?tab=people")}>Find people</LinkButton>
						</Empty.Action>
					</Empty>
				) : (
					<>
						<Feed
							items={items}
							state={state}
							now={now}
							returnTo={homePage(feed, arrived)}
							label={feed === "following" ? "Following timeline" : "For you timeline"}
						/>
						<FeedEnd>You're all caught up.</FeedEnd>
					</>
				)}
			</ChorusShell>
		);
	};
}
