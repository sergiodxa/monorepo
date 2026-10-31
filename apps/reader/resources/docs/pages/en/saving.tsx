/**
 * Keeping a post: the one action no expiry, unfollow or feed change reaches, where kept
 * posts are listed, what a save holds, and the plan's cap on how many.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { Callout, UiLabel, UiPath } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { Faq, H2, Kbd } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "save", text: "Save a post", level: 2 },
	{ id: "find", text: "Find what you saved", level: 2 },
	{ id: "keeps", text: "What a save keeps", level: 2 },
	{ id: "limit", text: "How many you can save", level: 2 },
	{ id: "questions", text: "Questions", level: 2 },
];

/** The saving guide's body. */
export default function Saving(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures } = handle.props;
		return (
			<>
				<H2 id="save">Save a post</H2>
				<p>
					Press <UiLabel>Save</UiLabel> on any post, in any list, or press <Kbd>s</Kbd> on the post
					you are on. Press <UiLabel>Remove from saved</UiLabel> to stop keeping it.
				</p>

				<H2 id="find">Find what you saved</H2>
				<p>
					Open <UiPath items={["Saved"]} /> in the sidebar. It lists every post you kept, and it is
					the one list nothing prunes. On Paid and Premium you can also{" "}
					<a href={docHref("labels")}>label saved posts</a> and read one label at a time.
				</p>

				<H2 id="keeps">What a save keeps</H2>
				<p>
					A saved post stays when its feed's span runs out, when you unfollow the feed, and when the
					feed stops listing it.
				</p>
				<Callout kind="note" label="Note">
					<p>
						Saving keeps the title, the excerpt and the link. When the site goes, the link goes.
					</p>
				</Callout>

				<H2 id="limit">How many you can save</H2>
				<p>
					Free keeps {figures.freeSaved} saved posts; Paid and Premium keep more (see{" "}
					<a href={docHref("plans")}>Plans and limits</a>). When Saved is full, a new save says so:
					remove one from Saved to make room, or move up a plan.
				</p>

				<H2 id="questions">Questions</H2>
				<Faq
					items={[
						{
							question: "Can I take my saved posts with me?",
							answer: (
								<p>
									Yes. <a href={docHref("export")}>Export your data</a> includes every saved post's
									title, link, excerpt and labels.
								</p>
							),
						},
						{
							question: "Does a saved post count against the posts my plan keeps?",
							answer: (
								<p>
									It counts, and it is never the post Reader removes to make room. When you reach
									your plan's posts, Reader takes back posts you have read and not saved, oldest
									first. See <a href={docHref("over-plan-limits")}>I'm over my plan's limits</a>.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}
