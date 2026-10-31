/**
 * The "Was this helpful?" block closing a docs page, wired to the site's feedback endpoint.
 * The endpoint redirects back with `?feedback=sent`, and the page passes that on as `sent`,
 * so the thank-you renders on the server and the vote works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { DocsFeedback } from "@sdxc/ui";

import routes from "~/routes/web";

/** The block's element id, which the endpoint's redirect names as its fragment. */
export const DOCS_FEEDBACK_ID = "feedback";

/** The query parameter the endpoint's redirect sets once a vote is recorded. */
export const FEEDBACK_SENT_PARAM = "feedback";

/** The value {@link FEEDBACK_SENT_PARAM} carries after a recorded vote. */
export const FEEDBACK_SENT_VALUE = "sent";

/** The block's words, in the site's voice. */
const LABELS: DocsFeedback.Labels = {
	question: "Was this page helpful?",
	yes: "Yes",
	no: "No",
	note: "What could make it better? (optional)",
	send: "Send feedback",
	thanks: "Thanks for the feedback.",
};

/**
 * Whether `url` is the page the endpoint just sent a reader back to, so the block shows its
 * thank-you in place of the form.
 *
 * @example isFeedbackSent(ctx.url)
 */
export function isFeedbackSent(url: URL): boolean {
	return url.searchParams.get(FEEDBACK_SENT_PARAM) === FEEDBACK_SENT_VALUE;
}

namespace DocsFeedbackBlock {
	export interface Props {
		/** The page the vote is about, as its path; the endpoint sends the reader back to it. */
		path: string;
		/** Whether the reader just voted on this page, from {@link isFeedbackSent}. */
		sent: boolean;
	}
}

/**
 * Renders the vote form posting to `/docs/feedback`, or its thank-you once `sent`.
 *
 * @example <DocsFeedbackBlock path={activePath} sent={isFeedbackSent(ctx.url)} />
 */
export default function DocsFeedbackBlock(handle: Handle<DocsFeedbackBlock.Props>) {
	return () => (
		<DocsFeedback
			id={DOCS_FEEDBACK_ID}
			action={routes.docsFeedback.href()}
			page={handle.props.path}
			state={handle.props.sent ? "sent" : "idle"}
			labels={LABELS}
		/>
	);
}
