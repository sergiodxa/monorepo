/**
 * Delta's notifications inbox: what reached the signed-in person and why, grouped by day or by
 * repository, unread rows in bold with a dot. Done and Save flip at once and post in the
 * background, `e` marks the focused row done, and selecting rows turns the footer into a bulk bar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	BookmarkIcon,
	CheckIcon,
	CircleCheckBigIcon,
	GitCommitHorizontalIcon,
	MailOpenIcon,
	UndoIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, text, weight } from "@sdxc/u/typography";
import { HeadingScope, LinkButton, RelativeTime } from "@sdxc/ui";
import { clearFiltersHref, paramValues, setParamHref } from "@sdxc/ui/app";
import { Empty } from "@sdxc/ui/app/empty";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { OptimisticToggle } from "@sdxc/ui/app/optimistic-toggle";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SelectionBar } from "@sdxc/ui/app/selection-bar";

import { DEMO_APP_TOAST_PARAM } from "~/resources/views/demo-apps";

import type { Notification, Reason } from "../seed/notifications";

import { actionHref, commitHref, runHref, shortSha } from "../data";
import { InitialsTile } from "../glyphs";
import { InboxKeys } from "../inbox-keys";
import { COPY, INBOX_FILTER_LABELS, INBOX_SELECTION_LABELS } from "../labels";
import { REASONS } from "../seed/notifications";

import { StateIcon } from "./ci-parts";

/** The id the bulk form, the row checkboxes and the bulk bar share. */
const BULK_FORM = "delta-inbox-bulk";

/** The box the rows sit in, which the bulk bar and the keys watch. */
const ROWS_ID = "delta-inbox-rows";

/** Which notifications a view shows. */
export type InboxView = "inbox" | "saved" | "done";

/** How the rows are grouped. */
type Grouping = "date" | "repo";

/** A notification as one visitor sees it, with their read, saved and done flags applied. */
export interface InboxItem extends Notification {
	saved: boolean;
	done: boolean;
}

/** The view the address names, the inbox by default. */
export function readView(url: URL): InboxView {
	let value = url.searchParams.get("filter");
	return value === "saved" || value === "done" ? value : "inbox";
}

/** Whether a notification belongs in a view. */
function inView(item: InboxItem, view: InboxView): boolean {
	if (view === "inbox") return !item.done;
	if (view === "saved") return item.saved;
	return item.done;
}

/** The address of a notification's subject. */
function subjectHref(item: InboxItem): string {
	return item.kind === "run" ? runHref(Number(item.target)) : commitHref(String(item.target));
}

/** The line under a notification's title: who did what, in a few words. */
function activity(item: InboxItem): string {
	let copy = COPY.inbox.activity;
	if (item.kind === "run") return copy.run(item.label ?? "", item.state ?? "failure");
	if (item.reason === "mention") return copy.mention(item.actor);
	if (item.reason === "author") return copy.author(item.actor);
	return copy.comment(item.actor);
}

/** The day group a time falls in, counted in whole UTC days back from `now`. */
function dayGroup(at: number, now: number): string {
	let days = Math.floor(now / 86_400_000) - Math.floor(at / 86_400_000);
	if (days <= 0) return COPY.inbox.groups.today;
	if (days === 1) return COPY.inbox.groups.yesterday;
	if (days < 7) return COPY.inbox.groups.week;
	return COPY.inbox.groups.older;
}

/** The rows of a view in groups, in the order the rows arrive. */
function groupItems(
	items: readonly InboxItem[],
	grouping: Grouping,
	now: number,
): Array<{ key: string; label: string; items: InboxItem[] }> {
	let groups = new Map<string, InboxItem[]>();
	for (let item of items) {
		let key = grouping === "repo" ? item.repo : dayGroup(item.at, now);
		groups.set(key, [...(groups.get(key) ?? []), item]);
	}
	return [...groups.entries()].map(([key, rows]) => ({ key, label: key, items: rows }));
}

namespace InboxRow {
	export interface Props {
		item: InboxItem;
		/** The page the row's forms return to without script. */
		returnTo: string;
		now: number;
	}
}

/** The icon a notification's subject draws: the run's state, or a commit. */
function SubjectIcon(handle: Handle<{ item: InboxItem }>) {
	return () => {
		let { item } = handle.props;
		if (item.kind === "run") return <StateIcon state={item.state ?? "failure"} />;
		return (
			<span
				role="img"
				aria-label={COPY.inbox.commit}
				mix={[raw({ display: "inline-flex" }), fg("neutral.muted")]}
			>
				<GitCommitHorizontalIcon size={16} aria-hidden="true" />
			</span>
		);
	};
}

