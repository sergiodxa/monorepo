/**
 * One of Delta's issues: its title and state, a timeline that gives conversation a card and
 * housekeeping a line, a comment box that posts and redraws in place, and a side panel whose
 * assignees, labels and milestone pickers save once each closes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	CircleCheckIcon,
	CircleDotIcon,
	CircleSlashIcon,
	GitPullRequestIcon,
	MilestoneIcon,
	PencilIcon,
	TagIcon,
	UserRoundIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import {
	Button,
	HeadingScope,
	LabelChip,
	PropertyList,
	RelativeTime,
	TextArea,
	Timeline,
} from "@sdxc/ui";
import { FilterMenu } from "@sdxc/ui/app/filter-menu";
import { SaveStatus } from "@sdxc/ui/app/save-status";

import type { CiteContext } from "../markup";
import type { IssueView, TimelineEntry, TimelineEvent } from "../records";
import type { RecordState } from "../states";

import { actionHref } from "../data";
import { COPY, PICKER_LABELS, SAVE_LABELS } from "../labels";
import { Body } from "../markup";
import { SAVES_ATTRIBUTE, SavingSignal } from "../saving";
import { LABELS, MILESTONES, findLabel, findMilestone } from "../seed/issues";
import { PEOPLE } from "../seed/people";
import { RepoHeader } from "../shell";
import { SAVED_WINDOW_MS } from "../state";
import { Avatar, StatePill, nameOf } from "../states";

/** The id of the side panel's save status, which its pickers report to. */
export const SAVE_STATUS_ID = "delta-issue-saved";

/** A timeline event's glyph and tone. */
function eventIcon(event: TimelineEvent): { icon: RemixNode; tone?: Timeline.Tone } {
	if (event.kind === "labeled" || event.kind === "unlabeled") return { icon: <TagIcon /> };
	if (event.kind === "assigned" || event.kind === "unassigned") return { icon: <UserRoundIcon /> };
	if (event.kind === "milestoned") return { icon: <MilestoneIcon /> };
	if (event.kind === "closed" && event.reason === "not_planned")
		return { icon: <CircleSlashIcon /> };
	if (event.kind === "closed") return { icon: <CircleCheckIcon />, tone: "brand" };
	if (event.kind === "reopened") return { icon: <CircleDotIcon />, tone: "success" };
	if (event.kind === "referenced") return { icon: <GitPullRequestIcon /> };
	return { icon: <PencilIcon /> };
}

/** A label as a chip, inline in an event's sentence or a side panel row. */
export function chip(id: string): RemixNode {
	let label = findLabel(id);
	return label === undefined ? id : <LabelChip color={label.color}>{label.name}</LabelChip>;
}

namespace EventText {
	export interface Props {
		event: TimelineEvent;
		context: CiteContext;
	}
}

/** What an event says after its actor, in GitHub's words. */
export function EventText(handle: Handle<EventText.Props>) {
	return () => {
		let { context, event } = handle.props;
		let words = COPY.issue.events;
		let strong = (text: string) => (
			<strong mix={[raw({ fontWeight: 600, color: "var(--ui-neutral-fg-emphasis)" })]}>
				{text}
			</strong>
		);
		if (event.kind === "labeled" || event.kind === "unlabeled") {
			return (
				<span
					mix={[
						raw({ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: "0.25rem" }),
					]}
				>
					{event.kind === "labeled" ? words.labeled : words.unlabeled} {chip(event.label)}{" "}
					{words.label}
				</span>
			);
		}
		if (event.kind === "assigned") {
			if (event.person === event.actor) return words.selfAssigned;
			return (
				<>
					{`${words.assigned} `}
					{strong(nameOf(event.person))}
				</>
			);
		}
		if (event.kind === "unassigned") {
			return (
				<>
					{`${words.unassigned} `}
					{strong(nameOf(event.person))}
				</>
			);
		}
		if (event.kind === "milestoned") {
			return (
				<>
					{`${words.milestoned} `}
					{strong(findMilestone(event.milestone)?.title ?? event.milestone)}
					{` ${words.milestoneSuffix}`}
				</>
			);
		}
		if (event.kind === "closed")
			return event.reason === "not_planned" ? words.notPlanned : words.completed;
		if (event.kind === "reopened") return words.reopened;
		if (event.kind === "referenced") {
			let href = context.refHref(event.pull);
			return (
				<>
					{`${words.mentioned} `}
					{href === undefined ? (
						`#${event.pull}`
					) : (
						<a href={href} data-rmx-prefetch="intent">{`#${event.pull}`}</a>
					)}
				</>
			);
		}
		return `${words.renamed}`;
	};
}

