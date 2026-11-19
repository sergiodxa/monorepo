/**
 * Parley's Home and Search. Home is the catch-up: every conversation with unread lines, those
 * lines and a way to mark them read; on a phone it opens on the list of channels and direct
 * messages, the parent screen each conversation stacks on. Search finds messages anywhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CheckCheckIcon, SearchIcon, SearchXIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Button, LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";

import type { Conversation } from "~/resources/views/demo-apps/parley/data";
import type { Hit, Unread } from "~/resources/views/demo-apps/parley/model";
import type { VisitorState } from "~/resources/views/demo-apps/parley/state";

import {
	CONVERSATIONS,
	actionHref,
	conversationPage,
	conversationTitle,
	findPerson,
	href,
} from "~/resources/views/demo-apps/parley/data";
import { Days, messageAnchor } from "~/resources/views/demo-apps/parley/messages";
import {
	daysOf,
	entriesOf,
	readAt,
	timeOf,
	whenOf,
} from "~/resources/views/demo-apps/parley/model";
import { ChannelGlyph, Face } from "~/resources/views/demo-apps/parley/parts";
import { PHONE, ParleyPane, TO_MAIN } from "~/resources/views/demo-apps/parley/shell";

namespace ConversationRow {
	export interface Props {
		conversation: Conversation;
		unread: Unread;
		state: VisitorState;
		now: number;
	}
}

/**
 * One row of the phone's conversation list: the glyph or face, the name (bold while unread),
 * the newest line and its time, and the unread badge.
 */
function ConversationRow(handle: Handle<ConversationRow.Props>) {
	return () => {
		let { conversation, unread, state, now } = handle.props;
		let person = conversation.kind === "dm" ? findPerson(conversation.name) : undefined;
		let last = entriesOf(conversation, state, now).at(-1);
		let preview =
			last === undefined
				? conversation.topic
				: `${last.mine ? "You" : last.author.name.split(" ")[0]}: ${last.text.replace(/[*_`>#\n-]+/g, " ").trim()}`;
		let badge = conversation.kind === "dm" ? unread.count : unread.mentions;
		return (
			<li>
				<a
					href={href(conversationPage(conversation.key))}
					{...TO_MAIN}
					data-conversation={conversation.key}
					data-unread={unread.count > 0 ? "" : undefined}
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "2.25rem minmax(0, 1fr) auto",
							alignItems: "center",
							columnGap: "0.75rem",
							paddingInline: "1rem",
							paddingBlock: "0.625rem",
							minBlockSize: "3.5rem",
							color: "inherit",
							textDecoration: "none",
							"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
							"&:active": { backgroundColor: "var(--ui-neutral-bg-tint-pressed)" },
							"&:focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "-2px",
							},
							"&[data-unread] [data-name]": { fontWeight: "800" },
							"&[data-unread] [data-preview]": { color: "var(--ui-neutral-fg-emphasis)" },
						}),
					]}
				>
					{person === undefined ? (
						<span
							mix={[
								raw({
									display: "inline-grid",
									placeItems: "center",
									inlineSize: "2.25rem",
									blockSize: "2.25rem",
									borderRadius: "0.5rem",
									color: "var(--ui-neutral-fg)",
									backgroundColor: "var(--ui-neutral-bg-tint)",
								}),
							]}
						>
							<ChannelGlyph conversation={conversation} size={17} />
						</span>
					) : (
						<Face person={person} size="md" presence />
					)}
					<span mix={[raw({ display: "grid", minInlineSize: "0", gap: "0.0625rem" })]}>
						<span data-name="" mix={[raw({ fontWeight: "600", fontSize: "0.9375rem" })]}>
							{person === undefined ? conversation.name : person.name}
						</span>
						<span
							data-preview=""
							mix={[
								raw({
									fontSize: "0.8125rem",
									color: "var(--ui-neutral-fg-muted)",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}),
							]}
						>
							{preview}
						</span>
					</span>
					<span mix={[raw({ display: "grid", justifyItems: "end", gap: "0.25rem" })]}>
						<span
							mix={[
								raw({
									fontSize: "0.75rem",
									color: "var(--ui-neutral-fg-muted)",
									whiteSpace: "nowrap",
								}),
							]}
						>
							{last === undefined ? "" : whenOf(last.at, now)}
						</span>
						{badge > 0 ? (
							<span
								data-slot="app-shell-count"
								aria-label={`${badge} unread`}
								mix={[
									raw({
										minInlineSize: "1.25rem",
										blockSize: "1.25rem",
										paddingInline: "0.375rem",
										boxSizing: "border-box",
										borderRadius: "999px",
										fontSize: "0.6875rem",
										fontWeight: "700",
										lineHeight: "1.25rem",
										textAlign: "center",
										color: "var(--ui-brand-fg-on-solid, white)",
										backgroundColor: "var(--ui-brand-bg-solid)",
									}),
								]}
							>
								{badge}
							</span>
						) : null}
					</span>
				</a>
			</li>
		);
	};
}

