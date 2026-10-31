/**
 * The symptom page for an article that will not appear under a post: one section per
 * message the post page shows, and the excerpt and link that always remain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { UiLabel } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { FactTable, H2 } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "messages", text: "What the message means", level: 2 },
	{ id: "anyway", text: "Read it anyway", level: 2 },
];

/** The article symptom page's body. */
export default function ArticleNotLoading(_handle: Handle<DocBody.Props>) {
	return () => (
		<>
			<p>
				On Paid and Premium, a post's page fetches the article behind its link and shows it in
				place. When it can't, it says why under the heading <UiLabel>The article</UiLabel>.
			</p>

			<H2 id="messages">What the message means</H2>
			<FactTable
				caption="Messages a post's page shows instead of the article."
				head={["Message", "What it means"]}
				rows={[
					[
						"Reading articles in place is part of the paid plan.",
						"You are on Free. Move to Paid or Premium to read articles inside Reader.",
					],
					["Fetching the article…", "It is still on its way. Give it a moment."],
					[
						"This site does not allow reading here.",
						"The publisher's site refused the request, or its robots.txt asks apps like Reader not to fetch it. Reader respects that.",
					],
					[
						"This page took too long to read.",
						"The site was too slow, or the page too large. Open the post again later.",
					],
					[
						"There is nothing to read here.",
						"The page arrived but held nothing beyond the excerpt you already have.",
					],
				]}
			/>

			<H2 id="anyway">Read it anyway</H2>
			<p>
				Whatever the message, the feed's title, excerpt and link stay on the page. Press{" "}
				<UiLabel>Open the original</UiLabel> to read the piece on the publisher's site.
			</p>
		</>
	);
}
