/**
 * Tern's screens around the conversation: the chat with its canvas beside it, a shared chat
 * anyone with the link can read, search across chats, and a project's page with its chats,
 * instructions and files.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { FileTextIcon, MessageSquareIcon, SearchIcon, SquarePenIcon } from "@sdxc/icons";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import { grow, hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, p, pb, pi } from "@sdxc/u/size";
import { leading, text, truncate, weight } from "@sdxc/u/typography";
import { Button, HeadingScope, Input, LinkButton, RelativeTime } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { Skeleton } from "@sdxc/ui/app/skeleton";
import { SplitView } from "@sdxc/ui/app/split-view";

import type { Conversation, Project } from "~/resources/views/demo-apps/tern/data";
import type { Thread } from "~/resources/views/demo-apps/tern/thread";

import { demoAppCookiePath } from "~/resources/views/demo-apps";
import DemoAppFrame from "~/resources/views/demo-apps/frame";
import { CanvasPane } from "~/resources/views/demo-apps/tern/canvas";
import {
	ChatColumn,
	ChatMenu,
	ModelPicker,
	Turns,
	screenHeight,
} from "~/resources/views/demo-apps/tern/conversation";
import {
	CONVERSATIONS,
	NOW,
	PERSON,
	href,
	searchConversations,
} from "~/resources/views/demo-apps/tern/data";
import { SPLIT_LABELS } from "~/resources/views/demo-apps/tern/labels";
import { TernMark, TernShell } from "~/resources/views/demo-apps/tern/shell";
import { isSaved, threadTitle } from "~/resources/views/demo-apps/tern/thread";

/** The cookie the chat's width beside the canvas is remembered in. */
export const SPLIT_COOKIE = "tern-split";

namespace ChatScreen {
	export interface Props {
		thread: Thread;
		collapsed: boolean;
		/** The reply to replay as a stream, when the page answered a send. */
		streaming?: number;
		/** Whether the canvas is open beside the chat. */
		canvas?: boolean;
		layout?: SplitView.Layout;
	}
}

/**
 * Renders a conversation. With the canvas open, the chat and the document share the screen,
 * the chat at the list pane's width; on a phone the canvas is its own pane with a way back.
 */
export function ChatScreen(handle: Handle<ChatScreen.Props>) {
	return () => {
		let { thread, collapsed, streaming, canvas = false, layout } = handle.props;
		let base = thread.base;
		let linkPage = savedLinkPage(thread);
		let chat = <ChatColumn thread={thread} streaming={streaming} />;

		return (
			<TernShell
				current={base === null ? "none" : `chat:${base.id}`}
				collapsed={collapsed}
				crumb={threadTitle(thread)}
				flush
				actions={
					<>
						<ModelPicker thread={thread} linkPage={linkPage} />
						<ChatMenu thread={thread} />
					</>
				}
			>
				<div mix={[screenHeight(), raw({ "--ui-app-list-width": "30rem" })]}>
					{canvas && base?.canvas ? (
						<SplitView
							cookiePath={demoAppCookiePath("tern")}
							id="tern-canvas"
							list={chat}
							detail={
								<DemoAppFrame
									app="tern"
									part={`canvas/${base.id}`}
									fallback={<CanvasPane conversation={base} ghost />}
								/>
							}
							active="detail"
							backHref={href(`c/${base.id}`)}
							layout={layout}
							cookie={SPLIT_COOKIE}
							labels={SPLIT_LABELS}
						/>
					) : (
						chat
					)}
				</div>
			</TernShell>
		);
	};
}

/**
 * The page a saved chat's model links keep: the chat, with the canvas still open when it is.
 * A chat with sends has none, so its picker posts instead.
 */
function savedLinkPage(thread: Thread): string | undefined {
	if (!isSaved(thread) || thread.base === null) return undefined;
	return `c/${thread.base.id}`;
}

