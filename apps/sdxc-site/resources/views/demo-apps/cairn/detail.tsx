/**
 * One issue in full: its title and description, a properties panel whose status, priority and
 * assignee each open a menu that saves on pick, its sub-issues with their progress, and one
 * feed of its history and comments. The same view sits beside a list or on a page of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	ChevronDownIcon,
	ChevronUpIcon,
	CircleCheckIcon,
	CircleDotIcon,
	IterationCwIcon,
	MessageSquareIcon,
	SignalHighIcon,
	UserRoundIcon,
	XIcon,
} from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import {
	Button,
	Header,
	Keyboard,
	Menu,
	PropertyList,
	RelativeTime,
	Section,
	Timeline,
} from "@sdxc/ui";
import { SaveStatus } from "@sdxc/ui/app/save-status";

import { EmojiTextarea } from "~/resources/views/demo-apps/emoji-textarea";
import { expandEmoji } from "~/resources/views/demo-apps/expand-emoji";

import type { Change } from "./data";
import type { IssueView, VisitorState } from "./state";

import {
	LOCALE,
	ME,
	NOW,
	PEOPLE,
	PRIORITIES,
	PRIORITY_NAMES,
	STATUSES,
	STATUS_NAMES,
	editHref,
	findCycle,
	findLabel,
	findPerson,
	findProject,
	findTeam,
	href,
	isClosed,
} from "./data";
import { LabelChip, PersonTile, PriorityIcon, ProjectGlyph, StatusIcon } from "./glyphs";
import { SAVE_LABELS } from "./labels";
import { SavingSignal } from "./saving-signal";
import { SAVED_WINDOW_MS, allIssues } from "./state";

namespace IssueDetail {
	export interface Props {
		issue: IssueView;
		state: VisitorState;
		/** The page every edit posts to and returns to, such as the list with this issue open. */
		returnTo: string;
		/** The title's heading level: 1 on the issue's own page, 2 beside a list. */
		level: 1 | 2;
		/** The list without this issue open; draws Close and answers Escape. */
		closeHref?: string;
		/** Drops the header and title for a sheet that draws its own, keeping the save status. */
		sheet?: boolean;
		/**
		 * The frames this detail's links and forms reload: `view` holds the issue and what lists it,
		 * so an edit or Close redraws both; `issue` holds only the issue, for Previous, Next and a
		 * comment. Unset, each loads the whole page.
		 */
		frames?: { view: string; issue: string };
		/** Where the issue sits in the list beside it. */
		position?: {
			index: number;
			total: number;
			previousHref: string | null;
			nextHref: string | null;
		};
	}
}

/** The form every property menu submits, by issue. */
export function propsFormId(issue: string): string {
	return `cairn-props-${issue}`;
}

/** The save status element's id, by issue. */
function saveStatusId(issue: string): string {
	return `cairn-save-${issue}`;
}

/** A square ghost button for the header's controls. */
function HeaderLink(
	handle: Handle<{
		href: string | null;
		label: string;
		shortcut?: string;
		frame?: string;
		children: RemixNode;
	}>,
) {
	return () => {
		let { href: target, label, shortcut, frame, children } = handle.props;
		let style = raw({
			display: "inline-grid",
			placeItems: "center",
			inlineSize: "1.75rem",
			blockSize: "1.75rem",
			borderRadius: "var(--ui-radius-md, 0.25rem)",
			color: "var(--ui-neutral-fg-muted)",
			"&:hover": {
				backgroundColor: "var(--ui-neutral-bg-tint-hover)",
				color: "var(--ui-neutral-fg-emphasis)",
			},
			"&[aria-disabled='true']": { opacity: "0.4" },
		});
		return target === null ? (
			<span aria-disabled="true" role="link" aria-label={label} mix={[style]}>
				{children}
			</span>
		) : (
			<a
				href={target}
				aria-label={label}
				title={label}
				data-rmx-prefetch="intent"
				data-rmx-target={frame}
				data-shortcut={shortcut}
				data-shortcut-label={shortcut ? label : undefined}
				data-shortcut-group={shortcut ? "Issues" : undefined}
				mix={[style]}
			>
				{children}
			</a>
		);
	};
}

