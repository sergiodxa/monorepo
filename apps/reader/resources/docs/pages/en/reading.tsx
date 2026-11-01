/**
 * Working through the queue: narrowing it by read state, marking posts and whole feeds
 * read, opening a post in place, and what arrives while the page is open.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { Callout, UiLabel, UiPath } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { ArticleView, ReaderWindow } from "~/resources/components/marketing/reader-window";
import { Faq, H2, Kbd, Scene } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "queue", text: "What the queue holds", level: 2 },
	{ id: "narrow", text: "Show all, unread or read", level: 2 },
	{ id: "mark", text: "Mark posts read", level: 2 },
	{ id: "open", text: "Open a post", level: 2 },
	{ id: "new", text: "When new posts arrive", level: 2 },
	{ id: "questions", text: "Questions", level: 2 },
];

/** The queue guide's body. */
export default function Reading(handle: Handle<DocBody.Props>) {
	return () => {
		let { t } = handle.props;
		return (
			<>
				<H2 id="queue">What the queue holds</H2>
				<p>
					<UiPath items={["Reading"]} /> is one list of every post from every feed you follow,
					newest first, and it keeps going as you scroll. Each feed's own page, under{" "}
					<UiLabel>Feeds</UiLabel> in the sidebar, is the same list narrowed to that feed.
				</p>

				<H2 id="narrow">Show all, unread or read</H2>
				<p>
					Beside the heading, <UiLabel>Show</UiLabel> picks <UiLabel>All</UiLabel>,{" "}
					<UiLabel>Unread</UiLabel> or <UiLabel>Read</UiLabel>. The choice is part of the page's
					address, so a bookmark keeps it, and it works together with a search.
				</p>

				<H2 id="mark">Mark posts read</H2>
				<ul>
					<li>
						<strong>One post</strong>: press the mark at the start of its row, or press <Kbd>m</Kbd>
						. On a phone, swipe the row sideways. Press it again to mark it unread.
					</li>
					<li>
						<strong>One feed</strong>: on the feed's page, press <UiLabel>Mark feed read</UiLabel>.
					</li>
					<li>
						<strong>Everything</strong>: on Reading, press <UiLabel>Mark all read</UiLabel> and
						confirm.
					</li>
				</ul>
				<Callout kind="warning" label="Warning">
					<p>
						Mark all read has no undo. Reader keeps no record of which posts were unread before.
					</p>
				</Callout>

				<H2 id="open">Open a post</H2>
				<p>
					Press a post's title to open it on the publisher's site; that marks it read. Press{" "}
					<UiLabel>Read here</UiLabel> to open it inside Reader instead, with the feed's title,
					author, date and excerpt, and a link to <UiLabel>Open the original</UiLabel>. A podcast or
					video attached to a post plays right there, in your browser's own player.
				</p>
				<p>
					On Paid and Premium, the post's page also fetches the whole article behind the link and
					shows it in place, naming the publisher.
				</p>
				<Scene caption="A post opened in Reader, with the article fetched from the publisher underneath.">
					<ReaderWindow
						t={t}
						title={t("nav.reading")}
						path="/reading/the-verge/post"
						label="A post opened inside Reader with its full article"
					>
						<ArticleView t={t} />
					</ReaderWindow>
				</Scene>
				<p>
					If the article does not appear, see{" "}
					<a href={docHref("article-not-loading")}>The article won't load in Reader</a>.
				</p>

				<H2 id="new">When new posts arrive</H2>
				<p>
					When you open Reader it already knows which feeds have something new. It says how many
					feeds have posts on the way and brings them in behind the page. To look right now, press{" "}
					<UiLabel>Check all</UiLabel> on Reading, or <Kbd>r</Kbd>.
				</p>

				<H2 id="questions">Questions</H2>
				<Faq
					items={[
						{
							question: "Why did older posts leave my queue?",
							answer: (
								<p>
									Each feed keeps its posts for a span you choose, from three hours to forever. Read
									or not, older posts leave; saved posts always stay. See{" "}
									<a href={docHref("feeds")}>Follow and manage feeds</a>.
								</p>
							),
						},
						{
							question: "Where did a post go that the feed stopped listing?",
							answer: (
								<p>
									When a feed says it lists everything it has, a post it drops leaves your list too,
									unless you saved it.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}
