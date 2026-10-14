/**
 * The schemas the form previews validate against, and the checks a single field preview
 * runs on its own. They live here rather than beside the markup because a schema is plain
 * data with no DOM in it, and because the same schema is read twice: once by the submit
 * handler that produces the issues a `Form` renders, and once by the `validate()` mixin
 * that mirrors a verdict into one field as it is typed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";

/** Lowercase letters, digits and single inner dashes, which is what a URL segment allows. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A hostname's labels, each alphanumeric with optional inner dashes, and a final suffix. */
const HOSTNAME_PATTERN = /^(?=.{4,253}$)[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9-]+)+$/;

/**
 * The domain a workspace serves its dashboard from, checked by a `validate()` mixin while
 * it is typed. `validate()` hands over a control's raw `value`, so the schema trims and
 * lowercases it before the checks and reports whichever rule the typing has reached.
 */
export const CustomDomain = s
	.string()
	.transform((value) => value.trim().toLowerCase())
	.refine((value) => value.length > 0, "Enter the domain your team will visit.")
	.refine(
		(value) => !value.includes("://"),
		"Enter the host on its own, with no https:// in front.",
	)
	.refine((value) => HOSTNAME_PATTERN.test(value), "Use a full hostname, like app.acme.com.");

/** The submission a new workspace is created from. */
export const NewWorkspace = f.object({
	name: f.field(
		s.string().pipe({
			check: (value) => value.trim().length >= 2,
			message: "Give the workspace a name of at least two characters.",
		}),
	),
	slug: f.field(
		s
			.string()
			.refine((value) => value.length > 0, "Pick the address teammates will use.")
			.refine((value) => SLUG_PATTERN.test(value), "Use lowercase letters, numbers and dashes."),
	),
	ownerEmail: f.field(
		s.string().pipe(
			{
				check: (value) => value.length > 0,
				message: "Enter the email address that will own billing.",
			},
			{ ...checks.email(), message: "That does not look like an email address." },
		),
	),
	terms: f.field(
		s
			.defaulted(s.string(), "")
			.refine((value) => value === "accepted", "Accept the terms to continue."),
	),
});

/**
 * The issues a submission reports, in the order the fields appear, so the first invalid
 * field is the one a `Form` lands focus on.
 *
 * @param formData - The submission to check.
 * @returns Every issue the schema reports, empty once the submission is valid.
 */
export function checkNewWorkspace(formData: FormData): ReadonlyArray<s.Issue> {
	let result = s.parseSafe(NewWorkspace, formData);
	return result.success ? [] : result.issues;
}

/**
 * The message addressed to one field, for a control that reads its own error rather than
 * letting a field wrapper look it up: a checkbox or a select renders its `FieldError`
 * itself.
 *
 * @param issues - Every issue the submission reported.
 * @param name - The field's `name` attribute.
 * @returns The first message for that field, or `undefined` when it is valid.
 */
export function issueFor(issues: ReadonlyArray<s.Issue>, name: string): string | undefined {
	return issues.find((issue) => {
		let [segment] = issue.path ?? [];
		if (segment === undefined) return false;
		// A path segment is either the key itself or an object carrying it, and a form-data
		// schema may report either shape.
		return String(typeof segment === "object" ? segment.key : segment) === name;
	})?.message;
}
