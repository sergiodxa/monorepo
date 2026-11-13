/**
 * Chorus's post, compose and saved screens: a post with the thread above it and its replies
 * below, the composer on its own page for a new post, a reply or a quote, and the posts the
 * visitor saved for later.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { BookmarkIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";

import type { FeedItem } from "~/resources/views/demo-apps/chorus/feed";
import type { PostView, VisitorState } from "~/resources/views/demo-apps/chorus/state";

import { ChorusComposer } from "~/resources/views/demo-apps/chorus/composer";
import { ARRIVED_POSTS, ME, POSTS, href } from "~/resources/views/demo-apps/chorus/data";
import { Feed, FeedEnd, TitleBar, postById } from "~/resources/views/demo-apps/chorus/feed";
import { FocalPost, PostCard, QuotedPost } from "~/resources/views/demo-apps/chorus/post";
import { ChorusColumn } from "~/resources/views/demo-apps/chorus/shell";
import { isOn } from "~/resources/views/demo-apps/chorus/state";

/** Every post a visitor can see, fixtures, arrivals and their own, as they see it. */
function allPosts(state: VisitorState): PostView[] {
	let ids = [...POSTS, ...ARRIVED_POSTS].map((post) => post.id);
	ids.push(...state.posts.map((post) => post.id));
	return ids.flatMap((id) => postById(id, state) ?? []);
}

/**
 * The posts a post replies to, oldest first, so the thread reads top to bottom above it.
 *
 * @param post The post.
 * @param state The visitor's state.
 */
function ancestors(post: PostView, state: VisitorState): PostView[] {
	let chain: PostView[] = [];
	let parent = post.replyTo ? postById(post.replyTo, state) : undefined;
	while (parent && chain.length < 8) {
		chain.unshift(parent);
		parent = parent.replyTo ? postById(parent.replyTo, state) : undefined;
	}
	return chain;
}

/**
 * A post's replies as a feed: the author's own continuation first, then the visitor's newest
 * first, then the rest by likes; a reply's first answer follows it on the same thread line.
 */
export function replyItems(post: PostView, state: VisitorState): FeedItem[] {
	let posts = allPosts(state);
	let direct = posts.filter((candidate) => candidate.replyTo === post.id);
	let rank = (reply: PostView) => {
		if (reply.author === post.author) return 0;
		if (reply.fresh) return 1;
		return 2;
	};
	direct.sort(
		(a, b) =>
			rank(a) - rank(b) ||
			(a.fresh && b.fresh ? Date.parse(b.at) - Date.parse(a.at) : b.likes - a.likes),
	);
	return direct.flatMap((reply) => {
		let answer = posts.find((candidate) => candidate.replyTo === reply.id);
		if (!answer) return [{ post: reply }];
		return [
			{ post: reply, threadNext: true },
			{ post: answer, threadPrev: true },
		];
	});
}

namespace PostScreen {
	export interface Props {
		post: PostView;
		state: VisitorState;
		now: number;
		/** A refused reply's text and why. */
		draft?: { value: string; issue: string };
	}
}

/** A post with the thread above it, its reply box, and its replies below. */
export function PostScreen(handle: Handle<PostScreen.Props>) {
	return () => {
		let { draft, now, post, state } = handle.props;
		let above = ancestors(post, state);
		let replies = replyItems(post, state);
		let page = `post/${post.id}`;
		return (
			<ChorusColumn current="none" compose={false} header={<TitleBar title="Post" back={href()} />}>
				{above.map((parent, index) => (
					<PostCard
						post={parent}
						quoted={parent.quote ? postById(parent.quote, state) : undefined}
						threadNext
						threadPrev={index > 0}
						returnTo={page}
						now={now}
					/>
				))}
				<FocalPost
					post={post}
					quoted={post.quote ? postById(post.quote, state) : undefined}
					threadPrev={above.length > 0}
					returnTo={page}
					now={now}
				/>
				<div mix={[raw({ borderBlockEnd: "1px solid var(--ui-neutral-border)" })]}>
					<ChorusComposer
						id="reply"
						from={page}
						revision={state.posts.length}
						placeholder={`Reply to ${post.person.name}`}
						submit="Reply"
						replyTo={post.id}
						value={draft?.value}
						issue={draft?.issue}
					/>
				</div>
				<Feed items={replies} state={state} now={now} returnTo={page} label="Replies" />
				{replies.length === 0 ? (
					<FeedEnd>No replies yet. Start the conversation.</FeedEnd>
				) : (
					<FeedEnd>End of replies.</FeedEnd>
				)}
			</ChorusColumn>
		);
	};
}