namespace Entry {
	export interface Props {
		entry: TimelineEntry;
		now: number;
		context: CiteContext;
	}
}

/** One timeline entry: a comment as a card, an event as a line on the rail. */
export function Entry(handle: Handle<Entry.Props>) {
	return () => {
		let { context, entry, now } = handle.props;
		let time = <RelativeTime date={entry.at} now={now} locale="en" />;
		if (entry.type === "comment") {
			return (
				<Timeline.Comment
					id={`comment-${entry.id}`}
					avatar={<Avatar handle={entry.author} size={32} />}
					author={nameOf(entry.author)}
					action={COPY.issue.commented}
					time={time}
				>
					<Body blocks={entry.body} context={context} />
				</Timeline.Comment>
			);
		}
		let { icon, tone } = eventIcon(entry);
		return (
			<Timeline.Event
				icon={icon}
				tone={tone}
				avatar={<Avatar handle={entry.actor} size={20} />}
				actor={nameOf(entry.actor)}
				time={time}
			>
				<EventText event={entry} context={context} />
			</Timeline.Event>
		);
	};
}

/** Where a side panel's picker posts: the record's page, naming the field it sets. */
function pickerAction(page: string, field: string): string {
	return `${actionHref(page)}?set=${field}`;
}

namespace SidePanel {
	export interface Props {
		/** The record's page, which every picker posts to. */
		page: string;
		assignees: readonly string[];
		labels: readonly string[];
		milestone?: string;
		editedAt?: number;
		/** Everyone who took part, the author first. */
		participants: readonly string[];
		/** Rows above the assignees, such as a pull request's reviewers. */
		before?: RemixNode;
		/** Rows under the milestone, such as the issues a pull request closes. */
		after?: RemixNode;
	}
}

/**
 * The side panel: assignees, labels and milestone, each a row whose value opens a filterable
 * picker that saves once it closes changed, with a quiet save status over them, then everyone
 * who took part.
 */