/** A shared chat, read-only and outside the shell, the way someone opening the link sees it. */
export function ShareScreen(handle: Handle<{ thread: Thread }>) {
	return () => {
		let { thread } = handle.props;
		let base = thread.base;
		if (base === null) return null;
		return (
			<div mix={[raw({ minBlockSize: "100dvh" }), bg()]}>
				<header
					mix={[
						hstack({ gap: 2, align: "center" }),
						pi(4),
						pb(3),
						borderEdge("bottom", { width: 1, color: "neutral" }),
					]}
				>
					<TernMark />
					<span mix={[weight("semibold")]}>Tern</span>
					<span mix={[grow()]} />
					<LinkButton href={href()} size="sm">
						<SquarePenIcon size={14} aria-hidden="true" />
						Start your own chat
					</LinkButton>
				</header>
				<main
					mix={[
						vstack({ gap: 8, align: "stretch" }),
						raw({ maxInlineSize: "48rem", marginInline: "auto", padding: "2.5rem 1rem 4rem" }),
					]}
				>
					<div mix={[vstack({ gap: 2, align: "start" })]}>
						<h1
							mix={[
								m(0),
								raw({ fontSize: "clamp(1.5rem, 1.25rem + 1vw, 2rem)", letterSpacing: "-0.02em" }),
								leading("tight"),
								weight("semibold"),
							]}
						>
							{base.title}
						</h1>
						<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
							Shared by {PERSON.name} · <RelativeTime date={base.updatedAt} now={NOW} locale="en" />{" "}
							· Read-only
						</p>
					</div>
					<div role="log" aria-label="Conversation" mix={[vstack({ gap: 7, align: "stretch" })]}>
						<HeadingScope level={2}>
							<Turns thread={thread} readOnly />
						</HeadingScope>
					</div>
					<div
						mix={[
							vstack({ gap: 3, align: "center" }),
							p(6),
							rounded("lg"),
							bg("brand.tint"),
							raw({ textAlign: "center" }),
						]}
					>
						<p mix={[m(0), weight("semibold")]}>Pick up where this left off</p>
						<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
							Your copy starts from this point. The person who shared it sees none of what you send.
						</p>
						<LinkButton href={href(`c/${base.id}`)}>Continue this chat</LinkButton>
					</div>
				</main>
			</div>
		);
	};
}

/** One chat in a list: its title, a line of it, and when it last changed. */
function ChatRow(handle: Handle<{ conversation: Conversation; snippet: string }>) {
	return () => {
		let { conversation, snippet } = handle.props;
		return (
			<li>
				<a
					href={href(`c/${conversation.id}`)}
					data-rmx-prefetch="intent"
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "1.25rem minmax(0, 1fr) auto",
							columnGap: "0.75rem",
							rowGap: "0.125rem",
							alignItems: "baseline",
							textDecoration: "none",
							color: "inherit",
							"&:hover": { background: "var(--ui-neutral-bg-tint-hover)" },
							"&:focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "-2px",
							},
						}),
						pi(3),
						pb(3),
						rounded("lg"),
					]}
				>
					<MessageSquareIcon size={16} aria-hidden="true" />
					<span mix={[text("sm"), weight("semibold"), truncate()]}>{conversation.title}</span>
					<span mix={[text("xs"), fg("neutral.muted")]}>
						<RelativeTime date={conversation.updatedAt} now={NOW} locale="en" />
					</span>
					<span />
					<span
						mix={[
							text("sm"),
							fg("neutral.muted"),
							raw({
								gridColumn: "2 / -1",
								display: "-webkit-box",
								WebkitLineClamp: "2",
								WebkitBoxOrient: "vertical",
								overflow: "hidden",
							}),
						]}
					>
						{snippet}
					</span>
				</a>
			</li>
		);
	};
}

/** Searches every chat by its words; the query is in the address, so a search is a link. */
export function SearchScreen(handle: Handle<{ query: string; collapsed: boolean }>) {
	return () => {
		let { query, collapsed } = handle.props;
		let results = searchConversations(query);
		let shown =
			query.trim() === ""
				? CONVERSATIONS.map((conversation) => ({
						conversation,
						snippet: conversation.turns[0]?.role === "user" ? conversation.turns[0].text : "",
					}))
				: results;

		return (
			<TernShell current="search" collapsed={collapsed} crumb="Search chats">
				<div
					mix={[
						vstack({ gap: 6, align: "stretch" }),
						raw({ maxInlineSize: "48rem", marginInline: "auto", inlineSize: "100%" }),
					]}
				>
					<PageHeader title="Search chats" description="Every chat, by any word in it." />
					<form
						method="get"
						action={href("search")}
						role="search"
						mix={[hstack({ gap: 2, align: "center" })]}
					>
						<Input
							type="search"
							name="q"
							defaultValue={query}
							aria-label="Search chats"
							placeholder="Search by a word from the chat"
							mix={[grow()]}
						/>
						<Button type="submit" color="neutral" variant="outline">
							<SearchIcon size={16} aria-hidden="true" />
							Search
						</Button>
					</form>
					<HeadingScope level={2}>
						{shown.length === 0 ? (
							<Empty kind="no-results" size="compact">
								<Empty.Title>No chats match “{query}”</Empty.Title>
								<Empty.Description>
									Try a single word, such as “email” or “Lisbon”.
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={href("search")} variant="outline" color="neutral">
										Clear search
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
							<section
								aria-labelledby="tern-search-results"
								mix={[vstack({ gap: 2, align: "stretch" })]}
							>
								<h2
									id="tern-search-results"
									mix={[m(0), text("xs"), weight("semibold"), fg("neutral.muted")]}
								>
									{query.trim() === ""
										? "All chats"
										: `${shown.length} ${shown.length === 1 ? "chat" : "chats"} found`}
								</h2>
								<ul mix={[vstack({ gap: 0.5, align: "stretch" }), m(0), p(0), listStyle()]}>
									{shown.map((result) => (
										<ChatRow conversation={result.conversation} snippet={result.snippet} />
									))}
								</ul>
							</section>
						)}
					</HeadingScope>
				</div>
			</TernShell>
		);
	};
}