/** A property's value as a quiet button that opens its menu, with the key that opens it. */
function PropertyButton(
	handle: Handle<{ menu: string; label: string; shortcut: string; children: RemixNode }>,
) {
	return () => {
		let { menu, label, shortcut, children } = handle.props;
		return (
			<Button
				type="button"
				variant="ghost"
				color="neutral"
				size="sm"
				commandfor={menu}
				command="toggle-popover"
				data-shortcut={shortcut}
				data-shortcut-label={label}
				data-shortcut-group="Issues"
				mix={[
					raw({
						marginInlineStart: "-0.5rem",
						justifyContent: "flex-start",
						gap: "0.5rem",
						maxInlineSize: "100%",
					}),
				]}
			>
				{children}
				<span mix={[visuallyHidden()]}>{`, ${label}`}</span>
			</Button>
		);
	};
}

/**
 * The properties: status, priority and assignee each a menu whose rows submit the issue's
 * form, then labels, cycle, project and estimate.
 */
function Properties(handle: Handle<{ issue: IssueView }>) {
	return () => {
		let { issue } = handle.props;
		let form = propsFormId(issue.id);
		let assignee = findPerson(issue.assignee);
		let cycle = findCycle(issue.cycle);
		let project = findProject(issue.project);
		let menuId = (field: string) => `cairn-${field}-${issue.id}`;
		let check = (on: boolean) =>
			on ? <CircleCheckIcon /> : <span mix={[raw({ inlineSize: "1rem" })]} />;

		return (
			<PropertyList>
				<PropertyList.Item label="Status">
					<PropertyButton menu={menuId("status")} label="Change status" shortcut="s">
						<StatusIcon status={issue.status} />
						{STATUS_NAMES[issue.status]}
					</PropertyButton>
					<Menu id={menuId("status")} aria-label="Change status" placement="bottom-start">
						{STATUSES.map((status) => (
							<Menu.Item
								type="submit"
								form={form}
								name="status"
								value={status}
								aria-current={issue.status === status ? "true" : undefined}
							>
								<StatusIcon status={status} />
								<span mix={[raw({ flex: "1 1 auto" })]}>{STATUS_NAMES[status]}</span>
								{check(issue.status === status)}
							</Menu.Item>
						))}
					</Menu>
				</PropertyList.Item>
				<PropertyList.Item label="Priority">
					<PropertyButton menu={menuId("priority")} label="Change priority" shortcut="p">
						<PriorityIcon priority={issue.priority} />
						{PRIORITY_NAMES[issue.priority]}
					</PropertyButton>
					<Menu id={menuId("priority")} aria-label="Change priority" placement="bottom-start">
						{PRIORITIES.map((priority) => (
							<Menu.Item
								type="submit"
								form={form}
								name="priority"
								value={String(priority)}
								aria-current={issue.priority === priority ? "true" : undefined}
							>
								<PriorityIcon priority={priority} />
								<span mix={[raw({ flex: "1 1 auto" })]}>{PRIORITY_NAMES[priority]}</span>
								{check(issue.priority === priority)}
							</Menu.Item>
						))}
					</Menu>
				</PropertyList.Item>
				<PropertyList.Item label="Assignee">
					<PropertyButton menu={menuId("assignee")} label="Assign issue" shortcut="a">
						<PersonTile person={assignee} size={18} decorative />
						{assignee?.name ?? "Unassigned"}
					</PropertyButton>
					<Menu id={menuId("assignee")} aria-label="Assign to" placement="bottom-start">
						<Section aria-labelledby={`${menuId("assignee")}-heading`}>
							<Header id={`${menuId("assignee")}-heading`}>Assign to</Header>
							<Menu.Item type="submit" form={form} name="assignee" value="none">
								<PersonTile person={undefined} size={16} decorative />
								<span mix={[raw({ flex: "1 1 auto" })]}>No one</span>
								{check(!issue.assignee)}
							</Menu.Item>
							{PEOPLE.map((person) => (
								<Menu.Item
									type="submit"
									form={form}
									name="assignee"
									value={person.id}
									aria-current={issue.assignee === person.id ? "true" : undefined}
								>
									<PersonTile person={person} size={16} decorative />
									<span mix={[raw({ flex: "1 1 auto" })]}>
										{person.id === ME ? `${person.name} (you)` : person.name}
									</span>
									{check(issue.assignee === person.id)}
								</Menu.Item>
							))}
						</Section>
					</Menu>
				</PropertyList.Item>
				<PropertyList.Item label="Labels" empty="No labels">
					{issue.labels.length === 0 ? null : (
						<span mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.25rem" })]}>
							{issue.labels.map((id) => {
								let label = findLabel(id);
								return label ? <LabelChip label={label} /> : null;
							})}
						</span>
					)}
				</PropertyList.Item>
				<PropertyList.Item label="Cycle" empty="No cycle">
					{cycle ? (
						<a href={href(`cycles/${cycle.id}`)} data-rmx-prefetch="intent" mix={[propertyLink()]}>
							<IterationCwIcon size={14} aria-hidden="true" />
							{`Cycle ${cycle.number}`}
						</a>
					) : null}
				</PropertyList.Item>
				<PropertyList.Item label="Project" empty="No project">
					{project ? (
						<a
							href={href(`projects/${project.id}`)}
							data-rmx-prefetch="intent"
							mix={[propertyLink()]}
						>
							<ProjectGlyph hue={project.hue} size={14} />
							{project.name}
						</a>
					) : null}
				</PropertyList.Item>
				<PropertyList.Item label="Estimate" empty="Not estimated">
					{issue.estimate === undefined ? null : `${issue.estimate} points`}
				</PropertyList.Item>
			</PropertyList>
		);
	};
}

