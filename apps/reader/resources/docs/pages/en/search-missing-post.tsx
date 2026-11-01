/**
 * The symptom page for a search that misses: the plan's search window, the fields a
 * search reads, the read-state filter, and how operators change what matches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { UiLabel } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { H2 } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "window", text: "The post is older than your search reaches", level: 2 },
	{ id: "fields", text: "The words are in the article, not the post", level: 2 },
	{ id: "show", text: "Show is set to Unread or Read", level: 2 },
	{ id: "words", text: "A word is acting as an operator", level: 2 },
	{ id: "gone", text: "The post has left your queue", level: 2 },
];

/** The missed-search symptom page's body. */
export default function SearchMissingPost(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures } = handle.props;
		return (
			<>
				<p>Read the line under the results first: it says how far back the search looked.</p>

				<H2 id="window">The post is older than your search reaches</H2>
				<p>
					If it says Free searches the last {figures.freeSearchDays} days, the post is older than
					that. Paid and Premium search everything you have kept. If it says the search stopped at a
					date, press <UiLabel>Keep searching</UiLabel> to carry on further back.
				</p>

				<H2 id="fields">The words are in the article, not the post</H2>
				<p>
					Search reads each post's title, summary and author, as the feed gave them. Words that are
					only in the article behind the link are not found. Search for a word from the title
					instead.
				</p>

				<H2 id="show">Show is set to Unread or Read</H2>
				<p>
					A search keeps the <UiLabel>Show</UiLabel> setting. Set it to <UiLabel>All</UiLabel> to
					search every post.
				</p>

				<H2 id="words">A word is acting as an operator</H2>
				<p>
					<code>OR</code>, <code>AND</code> and <code>NOT</code> in capitals, and a word starting
					with <code>-</code>, change what a search means. Quote them to search for them as words:{" "}
					<code>"OR"</code>.
				</p>

				<H2 id="gone">The post has left your queue</H2>
				<p>
					A post that aged out under its feed's span, or that you unfollowed with its feed, is no
					longer kept, so search cannot find it. Saved posts always stay; see{" "}
					<a href={docHref("saving")}>Save posts</a>.
				</p>
			</>
		);
	};
}
