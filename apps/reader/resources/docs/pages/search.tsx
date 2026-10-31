/**
 * Searching the queue: what a search reads, the operators it understands, how far back
 * each plan reaches, and keeping a search in the sidebar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle, RemixNode } from "remix/component";

import { Steps, UiLabel } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { SearchScene } from "~/resources/components/marketing/scenes";
import { FactTable, H2, Kbd, Scene } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "search", text: "Search", level: 2 },
	{ id: "syntax", text: "Combine words", level: 2 },
	{ id: "reach", text: "How far back it reaches", level: 2 },
	{ id: "save", text: "Save a search", level: 2 },
];

/** What each way of typing a search finds, with an example a reader can copy. */
const SYNTAX: [RemixNode, string][] = [
	[<code>rust release</code>, "Posts holding every word."],
	[<code>"release notes"</code>, "Posts holding the phrase, as written."],
	[<code>rust OR go</code>, "Posts holding either word."],
	[<code>apple -iphone</code>, "Posts holding apple and not iphone."],
	[<code>apple NOT iphone</code>, "The same as the minus."],
	[<code>"OR"</code>, "The word OR itself, quoted so it is not an operator."],
];

/** The search guide's body. */
export default function Search(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<H2 id="search">Search</H2>
				<p>
					Type in <UiLabel>Search your posts</UiLabel> at the top of the sidebar, or press{" "}
					<Kbd>/</Kbd> to jump there, and press Enter. The results are your queue narrowed to the
					posts that match, newest first, and <UiLabel>Show</UiLabel> still narrows them to unread
					or read.
				</p>
				<p>
					A search reads each post's title, summary and author, which is what the feed gave. It does
					not read the article behind the link.
				</p>
				<Scene caption="A search narrows the queue to the posts that match, and says how far back it looked.">
					<SearchScene t={t} />
				</Scene>

				<H2 id="syntax">Combine words</H2>
				<FactTable
					caption="What each way of writing a search finds."
					head={["Type", "Finds"]}
					rows={SYNTAX}
				/>
				<p>
					<code>OR</code>, <code>AND</code> and <code>NOT</code> work as operators when written in
					capitals. A search takes up to {figures.queryTerms} words and {figures.queryLength}{" "}
					characters.
				</p>

				<H2 id="reach">How far back it reaches</H2>
				<p>
					On Free, a search reaches the last {figures.freeSearchDays} days. On Paid and Premium, it
					reaches everything you have kept. Under the results, Reader always says where the search
					stopped; press <UiLabel>Keep searching</UiLabel> to carry on further back.
				</p>
				<p>
					Missing a post you know is there? See{" "}
					<a href={docHref("search-missing-post")}>Search can't find a post I know is there</a>.
				</p>

				<H2 id="save">Save a search</H2>
				<Steps>
					<Steps.Item title="Run the search">
						<p>Search for what you want to come back to.</p>
					</Steps.Item>
					<Steps.Item title="Name it">
						<p>
							Press <UiLabel>Save this search</UiLabel>, type a name of up to{" "}
							{figures.searchNameLength} characters in <UiLabel>Name this search</UiLabel>, and
							save.
						</p>
					</Steps.Item>
					<Steps.Item title="Open it from the sidebar">
						<p>
							The search appears under <UiLabel>Saved searches</UiLabel> in the sidebar and runs
							again each time you open it. To remove it, open it and press{" "}
							<UiLabel>Forget this search</UiLabel>.
						</p>
					</Steps.Item>
				</Steps>
				<p>
					Free keeps {figures.freeSavedSearches} saved searches; Paid and Premium keep{" "}
					{figures.savedSearchLimit}.
				</p>
			</>
		);
	};
}
