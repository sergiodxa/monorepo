/**
 * The fields the "Was this helpful?" form under every docs page submits, validated before
 * anything trusts them. The note is optional and capped, so one answer stays one log line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	DOCS_FEEDBACK_NOTE_FIELD,
	DOCS_FEEDBACK_PAGE_FIELD,
	DOCS_FEEDBACK_VOTE_FIELD,
} from "@sdxc/ui/docs";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";

/** The longest note kept; a longer one is refused rather than cut mid-sentence. */
const MAX_NOTE_LENGTH = 2000;

/** The longest page path accepted, well past any doc's. */
const MAX_PAGE_LENGTH = 200;

/** The answer to "Was this helpful?", the page it was asked on, and the reader's note. */
export const DocsFeedbackSchema = f.object({
	[DOCS_FEEDBACK_VOTE_FIELD]: f.field(s.enum_(["yes", "no"])),
	[DOCS_FEEDBACK_PAGE_FIELD]: f.field(
		s.string().pipe(checks.minLength(1), checks.maxLength(MAX_PAGE_LENGTH)),
	),
	[DOCS_FEEDBACK_NOTE_FIELD]: f.field(
		s.defaulted(s.string().pipe(checks.maxLength(MAX_NOTE_LENGTH)), ""),
	),
});

/** A validated docs feedback submission. */
export type DocsFeedbackInput = s.InferOutput<typeof DocsFeedbackSchema>;