export function SidePanel(handle: Handle<SidePanel.Props>) {
	return () => {
		let { after, assignees, before, editedAt, labels, page, participants } = handle.props;
		let recent = editedAt !== undefined && Date.now() - editedAt < SAVED_WINDOW_MS;
		let milestone = findMilestone(handle.props.milestone);
		let saves = { [SAVES_ATTRIBUTE]: SAVE_STATUS_ID };
		return (
			<aside
				aria-labelledby="delta-issue-details"
				data-slot="delta-side-panel"
				mix={[raw({ display: "grid", gap: "0.75rem", alignContent: "start", minInlineSize: 0 })]}
			>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: "0.5rem",
						}),
					]}
				>
					<h2
						id="delta-issue-details"
						mix={[
							raw({
								margin: 0,
								fontSize: "0.875rem",
								fontWeight: 600,
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{COPY.issue.details}
					</h2>
					<span mix={[raw({ fontSize: "0.75rem", minBlockSize: "1.125rem" })]}>
						<SaveStatus
							id={SAVE_STATUS_ID}
							state={recent ? "saved" : "idle"}
							editedAt={editedAt === undefined ? undefined : new Date(editedAt).toISOString()}
							locale="en"
							labels={SAVE_LABELS}
						/>
					</span>
				</div>
				<SavingSignal />
				<PropertyList>
					{before}
					<PropertyList.Item
						label={COPY.issue.assignees}
						empty={COPY.issue.noAssignees}
						edit={{
							id: "delta-issue-assignees",
							label: COPY.issue.editAssignees,
							popover: (
								<FilterMenu.Popover
									id="delta-issue-assignees"
									mode="multiple"
									name="assignee"
									action={pickerAction(page, "assignees")}
									groups={[
										{
											label: COPY.issue.suggestions,
											items: PEOPLE.map((person) => ({
												value: person.handle,
												label: person.name,
												description: `@${person.handle}`,
												selected: assignees.includes(person.handle),
											})),
										},
									]}
									labels={PICKER_LABELS.assignees}
									{...saves}
								/>
							),
						}}
					>
						{assignees.length === 0 ? null : (
							<span mix={[raw({ display: "grid", gap: "0.375rem" })]}>
								{assignees.map((person) => (
									<span
										mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })]}
									>
										<Avatar handle={person} size={20} />
										{nameOf(person)}
									</span>
								))}
							</span>
						)}
					</PropertyList.Item>
					<PropertyList.Item
						label={COPY.issue.labels}
						empty={COPY.issue.noLabels}
						edit={{
							id: "delta-issue-labels",
							label: COPY.issue.editLabels,
							popover: (
								<FilterMenu.Popover
									id="delta-issue-labels"
									mode="multiple"
									name="label"
									action={pickerAction(page, "labels")}
									groups={[
										{
											label: COPY.issue.repoLabels,
											items: LABELS.map((label) => ({
												value: label.id,
												label: label.name,
												color: label.color,
												description: label.description,
												selected: labels.includes(label.id),
											})),
										},
									]}
									labels={PICKER_LABELS.labels}
									{...saves}
								/>
							),
						}}
					>
						{labels.length === 0 ? null : (
							<span mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.25rem" })]}>
								{labels.map((id) => chip(id))}
							</span>
						)}
					</PropertyList.Item>
					<PropertyList.Item
						label={COPY.issue.milestone}
						empty={COPY.issue.noMilestone}
						edit={{
							id: "delta-issue-milestone",
							label: COPY.issue.editMilestone,
							popover: (
								<FilterMenu.Popover
									id="delta-issue-milestone"
									mode="single"
									name="milestone"
									action={pickerAction(page, "milestone")}
									groups={[
										{
											label: COPY.issue.milestones,
											items: [
												{
													value: "",
													label: COPY.issue.clearMilestone,
													selected: milestone === undefined,
												},
												...MILESTONES.map((entry) => ({
													value: entry.id,
													label: entry.title,
													description: entry.description,
													selected: entry.id === milestone?.id,
												})),
											],
										},
									]}
									labels={PICKER_LABELS.milestone}
									{...saves}
								/>
							),
						}}
					>
						{milestone === undefined ? null : (
							<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })]}>
								<MilestoneIcon size={14} aria-hidden="true" />
								{milestone.title}
							</span>
						)}
					</PropertyList.Item>
					{after}
					<PropertyList.Item label={COPY.issue.participants}>
						<span mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.25rem" })]}>
							{participants.map((person) => (
								<span title={nameOf(person)}>
									<Avatar handle={person} size={24} />
									<span mix={[visuallyHidden()]}>{nameOf(person)}</span>
								</span>
							))}
						</span>
					</PropertyList.Item>
				</PropertyList>
			</aside>
		);
	};
}

/** Everyone who took part in a conversation, its author first, each once. */
export function participantsOf(author: string, timeline: readonly TimelineEntry[]): string[] {
	return [
		...new Set([
			author,
			...timeline.flatMap((entry) => (entry.type === "comment" ? [entry.author] : [entry.actor])),
		]),
	];
}

namespace CommentForm {
	export interface Props {
		issue: IssueView;
	}
}

/**
 * The comment box at the end of the conversation: Comment posts the text, and Close or
 * Reopen changes the state, closing with the text as its comment when there is one.
 */
function CommentForm(handle: Handle<CommentForm.Props>) {
	return () => {
		let { issue } = handle.props;
		let open = issue.state === "open";
		return (
			<form
				method="post"
				action={actionHref(`delta/issues/${issue.number}`)}
				data-slot="delta-comment-form"
				mix={[
					raw({
						display: "grid",
						gap: "0.5rem",
						padding: "0.75rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-lg)",
						backgroundColor: "var(--ui-bg, Canvas)",
					}),
				]}
			>
				<label htmlFor="delta-issue-comment" mix={[raw({ fontSize: "0.875rem", fontWeight: 600 })]}>
					{COPY.issue.commentLabel}
				</label>
				<TextArea
					id="delta-issue-comment"
					name="body"
					rows={4}
					maxLength={600}
					required
					placeholder={COPY.issue.commentPlaceholder}
				/>
				<div
					mix={[
						raw({ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "0.5rem" }),
					]}
				>
					<Button
						type="submit"
						name="intent"
						value={open ? "close" : "reopen"}
						formNoValidate
						variant="outline"
						color="neutral"
						size="sm"
					>
						{open ? (
							<CircleCheckIcon size={16} aria-hidden="true" />
						) : (
							<CircleDotIcon size={16} aria-hidden="true" />
						)}
						{open ? COPY.issue.closeIssue : COPY.issue.reopenIssue}
					</Button>
					<Button type="submit" name="intent" value="comment" size="sm">
						{COPY.issue.comment}
					</Button>
				</div>
			</form>
		);
	};
}