/** A small uppercase heading over a group of rows. */
function GroupHeading(handle: Handle<{ id: string; children: string }>) {
	return () => (
		<h2
			id={handle.props.id}
			mix={[
				raw({
					margin: "0",
					paddingInline: "1rem",
					paddingBlock: "1rem 0.375rem",
					fontSize: "0.75rem",
					fontWeight: "700",
					letterSpacing: "0.04em",
					textTransform: "uppercase",
					color: "var(--ui-neutral-fg-muted)",
				}),
			]}
		>
			{handle.props.children}
		</h2>
	);
}

namespace HomeScreen {
	export interface Props {
		state: VisitorState;
		unread: Record<string, Unread>;
		now: number;
		collapsed: boolean;
	}
}

/**
 * Home: on a phone the list of conversations first, then (on every width) each conversation
 * with unread lines, its newest unread lines, and Mark all as read; all caught up says so.
 */
export function HomeScreen(handle: Handle<HomeScreen.Props>) {
	return () => {
		let { state, unread, now, collapsed } = handle.props;
		let pending = CONVERSATIONS.filter(
			(conversation) => (unread[conversation.key]?.count ?? 0) > 0,
		);
		let rows = (kind: Conversation["kind"]) =>
			CONVERSATIONS.filter((conversation) => conversation.kind === kind).map((conversation) => (
				<ConversationRow
					conversation={conversation}
					unread={unread[conversation.key] ?? { count: 0, mentions: 0 }}
					state={state}
					now={now}
				/>
			));
		return (
			<ParleyPane
				collapsed={collapsed}
				flush
				title="Home"
				detail="Fernhill · catch up on what you missed"
				actions={
					pending.length > 0 ? (
						<form method="post" action={actionHref("")} mix={[raw({ display: "contents" })]}>
							<input type="hidden" name="intent" value="read-all" />
							<Button type="submit" variant="outline" color="neutral" size="sm">
								<CheckCheckIcon size={15} aria-hidden="true" />
								<span mix={[raw({ "@media (max-width: 30rem)": { display: "none" } })]}>
									Mark all as read
								</span>
							</Button>
						</form>
					) : null
				}
			>
				<div mix={[raw({ display: "flex", flexDirection: "column", paddingBlockEnd: "2rem" })]}>
					<nav
						aria-label="Conversations"
						mix={[raw({ display: "none", [`@media ${PHONE}`]: { display: "block" } })]}
					>
						<GroupHeading id="home-channels">Channels</GroupHeading>
						<ul
							aria-labelledby="home-channels"
							mix={[raw({ listStyle: "none", margin: "0", padding: "0" })]}
						>
							{rows("channel")}
						</ul>
						<GroupHeading id="home-direct">Direct messages</GroupHeading>
						<ul
							aria-labelledby="home-direct"
							mix={[raw({ listStyle: "none", margin: "0", padding: "0" })]}
						>
							{rows("dm")}
						</ul>
					</nav>
					<section aria-labelledby="home-unreads">
						<GroupHeading id="home-unreads">Unreads</GroupHeading>
						{pending.length === 0 ? (
							<Empty icon={<CheckCheckIcon />}>
								<Empty.Title>You're all caught up</Empty.Title>
								<Empty.Description>
									New messages in your channels and direct messages show up here.
								</Empty.Description>
							</Empty>
						) : (
							pending.map((conversation) => {
								let since = readAt(conversation, state, now);
								let lines = entriesOf(conversation, state, now)
									.filter((entry) => !entry.mine && entry.at > since)
									.slice(-3);
								let page = conversationPage(conversation.key);
								let counts = unread[conversation.key] ?? { count: 0, mentions: 0 };
								return (
									<article
										aria-label={conversationTitle(conversation)}
										mix={[
											raw({
												marginInline: "1rem",
												marginBlockEnd: "1rem",
												borderRadius: "var(--ui-radius-lg)",
												border: "1px solid var(--ui-neutral-border)",
												backgroundColor: "var(--ui-bg)",
												overflow: "clip",
												maxInlineSize: "52rem",
											}),
										]}
									>
										<header
											mix={[
												raw({
													display: "flex",
													alignItems: "center",
													gap: "0.5rem",
													paddingInline: "1rem 0.5rem",
													paddingBlock: "0.5rem",
													borderBlockEnd: "1px solid var(--ui-neutral-border)",
												}),
											]}
										>
											<a
												href={`${href(page)}#new-messages`}
												{...TO_MAIN}
												mix={[
													raw({
														fontWeight: "700",
														color: "inherit",
														textDecoration: "none",
														"&:hover": { textDecoration: "underline" },
													}),
												]}
											>
												{conversationTitle(conversation)}
											</a>
											<span
												mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}
											>
												{counts.count} new
												{counts.mentions > 0 && conversation.kind === "channel"
													? ` · ${counts.mentions} ${counts.mentions === 1 ? "mention" : "mentions"}`
													: ""}
											</span>
											<span mix={[raw({ flex: "1" })]} />
											<form
												method="post"
												action={actionHref(page)}
												mix={[raw({ display: "contents" })]}
											>
												<input type="hidden" name="intent" value="read" />
												<input type="hidden" name="return" value="" />
												<Button type="submit" variant="ghost" color="neutral" size="sm">
													Mark as read
												</Button>
											</form>
										</header>
										<Days
											days={daysOf(lines, undefined, now)}
											place={{ page, back: page }}
											now={now}
											plain
										/>
									</article>
								);
							})
						)}
					</section>
				</div>
			</ParleyPane>
		);
	};
}