/**
 * Renders one notification: a checkbox for the bulk bar, the subject's icon, the repository and
 * reason, the title in bold while unread, who did what, then its age and its Done and Save toggles,
 * which show on hover and focus with a pointer and always on a touch screen.
 */
export function InboxRow(handle: Handle<InboxRow.Props>) {
	return () => {
		let { item, now, returnTo } = handle.props;
		let reference = item.kind === "run" ? (item.label ?? "") : shortSha(String(item.target));
		return (
			<li
				data-row=""
				data-notification={item.id}
				data-unread={item.unread ? "" : undefined}
				mix={[
					raw({
						position: "relative",
						display: "grid",
						gridTemplateColumns: "auto auto minmax(0, 1fr)",
						columnGap: "0.75rem",
						rowGap: "0.375rem",
						"@container delta-inbox (min-width: 36rem)": {
							gridTemplateColumns: "auto auto minmax(0, 1fr) auto",
						},
						alignItems: "start",
						paddingBlock: "0.75rem",
						paddingInline: "0.75rem 1rem",
						borderBlockStart: "1px solid var(--ui-neutral-border)",
						"&[hidden]": { display: "none" },
						"&[data-unread]": {
							background: "color-mix(in oklch, var(--ui-brand-bg-solid) 5%, var(--ui-bg))",
						},
						"&:hover": { background: "var(--ui-neutral-bg-tint-hover)" },
						"& [data-inbox-actions]": { opacity: 0 },
						"&:is(:hover, :focus-within) [data-inbox-actions]": { opacity: 1 },
						"@media (hover: none)": { "& [data-inbox-actions]": { opacity: 1 } },
					}),
				]}
			>
				<label
					mix={[
						raw({
							display: "grid",
							placeItems: "center",
							blockSize: "1.25rem",
							cursor: "pointer",
							position: "relative",
							zIndex: 1,
						}),
					]}
				>
					<input
						type="checkbox"
						name="ids"
						value={item.id}
						form={BULK_FORM}
						data-selection-item=""
						mix={[raw({ margin: 0, accentColor: "var(--ui-brand-bg-solid)" })]}
					/>
					<span mix={[visuallyHidden()]}>{COPY.inbox.select(item.title)}</span>
				</label>
				<span
					mix={[
						raw({ position: "relative", display: "inline-flex", paddingBlockStart: "0.125rem" }),
					]}
				>
					<SubjectIcon item={item} />
					{item.unread ? (
						<span
							aria-hidden="true"
							mix={[
								raw({
									position: "absolute",
									insetBlockStart: "-0.125rem",
									insetInlineEnd: "-0.25rem",
									inlineSize: "0.5rem",
									blockSize: "0.5rem",
									borderRadius: "999px",
									backgroundColor: "var(--ui-brand-bg-solid)",
									boxShadow: "0 0 0 2px var(--ui-bg)",
								}),
							]}
						/>
					) : null}
				</span>
				<div mix={[raw({ display: "grid", gap: "0.1875rem", minInlineSize: 0 })]}>
					<span
						mix={[
							raw({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.375rem" }),
							text("xs"),
							fg("neutral.muted"),
						]}
					>
						<span mix={[font("mono")]}>{`${item.repo} · ${reference}`}</span>
						<span
							data-reason={item.reason}
							mix={[
								raw({
									paddingInline: "0.375rem",
									borderRadius: "999px",
									border: "1px solid var(--ui-neutral-border)",
									lineHeight: "1.125rem",
									whiteSpace: "nowrap",
								}),
								item.reason === "ci_activity" && item.state === "failure"
									? fg("danger")
									: fg("neutral.muted"),
							]}
						>
							{COPY.inbox.reasons[item.reason]}
						</span>
					</span>
					<a
						href={subjectHref(item)}
						data-row-link=""
						data-rmx-prefetch="intent"
						mix={[
							text("sm"),
							weight(item.unread ? "semibold" : "normal"),
							fg("neutral.emphasis"),
							raw({
								textDecoration: "none",
								overflowWrap: "anywhere",
								outline: "none",
								"&::after": { content: '""', position: "absolute", inset: 0 },
								"&:hover": { textDecoration: "underline" },
							}),
						]}
					>
						{item.unread ? <span mix={[visuallyHidden()]}>{COPY.inbox.unread}</span> : null}
						{item.title}
					</a>
					<span
						mix={[
							text("xs"),
							fg("neutral.muted"),
							raw({ display: "flex", gap: "0.375rem", minInlineSize: 0 }),
						]}
					>
						<InitialsTile name={item.actor} size={16} />
						<span
							mix={[
								raw({
									minInlineSize: 0,
									overflowWrap: "anywhere",
									display: "-webkit-box",
									WebkitLineClamp: "2",
									WebkitBoxOrient: "vertical",
									overflow: "hidden",
								}),
							]}
						>
							<span mix={[weight("medium"), fg("neutral.emphasis")]}>{activity(item)}</span>
							{item.excerpt === undefined ? null : `: ${item.excerpt}`}
						</span>
					</span>
				</div>
				<div
					mix={[
						raw({
							gridColumn: "3",
							display: "flex",
							flexDirection: "row-reverse",
							justifyContent: "space-between",
							alignItems: "center",
							gap: "0.25rem",
							position: "relative",
							zIndex: 1,
							"@container delta-inbox (min-width: 36rem)": {
								gridColumn: "4",
								flexDirection: "column",
								justifyContent: "start",
								alignItems: "end",
							},
						}),
					]}
				>
					<span mix={[text("xs"), fg("neutral.muted"), raw({ whiteSpace: "nowrap" })]}>
						<RelativeTime date={new Date(item.at).toISOString()} now={now} locale="en" />
					</span>
					<span
						data-inbox-actions=""
						mix={[raw({ display: "flex", gap: "0.125rem", transition: "opacity 120ms ease" })]}
					>
						<span data-inbox-action="done">
							<OptimisticToggle
								action={actionHref(`notifications/${item.id}`)}
								name="on"
								pressed={item.done}
								fields={{ intent: "done", return: returnTo }}
								labels={{
									label: COPY.inbox.done,
									pressed: COPY.inbox.undone,
									failed: COPY.inbox.failed,
								}}
								pressedContent={<UndoIcon size={16} aria-hidden="true" />}
								unpressedContent={<CheckIcon size={16} aria-hidden="true" />}
							/>
						</span>
						<span data-inbox-action="saved">
							<OptimisticToggle
								action={actionHref(`notifications/${item.id}`)}
								name="on"
								pressed={item.saved}
								fields={{ intent: "save", return: returnTo }}
								labels={{
									label: COPY.inbox.save,
									pressed: COPY.inbox.unsave,
									failed: COPY.inbox.failed,
								}}
								pressedContent={<BookmarkIcon size={16} fill="currentColor" aria-hidden="true" />}
								unpressedContent={<BookmarkIcon size={16} aria-hidden="true" />}
							/>
						</span>
					</span>
				</div>
			</li>
		);
	};
}

/** The empty state a view shows once nothing is left in it, said by why it is empty. */
function Cleared(
	handle: Handle<{ view: InboxView; filtered: boolean; url: URL; hidden?: boolean }>,
) {
	return () => {
		let { filtered, hidden = false, url, view } = handle.props;
		let copy = COPY.inbox.empty[filtered ? "filtered" : view];
		return (
			<div data-inbox-cleared="" hidden={hidden} mix={[raw({ "&[hidden]": { display: "none" } })]}>
				<Empty
					kind={filtered ? "no-results" : "cleared"}
					icon={view === "inbox" && !filtered ? <CircleCheckBigIcon /> : <MailOpenIcon />}
				>
					<Empty.Title>{copy.title}</Empty.Title>
					<Empty.Description>{copy.hint}</Empty.Description>
					{filtered ? (
						<Empty.Action>
							<LinkButton
								href={clearFiltersHref(url, ["reason"])}
								size="sm"
								variant="outline"
								color="neutral"
							>
								{COPY.inbox.clear}
							</LinkButton>
						</Empty.Action>
					) : null}
				</Empty>
			</div>
		);
	};
}

namespace NotificationsScreen {
	export interface Props {
		items: readonly InboxItem[];
		url: URL;
		now: number;
	}
}

/**
 * Renders the inbox: the view tabs with their counts, the reason filter and the grouping, then
 * the rows by day or repository, or the state that says why there are none, and the bulk bar.
 */
export function NotificationsScreen(handle: Handle<NotificationsScreen.Props>) {
	return () => {
		let { items, now } = handle.props;
		let url = new URL(handle.props.url);
		url.searchParams.delete(DEMO_APP_TOAST_PARAM);
		let view = readView(url);
		let grouping: Grouping = url.searchParams.get("group") === "repo" ? "repo" : "date";
		let reasons = paramValues(url, "reason");
		let byReason = (item: InboxItem) => reasons.length === 0 || reasons.includes(item.reason);
		let shown = items.filter((item) => inView(item, view) && byReason(item));
		let returnTo = `notifications${url.search}`;
		let tab = (target: InboxView) =>
			setParamHref(url, "filter", target === "inbox" ? null : target);
		let groups = groupItems(shown, grouping, now);
		let unread = items.filter((item) => inView(item, "inbox") && item.unread).length;
		let rows: RemixNode =
			shown.length === 0 ? (
				<Cleared view={view} filtered={reasons.length > 0} url={url} />
			) : (
				<>
					{groups.map((group) => (
						<section
							data-inbox-group={group.key}
							aria-labelledby={`delta-inbox-${group.key.replace(/\W+/g, "-")}`}
							mix={[raw({ "&[hidden]": { display: "none" } })]}
						>
							<h2
								id={`delta-inbox-${group.key.replace(/\W+/g, "-")}`}
								mix={[
									raw({
										margin: 0,
										padding: "0.5rem 1rem",
										background: "var(--ui-neutral-bg-tint)",
										borderBlockStart: "1px solid var(--ui-neutral-border)",
									}),
									text("xs"),
									weight("semibold"),
									fg("neutral.muted"),
									grouping === "repo" ? font("mono") : raw({}),
								]}
							>
								{group.label}
							</h2>
							<ul mix={[raw({ listStyle: "none", margin: 0, padding: 0 })]}>
								{group.items.map((item) => (
									<InboxRow item={item} returnTo={returnTo} now={now} />
								))}
							</ul>
						</section>
					))}
					<Cleared view={view} filtered={reasons.length > 0} url={url} hidden />
				</>
			);
		return (
			<>
				<PageHeader
					title={COPY.inbox.title}
					description={unread === 0 ? COPY.inbox.caughtUp : COPY.inbox.unreadCount(unread)}
				/>
				<HeadingScope level={2}>
					<div mix={[raw({ display: "grid", gap: "0.75rem" })]}>
						<FilterBar
							id="delta-inbox"
							url={url}
							prefetch="intent"
							locale="en"
							tabs={[
								{
									label: COPY.inbox.views.inbox,
									count: unread,
									href: tab("inbox"),
									current: view === "inbox",
								},
								{
									label: COPY.inbox.views.saved,
									count: items.filter((item) => item.saved).length,
									href: tab("saved"),
									current: view === "saved",
								},
								{
									label: COPY.inbox.views.done,
									count: items.filter((item) => item.done).length,
									href: tab("done"),
									current: view === "done",
								},
							]}
							facets={[
								{
									name: "reason",
									label: COPY.inbox.reason,
									options: REASONS.map((reason: Reason) => ({
										value: reason,
										label: COPY.inbox.reasons[reason],
										count: items.filter((item) => inView(item, view) && item.reason === reason)
											.length,
									})),
								},
							]}
							sort={{
								name: "group",
								label: COPY.inbox.groupBy,
								defaultValue: "date",
								options: [
									{ value: "date", label: COPY.inbox.byDate },
									{ value: "repo", label: COPY.inbox.byRepo },
								],
							}}
							labels={INBOX_FILTER_LABELS}
						/>
						<form id={BULK_FORM} method="post" action={actionHref("notifications")} hidden>
							<input type="hidden" name="return" value={returnTo} />
						</form>
						<div
							id={ROWS_ID}
							data-inbox={view}
							mix={[
								raw({
									containerName: "delta-inbox",
									containerType: "inline-size",
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "var(--ui-radius-lg)",
									background: "var(--ui-bg)",
									overflow: "clip",
									"& > section:first-of-type > h2": { borderBlockStart: "0" },
									"& h2 + ul > li:first-child": {
										borderBlockStart: "1px solid var(--ui-neutral-border)",
									},
								}),
							]}
						>
							{rows}
							<InboxKeys
								within={`#${ROWS_ID}`}
								view={view}
								labels={{
									group: COPY.inbox.title,
									next: "Next notification",
									previous: "Previous notification",
									open: "Open notification",
									toggle: "Select notification",
									selected: "Selected",
									deselected: "Deselected",
									done: "Mark as done",
								}}
							/>
						</div>
						<SelectionBar
							target={ROWS_ID}
							form={BULK_FORM}
							locale="en"
							pagination={{ summary: COPY.inbox.shown(shown.length) }}
							actions={[
								view === "done"
									? {
											label: COPY.inbox.moveToInbox,
											key: "shift+i",
											name: "intent",
											value: "undone",
										}
									: {
											label: COPY.inbox.done,
											key: "e",
											icon: <CheckIcon size={16} />,
											name: "intent",
											value: "done",
										},
								{ label: COPY.inbox.markRead, key: "shift+r", name: "intent", value: "read" },
								{
									label: COPY.inbox.save,
									key: "s",
									icon: <BookmarkIcon size={16} />,
									name: "intent",
									value: "save",
								},
							]}
							labels={INBOX_SELECTION_LABELS}
						/>
					</div>
				</HeadingScope>
			</>
		);
	};
}
