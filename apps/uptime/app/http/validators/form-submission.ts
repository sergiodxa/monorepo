/**
 * What a form page needs to render a refused submission again: every value as it was posted
 * and one translated issue per field. Pages read their defaults through these helpers, so a
 * failed save shows the person exactly what they typed beside what to fix.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Form } from "@sdxc/ui";

/** A posted form the action refused, handed back to the page that renders it. */
export interface FormSubmission {
	/** The body exactly as posted, so repeated fields such as checkbox lists keep every value. */
	values: FormData;
	/** One issue per field, already translated; an issue with no `path` concerns the whole form. */
	issues: ReadonlyArray<Form.Issue>;
}

/** An issue as a schema reports it: a message and the path of the field it concerns, if any. */
interface ReportedIssue {
	readonly message: string;
	readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
}

/**
 * The field a schema issue concerns, or `undefined` when it concerns the whole form, as an
 * object-level refinement does.
 *
 * @param issue - The issue the schema reported.
 */
export function issueField(issue: ReportedIssue): string | undefined {
	let head = issue.path?.[0];
	if (head === undefined) return undefined;
	return String(typeof head === "object" && head !== null ? head.key : head);
}

/**
 * Rewrites schema issues into the page's own copy, keeping the first issue per field, so each
 * field shows one sentence that says what to enter instead of the schema's generic wording.
 *
 * @param issues - The issues the schema reported.
 * @param message - The translated message for a field, given `undefined` for a form-wide issue;
 *   it returns the field the issue belongs on and its copy.
 * @returns The issues to render, at most one per field.
 */
export function translateIssues(
	issues: ReadonlyArray<ReportedIssue>,
	message: (field: string | undefined) => { field: string | undefined; message: string },
): Form.Issue[] {
	let seen = new Set<string>();
	let translated: Form.Issue[] = [];

	for (let issue of issues) {
		let resolved = message(issueField(issue));
		let key = resolved.field ?? "";
		if (seen.has(key)) continue;
		seen.add(key);
		translated.push(
			resolved.field === undefined
				? { message: resolved.message }
				: { message: resolved.message, path: [resolved.field] },
		);
	}

	return translated;
}

/**
 * The first issue's message for `name`, for a control that renders its own error rather than
 * reading it from the enclosing `Form`.
 *
 * @param submission - The refused submission, or `undefined` on a first render.
 * @param name - The field's `name` attribute.
 */
export function fieldIssue(
	submission: FormSubmission | undefined,
	name: string,
): string | undefined {
	return submission?.issues.find((issue) => issueField(issue) === name)?.message;
}

/**
 * The posted value of a text field, or `fallback` on a first render.
 *
 * @param submission - The refused submission, or `undefined` on a first render.
 * @param name - The field's `name` attribute.
 * @param fallback - The saved or default value the page shows before anything was posted.
 */
export function submittedText(
	submission: FormSubmission | undefined,
	name: string,
	fallback: string,
): string {
	if (!submission) return fallback;
	let value = submission.values.get(name);
	return typeof value === "string" ? value : "";
}

/**
 * Whether a checkbox or switch was on when posted, or `fallback` on a first render. A box that
 * was off posts nothing, so its absence from the body reads as off.
 *
 * @param submission - The refused submission, or `undefined` on a first render.
 * @param name - The control's `name` attribute.
 * @param fallback - The saved or default state the page shows before anything was posted.
 */
export function submittedChecked(
	submission: FormSubmission | undefined,
	name: string,
	fallback: boolean,
): boolean {
	return submission ? submission.values.has(name) : fallback;
}

/**
 * The values a repeated field posted, such as a checkbox list's ids, or `fallback` on a first render.
 *
 * @param submission - The refused submission, or `undefined` on a first render.
 * @param name - The fields' shared `name` attribute.
 * @param fallback - The saved selection the page shows before anything was posted.
 */
export function submittedList(
	submission: FormSubmission | undefined,
	name: string,
	fallback: ReadonlyArray<string>,
): ReadonlyArray<string> {
	if (!submission) return fallback;
	return submission.values
		.getAll(name)
		.filter((value): value is string => typeof value === "string");
}