/** Splits text around every case-insensitive match of a phrase, marking the matches. */
function Highlighted(handle: Handle<{ text: string; query: string }>) {
	return () => {
		let { text, query } = handle.props;
		let needle = query.trim().toLowerCase();
		let plain = text.replace(/```[a-z]*\n?/g, "").replace(/[*_`]/g, "");
		if (needle === "") return <>{plain}</>;
		let parts: Array<{ text: string; hit: boolean }> = [];
		let lower = plain.toLowerCase();
		let cursor = 0;
		let index = lower.indexOf(needle);
		while (index !== -1) {
			if (index > cursor) parts.push({ text: plain.slice(cursor, index), hit: false });
			parts.push({ text: plain.slice(index, index + needle.length), hit: true });
			cursor = index + needle.length;
			index = lower.indexOf(needle, cursor);
		}
		parts.push({ text: plain.slice(cursor), hit: false });
		return (
			<>
				{parts.map((part) =>
					part.hit ? (
						<mark
							mix={[
								raw({
									color: "inherit",
									borderRadius: "0.1875rem",
									paddingInline: "0.0625rem",
									backgroundColor:
										"color-mix(in oklch, var(--ui-warning-bg-solid) 35%, transparent)",
								}),
							]}
						>
							{part.text}
						</mark>
					) : (
						part.text
					),
				)}
			</>
		);
	};
}

namespace SearchScreen {
	export interface Props {
		query: string;
		/** The conversation the search is narrowed to, by key. */
		within?: string;
		hits: Hit[];
		now: number;
		collapsed: boolean;
	}
}

