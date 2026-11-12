/**
 * Creating an issue: a native dialog every screen carries, opened by `c` or a Create button,
 * and the same form as a page of its own, which a refused post answers with everything typed
 * and what to fix, and which a browser without the Invoker API reaches by link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Button, Dialog, HeadingScope, Label, Select, TextArea, TextField } from "@sdxc/ui";

import type { PriorityId, StatusId } from "./data";

import {
	ME,
	PEOPLE,
	PRIORITIES,
	PRIORITY_NAMES,
	PROJECTS,
	STATUSES,
	STATUS_NAMES,
	TEAMS,
	actionHref,
} from "./data";

/** What the form shows: the defaults, or what a refused post carried. */
export interface CreateDraft {
	title: string;
	description: string;
	team: string;
	status: StatusId;
	priority: PriorityId;
	assignee: string;
	project: string;
}

/** Why a draft was refused, by field. */
export interface CreateIssues {
	title?: string;
}

/** The longest title the form takes. */
export const TITLE_LIMIT = 120;

/** A blank draft for a team, assigned to the signed-in person and waiting in Todo. */
export function blankDraft(team: string): CreateDraft {
	return {
		title: "",
		description: "",
		team,
		status: "todo",
		priority: 0,
		assignee: ME,
		project: "",
	};
}

namespace CreateIssueFields {
	export interface Props {
		/** Prefixes every field's id, so the dialog and the page never share one. */
		id: string;
		draft: CreateDraft;
		issues?: CreateIssues;
		/** The page a refused post comes back to. */
		from: string;
	}
}

/** One labelled native select. */
function Choice(
	handle: Handle<{
		id: string;
		name: string;
		label: string;
		value: string;
		options: Array<{ value: string; label: string }>;
	}>,
) {
	return () => {
		let { id, name, label, value, options } = handle.props;
		return (
			<div mix={[vstack({ gap: 1.5, align: "stretch" }), raw({ minInlineSize: 0 })]}>
				<Label htmlFor={id}>{label}</Label>
				<Select id={id} name={name}>
					{options.map((option) => (
						<Select.Option value={option.value} selected={option.value === value}>
							{option.label}
						</Select.Option>
					))}
				</Select>
			</div>
		);
	};
}

/** The form's fields: title and description, then the properties in a grid. */
export function CreateIssueFields(handle: Handle<CreateIssueFields.Props>) {
	return () => {
		let { id, draft, issues = {}, from } = handle.props;
		return (
			<div mix={[vstack({ gap: 4, align: "stretch" })]}>
				<input type="hidden" name="from" value={from} />
				<TextField
					label="Title"
					name="title"
					defaultValue={draft.title}
					placeholder="Issue title"
					maxLength={TITLE_LIMIT}
					errorMessage={issues.title}
					required
					autofocus
				/>
				<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
					<Label htmlFor={`${id}-description`}>Description</Label>
					<TextArea
						id={`${id}-description`}
						name="description"
						rows={4}
						placeholder="Add a description…"
						defaultValue={draft.description}
					/>
				</div>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "0.75rem",
							gridTemplateColumns: "repeat(auto-fit, minmax(min(9rem, 100%), 1fr))",
						}),
					]}
				>
					<Choice
						id={`${id}-team`}
						name="team"
						label="Team"
						value={draft.team}
						options={TEAMS.map((team) => ({ value: team.id, label: team.name }))}
					/>
					<Choice
						id={`${id}-status`}
						name="status"
						label="Status"
						value={draft.status}
						options={STATUSES.map((status) => ({ value: status, label: STATUS_NAMES[status] }))}
					/>
					<Choice
						id={`${id}-priority`}
						name="priority"
						label="Priority"
						value={String(draft.priority)}
						options={PRIORITIES.map((priority) => ({
							value: String(priority),
							label: PRIORITY_NAMES[priority],
						}))}
					/>
					<Choice
						id={`${id}-assignee`}
						name="assignee"
						label="Assignee"
						value={draft.assignee}
						options={[
							{ value: "none", label: "No one" },
							...PEOPLE.map((person) => ({
								value: person.id,
								label: person.id === ME ? `${person.name} (you)` : person.name,
							})),
						]}
					/>
					<Choice
						id={`${id}-project`}
						name="project"
						label="Project"
						value={draft.project}
						options={[
							{ value: "", label: "No project" },
							...PROJECTS.filter((project) => project.health !== "completed").map((project) => ({
								value: project.id,
								label: project.name,
							})),
						]}
					/>
				</div>
			</div>
		);
	};
}

/**
 * The create-issue dialog: a native modal dialog with the form, posting to `new`. The new
 * issue opens beside its team's list, which is the confirmation.
 */
export function CreateIssueDialog(handle: Handle<{ id: string; team: string; from: string }>) {
	return () => {
		let { id, team, from } = handle.props;
		return (
			<HeadingScope level={2}>
				<Dialog
					id={id}
					aria-labelledby={`${id}-title`}
					mix={[raw({ inlineSize: "min(36rem, calc(100vw - 2rem))" })]}
				>
					<form
						method="post"
						action={actionHref("new")}
						data-rmx-document
						mix={[vstack({ gap: 4, align: "stretch" })]}
					>
						<Dialog.Header>
							<Dialog.Title id={`${id}-title`}>Create issue</Dialog.Title>
							<Dialog.Description>It opens beside its team's list once created.</Dialog.Description>
						</Dialog.Header>
						<CreateIssueFields id={id} draft={blankDraft(team)} from={from} />
						<Dialog.Footer>
							<Button
								type="button"
								variant="outline"
								color="neutral"
								commandfor={id}
								command="close"
							>
								Cancel
							</Button>
							<Button type="submit" color="brand">
								Create issue
							</Button>
						</Dialog.Footer>
					</form>
				</Dialog>
			</HeadingScope>
		);
	};
}

/** The create form as a page: the fallback, and the answer to a refused post. */
export function CreateIssuePage(
	handle: Handle<{ draft: CreateDraft; issues?: CreateIssues; from: string }>,
) {
	return () => {
		let { draft, issues, from } = handle.props;
		return (
			<div mix={[vstack({ gap: 5, align: "stretch" }), raw({ maxInlineSize: "40rem" })]}>
				<header mix={[vstack({ gap: 1, align: "stretch" })]}>
					<h1 mix={[m(0), text("xl"), raw({ fontWeight: "600" })]}>Create issue</h1>
					<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
						It opens beside its team's list once created.
					</p>
				</header>
				<form
					method="post"
					action={actionHref("new")}
					data-rmx-document
					mix={[vstack({ gap: 5, align: "stretch" })]}
				>
					<CreateIssueFields id="cairn-create-page" draft={draft} issues={issues} from={from} />
					<div mix={[hstack({ gap: 2, justify: "end" })]}>
						<Button type="submit" color="brand">
							Create issue
						</Button>
					</div>
				</form>
			</div>
		);
	};
}