/** The compose page's title and own address, for a reply, a quote or a new post. */
function composeMode(replyTo?: PostView, quote?: PostView): { title: string; from: string } {
	if (replyTo) return { title: "Reply", from: `compose?reply=${replyTo.id}` };
	if (quote) return { title: "Quote post", from: `compose?quote=${quote.id}` };
	return { title: "New post", from: "compose" };
}

namespace ComposeScreen {
	export interface Props {
		state: VisitorState;
		now: number;
		/** The post being replied to. */
		replyTo?: PostView;
		/** The post being quoted. */
		quote?: PostView;
		draft?: { value: string; issue: string };
	}
}

/**
 * The composer on its own page, which the phone's compose button and every Reply and Quote
 * open: a reply shows the post it answers above, joined by the thread line; a quote shows
 * the quoted post under the field.
 */
export function ComposeScreen(handle: Handle<ComposeScreen.Props>) {
	return () => {
		let { draft, now, quote, replyTo, state } = handle.props;
		let { from, title } = composeMode(replyTo, quote);
		let back = replyTo ? href(`post/${replyTo.id}`) : href();
		return (
			<ChorusColumn
				current="none"
				compose={false}
				tabBar={false}
				header={<TitleBar title={title} back={back} />}
			>
				{replyTo ? (
					<PostCard
						post={replyTo}
						quoted={replyTo.quote ? postById(replyTo.quote, state) : undefined}
						threadNext
						returnTo={`compose?reply=${replyTo.id}`}
						now={now}
					/>
				) : null}
				<ChorusComposer
					id="compose"
					from={from}
					placeholder={
						replyTo ? `Reply to ${replyTo.person.name}` : "Share something with your circle"
					}
					submit={replyTo ? "Reply" : "Post"}
					replyTo={replyTo?.id}
					quote={quote?.id}
					value={draft?.value}
					issue={draft?.issue}
					autofocus
					tall
					attachment={quote ? <QuotedPost quoted={quote} now={now} /> : undefined}
				/>
			</ChorusColumn>
		);
	};
}

/** The posts the visitor saved, newest saved first as far as the demo knows. */
export function BookmarksScreen(handle: Handle<{ state: VisitorState; now: number }>) {
	return () => {
		let { now, state } = handle.props;
		let saved = allPosts(state).filter((post) => isOn(state, "save", post.id, post.saved ?? false));
		return (
			<ChorusColumn
				current="bookmarks"
				phoneBar
				header={<TitleBar title="Saved" subtitle={`@${ME.handle}`} />}
			>
				{saved.length === 0 ? (
					<Empty kind="first-run" icon={<BookmarkIcon />}>
						<Empty.Title>Save posts for later</Empty.Title>
						<Empty.Description>
							Press the bookmark on any post to keep it here. Only you can see what you save.
						</Empty.Description>
						<Empty.Action>
							<LinkButton href={href()}>Back to your timeline</LinkButton>
						</Empty.Action>
					</Empty>
				) : (
					<Feed
						items={saved.map((post) => ({ post }))}
						state={state}
						now={now}
						returnTo="bookmarks"
						label="Saved posts"
					/>
				)}
			</ChorusColumn>
		);
	};
}