/** A property's link: inherits the value's colour and underlines on hover. */
function propertyLink() {
	return raw({
		display: "inline-flex",
		alignItems: "center",
		gap: "0.375rem",
		color: "inherit",
		textDecoration: "none",
		"&:hover": { textDecoration: "underline" },
	});
}

/** The sub-issues: each with its state and assignee, and how many are done. */
function SubIssues(handle: Handle<{ issue: IssueView; items: IssueView[]; returnTo: string }>) {
	return () => {
		let { items: children } = handle.props;
		let done = children.filter((child) => isClosed(child.status)).length;
		return (
			<section
				aria-labelledby="cairn-sub-issues"
				mix={[raw({ display: "flex", flexDirection: "column", gap: "0.5rem" })]}
			>
				<h3 id="cairn-sub-issues" mix={[sectionHeading()]}>
					Sub-issues
					<span mix={[raw({ fontWeight: "400", color: "var(--ui-neutral-fg-muted)" })]}>
						{`${done} of ${children.length} done`}
					</span>
				</h3>
				<ul
					mix={[
						raw({
							margin: "0",
							padding: "0",
							listStyle: "none",
							border: "1px solid var(--ui-neutral-border)",
							borderRadius: "var(--ui-radius-lg, 0.375rem)",
						}),
					]}
				>
					{children.map((child) => (
						<li
							mix={[raw({ "& + li": { borderBlockStart: "1px solid var(--ui-neutral-border)" } })]}
						>
							<a
								href={href(`team/${child.team}?issue=${child.id}`)}
								data-rmx-prefetch="intent"
								mix={[
									raw({
										display: "flex",
										alignItems: "center",
										gap: "0.625rem",
										minBlockSize: "2.25rem",
										paddingInline: "0.75rem",
										fontSize: "0.875rem",
										color: "var(--ui-neutral-fg-emphasis)",
										textDecoration: "none",
										"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
									}),
								]}
							>
								<StatusIcon status={child.status} label />
								<span
									mix={[
										raw({
											fontFamily: "var(--ui-font-mono)",
											fontSize: "0.75rem",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									{child.id}
								</span>
								<span
									mix={[
										raw({
											flex: "1 1 auto",
											minInlineSize: 0,
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}),
									]}
								>
									{child.title}
								</span>
								<PersonTile person={findPerson(child.assignee)} size={18} />
							</a>
						</li>
					))}
				</ul>
			</section>
		);
	};
}

/** A small section heading inside the detail. */
function sectionHeading() {
	return raw({
		display: "flex",
		alignItems: "baseline",
		gap: "0.5rem",
		margin: "0",
		fontSize: "0.8125rem",
		fontWeight: "600",
		color: "var(--ui-neutral-fg-emphasis)",
	});
}

/** What one change says in the feed. */
function changeText(change: Change): string {
	if (change.field === "status")
		return `moved this to ${STATUS_NAMES[change.to as keyof typeof STATUS_NAMES] ?? change.to}`;
	if (change.field === "priority") {
		return `set priority to ${PRIORITY_NAMES[Number(change.to) as keyof typeof PRIORITY_NAMES]}`;
	}
	if (change.field === "assignee") {
		let person = findPerson(change.to);
		return person
			? `assigned this to ${person.id === ME ? "themself" : person.name}`
			: "removed the assignee";
	}
	return "created the issue";
}

/** A change's glyph in the feed. */
function changeIcon(change: Change): RemixNode {
	if (change.field === "status") return <CircleDotIcon />;
	if (change.field === "priority") return <SignalHighIcon />;
	if (change.field === "assignee") return <UserRoundIcon />;
	return <CircleDotIcon />;
}

/** Who did something, named as the feed names them. */
function actorName(id: string): string {
	return id === ME ? "You" : (findPerson(id)?.name ?? "Someone");
}

/**
 * The feed: creation, every change and every comment in time order, then the comment box. A
 * visitor's own entries read against the real clock, the fixtures against the demo's moment.
 */
function Activity(handle: Handle<{ issue: IssueView; returnTo: string; frame?: string }>) {
	return () => {
		let { issue, returnTo, frame } = handle.props;
		type Entry = { at: string; node: RemixNode };
		let now = (at: string) => (at > NOW ? new Date().toISOString() : NOW);
		let entries: Entry[] = [
			{
				at: issue.createdAt,
				node: (
					<Timeline.Event
						icon={<CircleDotIcon />}
						actor={actorName(issue.createdBy)}
						time={
							<RelativeTime date={issue.createdAt} now={now(issue.createdAt)} locale={LOCALE} />
						}
					>
						created the issue
					</Timeline.Event>
				),
			},
			...(issue.changes ?? []).map((change) => ({
				at: change.at,
				node: (
					<Timeline.Event
						icon={changeIcon(change)}
						tone={change.field === "status" && change.to === "done" ? "success" : "neutral"}
						actor={actorName(change.actor)}
						time={<RelativeTime date={change.at} now={now(change.at)} locale={LOCALE} />}
					>
						{changeText(change)}
					</Timeline.Event>
				),
			})),
			...(issue.comments ?? []).map((comment) => ({
				at: comment.at,
				node: (
					<Timeline.Event
						icon={<MessageSquareIcon />}
						tone="brand"
						avatar={<PersonTile person={findPerson(comment.author)} size={20} decorative />}
						actor={actorName(comment.author)}
						time={<RelativeTime date={comment.at} now={now(comment.at)} locale={LOCALE} />}
						body={
							<p
								id={`comment-${comment.id}`}
								mix={[
									raw({
										margin: "0",
										fontSize: "0.875rem",
										lineHeight: "1.375rem",
										whiteSpace: "pre-wrap",
									}),
								]}
							>
								{expandEmoji(comment.body)}
							</p>
						}
					>
						commented
					</Timeline.Event>
				),
			})),
		].sort((a, b) => a.at.localeCompare(b.at));

		return (
			<section
				aria-labelledby="cairn-activity"
				mix={[raw({ display: "flex", flexDirection: "column", gap: "0.75rem" })]}
			>
				<h3 id="cairn-activity" mix={[sectionHeading()]}>
					Activity
				</h3>
				<Timeline>{entries.map((entry) => entry.node)}</Timeline>
				<form
					method="post"
					action={editHref(returnTo)}
					data-rmx-target={frame}
					mix={[raw({ display: "flex", flexDirection: "column", gap: "0.5rem" })]}
				>
					<input type="hidden" name="intent" value="comment" />
					<input type="hidden" name="issue" value={issue.id} />
					<label htmlFor={`cairn-comment-${issue.id}`} mix={[visuallyHidden()]}>
						Leave a comment
					</label>
					<EmojiTextarea
						id={`cairn-comment-${issue.id}`}
						name="body"
						variant="cairn"
						rows={3}
						maxLength={600}
						required
						placeholder="Leave a comment…"
					/>
					<span mix={[raw({ display: "flex", justifyContent: "flex-end" })]}>
						<Button type="submit" size="sm" variant="outline" color="neutral">
							Comment
						</Button>
					</span>
				</form>
			</section>
		);
	};
}

/**
 * Renders the issue. Beside a list it is one column with the properties under the title; on
 * a wide page the properties move to a column of their own beside the description and feed.
 */
export function IssueDetail(handle: Handle<IssueDetail.Props>) {
	return () => {
		let {
			issue,
			state,
			returnTo,
			level,
			closeHref,
			position,
			frames,
			sheet = false,
		} = handle.props;
		let team = findTeam(issue.team);
		let children = allIssues(state).filter((candidate) => candidate.parent === issue.id);
		let parent = issue.parent
			? allIssues(state).find((candidate) => candidate.id === issue.parent)
			: undefined;
		let recent = issue.editedAt !== undefined && Date.now() - issue.editedAt < SAVED_WINDOW_MS;

		return (
			<article
				aria-labelledby={`issue-title-${issue.id}`}
				data-issue-detail={issue.id}
				mix={[
					raw({
						container: "cairn-issue / inline-size",
						display: "flex",
						flexDirection: "column",
						minBlockSize: "100%",
					}),
				]}
			>
				<form
					id={propsFormId(issue.id)}
					method="post"
					action={editHref(returnTo)}
					data-rmx-target={frames?.view}
					hidden
				>
					<input type="hidden" name="issue" value={issue.id} />
				</form>
				<SavingSignal
					form={propsFormId(issue.id)}
					status={saveStatusId(issue.id)}
					editedAt={
						issue.editedAt === undefined ? undefined : new Date(issue.editedAt).toISOString()
					}
				/>
				{sheet ? null : (
					<header
						mix={[
							raw({
								position: "sticky",
								insetBlockStart: "0",
								zIndex: "2",
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
								minBlockSize: "2.75rem",
								paddingInline: "1rem 0.5rem",
								backgroundColor: "var(--ui-bg, Canvas)",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
								fontSize: "0.8125rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						<span
							mix={[
								raw({
									whiteSpace: "nowrap",
									"@container cairn-issue (width < 34rem)": { display: "none" },
								}),
							]}
						>
							{team?.name}
						</span>
						<span aria-hidden="true">›</span>
						<span
							mix={[
								raw({
									fontFamily: "var(--ui-font-mono)",
									color: "var(--ui-neutral-fg-emphasis)",
									whiteSpace: "nowrap",
								}),
							]}
						>
							{issue.id}
						</span>
						<span mix={[raw({ flex: "1 1 auto", minInlineSize: 0, overflow: "hidden" })]}>
							<SaveStatus
								id={saveStatusId(issue.id)}
								state={recent ? "saved" : "idle"}
								editedAt={
									issue.editedAt === undefined ? undefined : new Date(issue.editedAt).toISOString()
								}
								locale={LOCALE}
								labels={SAVE_LABELS}
							/>
						</span>
						{position ? (
							<>
								<span mix={[raw({ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" })]}>
									<span mix={[visuallyHidden()]}>Issue </span>
									{`${position.index} / ${position.total}`}
								</span>
								<HeaderLink
									href={position.previousHref}
									label="Previous issue"
									frame={frames?.issue}
								>
									<ChevronUpIcon size={16} aria-hidden="true" />
								</HeaderLink>
								<HeaderLink href={position.nextHref} label="Next issue" frame={frames?.issue}>
									<ChevronDownIcon size={16} aria-hidden="true" />
								</HeaderLink>
							</>
						) : null}
						{closeHref ? (
							<HeaderLink href={closeHref} label="Close issue" frame={frames?.view}>
								<XIcon size={16} aria-hidden="true" />
							</HeaderLink>
						) : null}
					</header>
				)}
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr)",
							gridTemplateAreas: '"main" "props" "rest"',
							gap: "1.5rem",
							padding: sheet ? "0" : "1.25rem 1rem 2rem",
							"@container cairn-issue (width >= 36rem)": {
								gridTemplateColumns: "minmax(0, 1fr) 13.5rem",
								gridTemplateAreas: '"main props" "rest props"',
								alignItems: "start",
								columnGap: "1.5rem",
								paddingInline: "1.5rem",
							},
						}),
					]}
				>
					<div
						mix={[
							raw({ gridArea: "main", display: "flex", flexDirection: "column", gap: "0.75rem" }),
						]}
					>
						{sheet ? (
							<span mix={[raw({ minBlockSize: "1.25rem", fontSize: "0.8125rem" })]}>
								<SaveStatus
									id={saveStatusId(issue.id)}
									state={recent ? "saved" : "idle"}
									editedAt={
										issue.editedAt === undefined
											? undefined
											: new Date(issue.editedAt).toISOString()
									}
									locale={LOCALE}
									labels={SAVE_LABELS}
								/>
							</span>
						) : null}
						{parent ? (
							<a
								href={href(`team/${parent.team}?issue=${parent.id}`)}
								data-rmx-prefetch="intent"
								mix={[
									raw({
										alignSelf: "start",
										display: "inline-flex",
										alignItems: "center",
										gap: "0.375rem",
										fontSize: "0.8125rem",
										color: "var(--ui-neutral-fg-muted)",
										textDecoration: "none",
										"&:hover": { color: "var(--ui-neutral-fg-emphasis)" },
									}),
								]}
							>
								<span mix={[visuallyHidden()]}>Sub-issue of </span>
								<StatusIcon status={parent.status} />
								<span mix={[raw({ fontFamily: "var(--ui-font-mono)" })]}>{parent.id}</span>
								{parent.title}
							</a>
						) : null}
						{iife(() => {
							if (sheet) return null;
							if (level === 1) {
								return (
									<h1
										id={`issue-title-${issue.id}`}
										mix={[
											raw({
												margin: "0",
												fontSize: "1.375rem",
												lineHeight: "1.875rem",
												fontWeight: "600",
												letterSpacing: "-0.01em",
												color: "var(--ui-neutral-fg-emphasis)",
												textWrap: "pretty",
											}),
										]}
									>
										{expandEmoji(issue.title)}
									</h1>
								);
							}
							return (
								<h2
									id={`issue-title-${issue.id}`}
									mix={[
										raw({
											margin: "0",
											fontSize: "1.375rem",
											lineHeight: "1.875rem",
											fontWeight: "600",
											letterSpacing: "-0.01em",
											color: "var(--ui-neutral-fg-emphasis)",
											textWrap: "pretty",
										}),
									]}
								>
									{expandEmoji(issue.title)}
								</h2>
							);
						})}
						{issue.description.length === 0 ? (
							<p
								mix={[
									raw({ margin: "0", fontSize: "0.9375rem", color: "var(--ui-neutral-fg-muted)" }),
								]}
							>
								No description yet.
							</p>
						) : (
							issue.description.map((paragraph) => (
								<p
									mix={[
										raw({
											margin: "0",
											fontSize: "0.9375rem",
											lineHeight: "1.5rem",
											color: "var(--ui-neutral-fg)",
											maxInlineSize: "65ch",
										}),
									]}
								>
									{expandEmoji(paragraph)}
								</p>
							))
						)}
					</div>
					<aside
						aria-label="Properties"
						mix={[
							raw({
								gridArea: "props",
								"@container cairn-issue (width >= 36rem)": {
									position: "sticky",
									insetBlockStart: "1.25rem",
								},
								padding: "0.75rem 1rem",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "var(--ui-radius-lg, 0.375rem)",
								backgroundColor: "var(--ui-neutral-bg-tint)",
							}),
						]}
					>
						<Properties issue={issue} />
						<p
							mix={[
								raw({
									margin: "0.5rem 0 0",
									fontSize: "0.75rem",
									lineHeight: "1.5rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							Press <Keyboard>S</Keyboard> <Keyboard>P</Keyboard> or <Keyboard>A</Keyboard> to
							change a property.
						</p>
					</aside>
					<div
						mix={[
							raw({ gridArea: "rest", display: "flex", flexDirection: "column", gap: "1.75rem" }),
						]}
					>
						{children.length > 0 ? (
							<SubIssues issue={issue} items={children} returnTo={returnTo} />
						) : null}
						<Activity issue={issue} returnTo={returnTo} frame={frames?.issue} />
					</div>
				</div>
			</article>
		);
	};
}