/**
 * Search: a GET form whose words and conversation filter live in the address, chips to narrow
 * by conversation, and each hit with its author, place and time, linking to the line itself.
 */
export function SearchScreen(handle: Handle<SearchScreen.Props>) {
	return () => {
		let { query, within, hits, now, collapsed } = handle.props;
		let scope = within === undefined ? undefined : CONVERSATIONS.find((c) => c.key === within);
		let chip = (active: boolean) =>
			raw({
				display: "inline-flex",
				alignItems: "center",
				gap: "0.25rem",
				blockSize: "1.75rem",
				paddingInline: "0.625rem",
				borderRadius: "999px",
				fontSize: "0.8125rem",
				fontWeight: "600",
				textDecoration: "none",
				whiteSpace: "nowrap",
				border: "1px solid var(--ui-neutral-border)",
				color: active ? "var(--ui-brand-fg-emphasis)" : "var(--ui-neutral-fg)",
				backgroundColor: active ? "var(--ui-brand-bg-tint)" : "var(--ui-bg)",
				borderColor: active ? "var(--ui-brand-border-strong)" : "var(--ui-neutral-border)",
				"&:hover": { borderColor: "var(--ui-neutral-border-strong)" },
				"&:focus-visible": { outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" },
			});
		let link = (key: string | undefined) => {
			let params = new URLSearchParams();
			if (query !== "") params.set("q", query);
			if (key !== undefined) params.set("in", key);
			let search = params.toString();
			return href(search === "" ? "search" : `search?${search}`);
		};
		let counts = new Map<string, number>();
		for (let hit of hits)
			counts.set(hit.conversation.key, (counts.get(hit.conversation.key) ?? 0) + 1);
		return (
			<ParleyPane collapsed={collapsed} title="Search" back={href()}>
				<div mix={[raw({ display: "grid", gap: "1rem", maxInlineSize: "52rem" })]}>
					<form
						method="get"
						action={href("search")}
						{...TO_MAIN}
						role="search"
						mix={[raw({ display: "flex", gap: "0.5rem" })]}
					>
						{within === undefined ? null : <input type="hidden" name="in" value={within} />}
						<label
							mix={[
								raw({
									flex: "1",
									display: "flex",
									alignItems: "center",
									gap: "0.5rem",
									paddingInline: "0.75rem",
									blockSize: "2.5rem",
									borderRadius: "var(--ui-radius-md)",
									border: "1px solid var(--ui-neutral-border-strong)",
									backgroundColor: "var(--ui-bg)",
									"&:focus-within": {
										outline: "2px solid var(--ui-brand-ring)",
										outlineOffset: "1px",
									},
								}),
							]}
						>
							<SearchIcon size={16} aria-hidden="true" />
							<input
								type="search"
								name="q"
								defaultValue={query}
								aria-label={
									scope === undefined ? "Search messages" : `Search in ${conversationTitle(scope)}`
								}
								placeholder={
									scope === undefined
										? "Search messages and files"
										: `Search in ${conversationTitle(scope)}`
								}
								autofocus={query === ""}
								mix={[
									raw({
										flex: "1",
										minInlineSize: "0",
										border: "none",
										outline: "none",
										background: "transparent",
										font: "inherit",
										fontSize: "0.9375rem",
										color: "inherit",
									}),
								]}
							/>
						</label>
						<Button type="submit">Search</Button>
					</form>
					{query === "" ? null : (
						<nav
							aria-label="Filter by conversation"
							mix={[raw({ display: "flex", gap: "0.375rem", flexWrap: "wrap" })]}
						>
							<a
								href={link(undefined)}
								{...TO_MAIN}
								aria-current={within === undefined ? "page" : undefined}
								mix={[chip(within === undefined)]}
							>
								Everywhere
							</a>
							{CONVERSATIONS.filter(
								(conversation) => counts.has(conversation.key) || conversation.key === within,
							).map((conversation) => (
								<a
									href={link(conversation.key)}
									{...TO_MAIN}
									aria-current={within === conversation.key ? "page" : undefined}
									mix={[chip(within === conversation.key)]}
								>
									{conversationTitle(conversation)}
									<span mix={[raw({ fontWeight: "500", opacity: "0.7" })]}>
										{counts.get(conversation.key) ?? 0}
									</span>
								</a>
							))}
						</nav>
					)}
					{query === "" ? (
						<Empty icon={<SearchIcon />}>
							<Empty.Title>Search Fernhill</Empty.Title>
							<Empty.Description>
								Find messages, code and files across every channel and direct message.
							</Empty.Description>
							<Empty.Action>
								<LinkButton
									href={href("search?q=launch")}
									{...TO_MAIN}
									variant="outline"
									color="neutral"
									size="sm"
								>
									Try “launch”
								</LinkButton>
							</Empty.Action>
						</Empty>
					) : null}
					{query !== "" && hits.length === 0 ? (
						<Empty icon={<SearchXIcon />}>
							<Empty.Title>No messages match “{query}”</Empty.Title>
							<Empty.Description>
								{within === undefined
									? "Check the spelling, or try a shorter phrase."
									: "Try searching everywhere instead of one conversation."}
							</Empty.Description>
							{within === undefined ? null : (
								<Empty.Action>
									<LinkButton
										href={link(undefined)}
										{...TO_MAIN}
										variant="outline"
										color="neutral"
										size="sm"
									>
										Search everywhere
									</LinkButton>
								</Empty.Action>
							)}
						</Empty>
					) : null}
					{hits.length > 0 ? (
						<p
							role="status"
							mix={[
								raw({ margin: "0", fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" }),
							]}
						>
							{hits.length} {hits.length === 1 ? "result" : "results"}
						</p>
					) : null}
					{hits.length > 0 ? (
						<ol
							mix={[
								raw({
									listStyle: "none",
									margin: "0",
									padding: "0",
									display: "grid",
									gap: "0.5rem",
								}),
							]}
						>
							{hits.map((hit) => {
								let page = conversationPage(hit.conversation.key);
								let target =
									hit.entry.parent === undefined
										? `${href(page)}#${messageAnchor(hit.entry.id)}`
										: `${href(`${page}?thread=${hit.entry.parent}`)}#${messageAnchor(hit.entry.id)}`;
								return (
									<li>
										<a
											href={target}
											mix={[
												raw({
													display: "grid",
													gridTemplateColumns: "2.25rem minmax(0, 1fr)",
													columnGap: "0.75rem",
													padding: "0.75rem",
													borderRadius: "var(--ui-radius-md)",
													border: "1px solid var(--ui-neutral-border)",
													backgroundColor: "var(--ui-bg)",
													color: "inherit",
													textDecoration: "none",
													"&:hover": { borderColor: "var(--ui-neutral-border-strong)" },
													"&:focus-visible": {
														outline: "2px solid var(--ui-brand-ring)",
														outlineOffset: "1px",
													},
												}),
											]}
										>
											<Face person={hit.entry.author} size="md" />
											<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
												<span
													mix={[
														raw({
															display: "flex",
															flexWrap: "wrap",
															gap: "0.375rem",
															alignItems: "baseline",
															fontSize: "0.8125rem",
														}),
													]}
												>
													<strong>{hit.entry.author.name}</strong>
													<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
														in {conversationTitle(hit.conversation)}
														{hit.entry.parent === undefined ? "" : " · thread"} ·{" "}
														{whenOf(hit.entry.at, now)}
														{whenOf(hit.entry.at, now) === timeOf(hit.entry.at)
															? ""
															: ` ${timeOf(hit.entry.at)}`}
													</span>
												</span>
												<span
													mix={[
														raw({
															fontSize: "0.9375rem",
															display: "-webkit-box",
															WebkitLineClamp: "3",
															WebkitBoxOrient: "vertical",
															overflow: "hidden",
															overflowWrap: "anywhere",
														}),
													]}
												>
													<Highlighted text={hit.entry.text} query={query} />
												</span>
											</span>
										</a>
									</li>
								);
							})}
						</ol>
					) : null}
				</div>
			</ParleyPane>
		);
	};
}
