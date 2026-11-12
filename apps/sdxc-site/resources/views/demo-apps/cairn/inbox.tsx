/**
 * Cairn's inbox: what happened to the person's work, newest first, each row naming who did
 * what to which issue; the issue opens beside the inbox, so triage never loses its place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import { HeadingScope, RelativeTime } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { SPLIT_VIEW_ITEM_ATTRIBUTE, SplitView } from "@sdxc/ui/app/split-view";
import { TAB_BAR_BLOCK_SIZE } from "@sdxc/ui/app/tab-bar";

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import type { IssueView, VisitorState } from "./state";

import { LOCALE, NOTICES, NOW, findPerson, href } from "./data";
import { IssueDetail } from "./detail";
import { PersonTile, StatusIcon } from "./glyphs";
import { SPLIT_LABELS } from "./labels";
import { SPLIT_COOKIE } from "./list";
import { CairnShell } from "./shell";

namespace InboxScreen {
	export interface Props {
		state: VisitorState;
		issues: IssueView[];
		/** The open issue's id, or `null`. */
		open: string | null;
		collapsed: boolean;
		layout?: SplitView.Layout;
	}
}

/** The notices, each a link opening its issue beside the inbox. */
function NoticeList(handle: Handle<{ issues: IssueView[]; open: string | null }>) {
	return () => {
		let { issues, open } = handle.props;
		let unread = NOTICES.filter((notice) => notice.unread && notice.issue !== open).length;
		return (
			<div mix={[raw({ display: "flex", flexDirection: "column" })]}>
				<header
					mix={[
						raw({
							position: "sticky",
							insetBlockStart: "0",
							zIndex: "1",
							padding: "1rem 1rem 0.75rem",
							backgroundColor: "var(--ui-bg, Canvas)",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					<h1
						mix={[
							raw({
								margin: "0",
								fontSize: "1.125rem",
								fontWeight: "600",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						Inbox
					</h1>
					<p
						mix={[raw({ margin: "0", fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}
					>
						{unread === 0 ? "All caught up" : `${unread} unread`}
					</p>
				</header>
				<ul
					aria-label="Notifications"
					mix={[
						raw({
							margin: "0",
							padding: "0.5rem",
							listStyle: "none",
							display: "flex",
							flexDirection: "column",
							gap: "0.125rem",
						}),
					]}
				>
					{NOTICES.map((notice) => {
						let issue = issues.find((candidate) => candidate.id === notice.issue);
						let actor = findPerson(notice.actor);
						if (!issue) return null;
						let unreadRow = notice.unread && notice.issue !== open;
						return (
							<li>
								<a
									href={href(`inbox?issue=${notice.issue}`)}
									data-rmx-prefetch="intent"
									aria-current={notice.issue === open ? "page" : undefined}
									{...{ [SPLIT_VIEW_ITEM_ATTRIBUTE]: "" }}
									mix={[
										raw({
											display: "grid",
											gridTemplateColumns: "auto minmax(0, 1fr) auto",
											columnGap: "0.625rem",
											rowGap: "0.125rem",
											alignItems: "center",
											padding: "0.5rem 0.625rem",
											borderRadius: "var(--ui-radius-lg, 0.375rem)",
											color: "var(--ui-neutral-fg-emphasis)",
											textDecoration: "none",
											"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
											"&[aria-current='page']": {
												backgroundColor:
													"color-mix(in oklch, var(--ui-brand-bg-solid) 14%, transparent)",
											},
											"&:focus-visible": {
												outline: "2px solid var(--ui-brand-ring)",
												outlineOffset: "-2px",
											},
										}),
									]}
								>
									<span
										mix={[
											raw({ gridRow: "1 / span 2", position: "relative", display: "inline-flex" }),
										]}
									>
										<PersonTile person={actor} size={28} decorative />
										{unreadRow ? (
											<span
												mix={[
													raw({
														position: "absolute",
														insetBlockStart: "-0.1875rem",
														insetInlineEnd: "-0.1875rem",
														inlineSize: "0.5rem",
														blockSize: "0.5rem",
														borderRadius: "999px",
														backgroundColor: "var(--ui-brand-bg-solid)",
														boxShadow: "0 0 0 2px var(--ui-bg, Canvas)",
													}),
												]}
											/>
										) : null}
									</span>
									<span
										mix={[
											raw({
												display: "flex",
												alignItems: "center",
												gap: "0.375rem",
												minInlineSize: 0,
												fontSize: "0.875rem",
												fontWeight: unreadRow ? "600" : "500",
											}),
										]}
									>
										<StatusIcon status={issue.status} label />
										<span
											mix={[
												raw({ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }),
											]}
										>
											{issue.title}
										</span>
									</span>
									<span
										mix={[
											raw({
												fontSize: "0.75rem",
												color: "var(--ui-neutral-fg-muted)",
												whiteSpace: "nowrap",
											}),
										]}
									>
										<RelativeTime date={notice.at} now={NOW} locale={LOCALE} />
									</span>
									<span
										mix={[
											raw({
												gridColumn: "2 / -1",
												fontSize: "0.8125rem",
												color: "var(--ui-neutral-fg-muted)",
												whiteSpace: "nowrap",
												overflow: "hidden",
												textOverflow: "ellipsis",
											}),
										]}
									>
										{unreadRow ? <span mix={[visuallyHidden()]}>Unread. </span> : null}
										<span mix={[raw({ fontFamily: "var(--ui-font-mono)", fontSize: "0.75rem" })]}>
											{issue.id}
										</span>
										{` · ${actor?.name ?? "Someone"} ${notice.text}`}
									</span>
								</a>
							</li>
						);
					})}
				</ul>
			</div>
		);
	};
}

/** Renders the inbox, with the open issue beside it. */
export function InboxScreen(handle: Handle<InboxScreen.Props>) {
	return () => {
		let { state, issues, open, collapsed, layout } = handle.props;
		let issue = open === null ? undefined : issues.find((candidate) => candidate.id === open);
		let page = issue ? `inbox?issue=${issue.id}` : "inbox";
		return (
			<CairnShell
				current="inbox"
				collapsed={collapsed}
				crumb="Inbox"
				state={state}
				from={page}
				flush
			>
				<div
					mix={[
						raw({
							blockSize: `calc(100dvh - var(--ui-app-header-height, 3.5rem) - ${TAB_BAR_BLOCK_SIZE})`,
							"@media (min-width: 48rem)": {
								blockSize:
									"calc(100dvh - var(--ui-app-header-height, 3.5rem) - 2 * var(--ui-app-inset-gap, 0.5rem) - 2px)",
							},
						}),
					]}
				>
					<SplitView
						cookiePath={demoAppCookiePath("cairn")}
						id="cairn-inbox"
						list={<NoticeList issues={issues} open={issue?.id ?? null} />}
						detail={
							issue ? (
								<IssueDetail
									issue={issue}
									state={state}
									returnTo={page}
									level={2}
									closeHref={href("inbox")}
								/>
							) : null
						}
						empty={
							<HeadingScope level={2}>
								<Empty size="compact">
									<Empty.Title>No issue open</Empty.Title>
									<Empty.Description>
										Pick a notification to open its issue here. Press j to start.
									</Empty.Description>
								</Empty>
							</HeadingScope>
						}
						active={issue ? "detail" : "list"}
						backHref={href("inbox")}
						layout={layout}
						cookie={SPLIT_COOKIE}
						labels={{ ...SPLIT_LABELS, back: "Inbox" }}
					/>
				</div>
			</CairnShell>
		);
	};
}
