/**
 * A docs demo page's "Was this page helpful?" block, served as its own frame so the page
 * and its vote cache apart. The page inlines the frame on the server, so the form reads and
 * posts without JavaScript; with the runtime, a vote reloads only this frame.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { DocsFeedback } from "@sdxc/ui/docs";
import { Frame } from "remix/component";

import { demoDocsHref, findDemoDocsSite } from "~/resources/views/demo-docs";
import routes from "~/routes/web";

/** The query parameter a page or the frame carries after a vote, which swaps the form for its thanks. */
export const FEEDBACK_SENT_PARAM = "feedback";

/** The id of the feedback block, which a vote's redirect lands on. */
export const FEEDBACK_ID = "feedback";

/** The frame's name, which the form targets and the vote's action recognises. */
export const FEEDBACK_FRAME = "feedback";

/** The frame part every page's block is served under, followed by the page's path. */
export const FEEDBACK_PART = "feedback";

/**
 * The address of a page's feedback frame, with the thanks flag once the reader has voted.
 *
 * @param slug The demo's folder name.
 * @param path The page's path under the site.
 * @param sent Whether the frame thanks the reader in place of the form.
 * @returns The frame's address under `/demo/frames/docs`.
 */
export function demoDocsFeedbackHref(slug: string, path: string, sent: boolean): string {
	let href = routes.demoFrames.docs.href({ site: slug, part: `${FEEDBACK_PART}/${path}` });
	return sent ? `${href}?${FEEDBACK_SENT_PARAM}=sent` : href;
}

/**
 * The path under the site of the page a vote names by its address, when that page is one of
 * the demo's own; any other address, including one outside the demo, is `null`, so a vote can
 * only ever send the reader back into the demo.
 *
 * @param slug The demo's folder name.
 * @param page The page's address, as the form posts it.
 * @returns The page's path under the site, or `null`.
 */
export async function findFeedbackPage(slug: string, page: string): Promise<string | null> {
	let root = `${demoDocsHref(slug)()}/`;
	if (!page.startsWith(root)) return null;
	let path = page.slice(root.length);
	let site = await findDemoDocsSite(slug);
	return site !== null && Object.hasOwn(site.pages, path) ? path : null;
}

/**
 * Where a vote sends a reader without the frame runtime: the page, thanking them, scrolled to
 * the block.
 *
 * @param slug The demo's folder name.
 * @param path The page's path under the site.
 * @returns The page's address with the thanks flag and the block's id.
 */
export function demoDocsThanksHref(slug: string, path: string): string {
	return `${demoDocsHref(slug)(path)}?${FEEDBACK_SENT_PARAM}=sent#${FEEDBACK_ID}`;
}

/**
 * The address the form posts to, naming the page in its query too. An enhanced vote leaves
 * this address in the location bar, and the page it names is what a reload of it returns to.
 *
 * @param slug The demo's folder name.
 * @param path The page's path under the site.
 * @returns The vote action's address.
 */
export function demoDocsFeedbackAction(slug: string, path: string): string {
	return `${routes.demoDocs.feedback.href({ site: slug })}?page=${demoDocsHref(slug)(path)}`;
}

namespace DemoDocsFeedback {
	export interface Props {
		slug: string;
		/** The page's path under the site, which the vote names. */
		path: string;
		sent: boolean;
	}
}

/**
 * The vote form, or its thanks once `sent`. The form targets the frame it renders in, so an
 * enhanced vote swaps only this block and keeps the reader's place on the page.
 */
export function DemoDocsFeedback(handle: Handle<DemoDocsFeedback.Props>) {
	return () => {
		let { path, sent, slug } = handle.props;
		return (
			<DocsFeedback
				id={FEEDBACK_ID}
				action={demoDocsFeedbackAction(slug, path)}
				page={demoDocsHref(slug)(path)}
				state={sent ? "sent" : "idle"}
				frame={FEEDBACK_FRAME}
				resetScroll="manual"
				labels={{
					question: "Was this page helpful?",
					yes: "Yes",
					no: "No",
					note: "What could make it better? (optional)",
					send: "Send",
					thanks: "Thanks for telling us. We read every note.",
				}}
			/>
		);
	};
}

/**
 * The block as a blocking frame: the server waits for it and inlines it into the page, so a
 * reader without scripts gets the form in the document they loaded.
 */
export function DemoDocsFeedbackFrame(handle: Handle<DemoDocsFeedback.Props>) {
	return () => {
		let { path, sent, slug } = handle.props;
		return <Frame name={FEEDBACK_FRAME} src={demoDocsFeedbackHref(slug, path, sent)} />;
	};
}