/** A project's files, or with `ghost` their placeholder at the same size. */
export function ProjectFiles(handle: Handle<{ project: Project; ghost?: boolean }>) {
	return () => {
		let { project, ghost = false } = handle.props;
		let shown = (value: string) => (ghost ? <Skeleton.Text>{value}</Skeleton.Text> : value);
		return (
			<ul
				aria-label={ghost ? undefined : "Project files"}
				aria-hidden={ghost ? "true" : undefined}
				mix={[vstack({ gap: 0, align: "stretch" }), m(0), p(0), listStyle()]}
			>
				{project.files.map((file) => (
					<li
						mix={[
							hstack({ gap: 3, align: "center" }),
							pb(2.5),
							raw({
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
								"&:last-child": { borderBlockEnd: "none" },
							}),
						]}
					>
						<span mix={[raw({ color: "var(--ui-neutral-fg-muted)", display: "inline-flex" })]}>
							<FileTextIcon size={16} aria-hidden="true" />
						</span>
						<span mix={[vstack({ gap: 0, align: "start" }), grow(), raw({ minInlineSize: 0 })]}>
							<span
								mix={[text("sm"), weight("medium"), truncate(), raw({ maxInlineSize: "100%" })]}
							>
								{shown(file.name)}
							</span>
							<span mix={[text("xs"), fg("neutral.muted")]}>{shown(file.detail)}</span>
						</span>
					</li>
				))}
			</ul>
		);
	};
}

/** A project: its chats first, with its instructions and files beside them. */
export function ProjectScreen(handle: Handle<{ project: Project; collapsed: boolean }>) {
	return () => {
		let { project, collapsed } = handle.props;
		let chats = CONVERSATIONS.filter((conversation) => conversation.project === project.slug);
		let card = [
			vstack({ gap: 3, align: "stretch" }),
			p(4),
			rounded("lg"),
			border({ color: "neutral", width: 1 }),
		];

		return (
			<TernShell current={`project:${project.slug}`} collapsed={collapsed} crumb={project.name}>
				<div mix={[vstack({ gap: 6, align: "stretch" })]}>
					<PageHeader
						title={project.name}
						description={project.description}
						primaryAction={
							<LinkButton href={href()}>
								<SquarePenIcon size={16} aria-hidden="true" />
								New chat
							</LinkButton>
						}
					/>
					<div
						mix={[
							raw({ display: "grid", gap: "1.5rem", gridTemplateColumns: "minmax(0, 1fr)" }),
							media("(min-width: 64rem)", raw({ gridTemplateColumns: "minmax(0, 1fr) 20rem" })),
						]}
					>
						<section
							aria-labelledby="tern-project-chats"
							mix={[vstack({ gap: 2, align: "stretch" })]}
						>
							<h2 id="tern-project-chats" mix={[m(0), text("sm"), weight("semibold")]}>
								Chats · {chats.length}
							</h2>
							<ul mix={[vstack({ gap: 0.5, align: "stretch" }), m(0), p(0), listStyle()]}>
								{chats.map((conversation) => (
									<ChatRow
										conversation={conversation}
										snippet={
											conversation.turns[0]?.role === "user" ? conversation.turns[0].text : ""
										}
									/>
								))}
							</ul>
						</section>
						<aside mix={[vstack({ gap: 4, align: "stretch" })]} aria-label="About this project">
							<section aria-labelledby="tern-project-instructions" mix={card}>
								<h2 id="tern-project-instructions" mix={[m(0), text("sm"), weight("semibold")]}>
									Instructions
								</h2>
								<p mix={[m(0), text("sm"), leading("relaxed"), fg("neutral.muted")]}>
									{project.instructions}
								</p>
							</section>
							<section aria-labelledby="tern-project-files" mix={card}>
								<h2 id="tern-project-files" mix={[m(0), text("sm"), weight("semibold")]}>
									Files · {project.files.length}
								</h2>
								<DemoAppFrame
									app="tern"
									part={`projects/${project.slug}/files`}
									fallback={<ProjectFiles project={project} ghost />}
								/>
							</section>
						</aside>
					</div>
				</div>
			</TernShell>
		);
	};
}