namespace IssueScreen {
	export interface Props {
		issue: IssueView;
		context: CiteContext;
		now: number;
		commits: number;
		/** The issues list's address, for the trail; absent while the list isn't linked. */
		listHref?: string;
	}
}

/**
 * Renders the issue: a header that sticks and compacts as the timeline scrolls under it, the
 * opening post and every comment and event, the comment box, and the side panel beside them on
 * a wide screen or under the conversation on a narrow one.
 */
export function IssueScreen(handle: Handle<IssueScreen.Props>) {
	return () => {
		let { commits, context, issue, listHref, now } = handle.props;
		let state: RecordState = issue.state === "open" ? "open" : (issue.reason ?? "completed");
		let pill = issue.state === "open" ? COPY.issue.open : COPY.issue.closed;
		return (
			<>
				<RepoHeader
					title={
						<>
							{issue.title}{" "}
							<span mix={[raw({ fontWeight: 400, color: "var(--ui-neutral-fg-muted)" })]}>
								{`#${issue.number}`}
							</span>
						</>
					}
					trail={[{ label: COPY.issues.title, href: listHref }, { label: `#${issue.number}` }]}
					parent={listHref === undefined ? undefined : { href: listHref, label: COPY.issues.title }}
					status={
						<StatePill state={state}>
							{issue.reason === "not_planned" && issue.state === "closed"
								? COPY.issue.notPlanned
								: pill}
						</StatePill>
					}
					description={
						<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
							<strong mix={[raw({ fontWeight: 600, color: "var(--ui-neutral-fg-emphasis)" })]}>
								{nameOf(issue.author)}
							</strong>
							{` ${COPY.issue.opened} `}
							<RelativeTime date={issue.createdAt} now={now} locale="en" />
							{` · ${COPY.issue.comments(issue.comments)}`}
						</span>
					}
					sticky
					tab="issues"
					commits={commits}
				/>
				<div data-slot="delta-record" mix={[raw({ container: "delta-record / inline-size" })]}>
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "minmax(0, 1fr)",
								gap: "1.5rem",
								paddingBlock: "1.25rem 2rem",
								"@container delta-record (width >= 52rem)": {
									gridTemplateColumns: "minmax(0, 1fr) 15rem",
									alignItems: "start",
									columnGap: "2rem",
								},
							}),
						]}
					>
						<HeadingScope level={2}>
							<section
								aria-labelledby="delta-issue-conversation"
								mix={[raw({ display: "grid", gap: "1rem", minInlineSize: 0 })]}
							>
								<h2 id="delta-issue-conversation" mix={[visuallyHidden()]}>
									{COPY.issue.conversation}
								</h2>
								<Timeline>
									<Timeline.Comment
										id={`issue-${issue.number}-body`}
										avatar={<Avatar handle={issue.author} size={32} />}
										author={nameOf(issue.author)}
										action={COPY.issue.commented}
										time={<RelativeTime date={issue.createdAt} now={now} locale="en" />}
									>
										<Body blocks={issue.body} context={context} />
									</Timeline.Comment>
									{issue.timeline.map((entry) => (
										<Entry entry={entry} now={now} context={context} />
									))}
								</Timeline>
								<CommentForm issue={issue} />
							</section>
							<SidePanel
								page={`delta/issues/${issue.number}`}
								assignees={issue.assignees}
								labels={issue.labels}
								milestone={issue.milestone}
								editedAt={issue.editedAt}
								participants={participantsOf(issue.author, issue.timeline)}
							/>
						</HeadingScope>
					</div>
				</div>
			</>
		);
	};
}
