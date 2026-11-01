/**
 * Live preview for `DocsFeedback`: the quiet vote at a page's foot, which reveals a note
 * after a choice, beside the thank-you the server renders once the form is posted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { DocsFeedback } from "@sdxc/ui/docs";

/** Every string both states show. */
const LABELS: DocsFeedback.Labels = {
	question: "Was this page helpful?",
	yes: "Yes",
	no: "No",
	note: "Anything we could add? (optional)",
	send: "Send feedback",
	thanks: "Thanks for the feedback.",
};

/** The source the page shows, matching the markup below. */
const CODE = `<DocsFeedback
	action="/docs/feedback"
	page="/docs/alerts"
	state={sent ? "sent" : "idle"}
	labels={{
		question: "Was this page helpful?",
		yes: "Yes",
		no: "No",
		note: "Anything we could add? (optional)",
		send: "Send feedback",
		thanks: "Thanks for the feedback.",
	}}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), vstack({ gap: 8, align: "stretch" })]}>
			<DocsFeedback action="#feedback" page="/docs/alerts" labels={LABELS} />
			<DocsFeedback action="#feedback" page="/docs/alerts" labels={LABELS} state="sent" />
		</div>
	),
};
