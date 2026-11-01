/**
 * Moving to Reader from another feed reader: exporting OPML there, importing it here, and
 * reading the counts the import reports back, including the feeds a plan's cap left out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { Callout, Steps, UiLabel, UiPath } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { DataScene } from "~/resources/components/marketing/scenes";
import { Faq, H2, Scene } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "export", text: "Export from your old reader", level: 2 },
	{ id: "import", text: "Import the file", level: 2 },
	{ id: "results", text: "Read what the import says", level: 2 },
	{ id: "questions", text: "Questions", level: 2 },
];

/** The import guide's body. */
export default function ImportOpml(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<p>
					OPML is the file every feed reader uses to carry a subscription list. Reader follows every
					feed in one, and keeps the folders it describes.
				</p>

				<H2 id="export">Export from your old reader</H2>
				<p>
					Look in your old reader's settings for <strong>Export</strong>,{" "}
					<strong>Download OPML</strong> or <strong>Subscriptions</strong>. You get a small file
					ending in <code>.opml</code> or <code>.xml</code>. Feedly, Inoreader, Feedbin and NewsBlur
					all offer one.
				</p>

				<H2 id="import">Import the file</H2>
				<Steps>
					<Steps.Item title="Open Settings">
						<p>
							Open the menu with your name at the foot of the sidebar and choose{" "}
							<UiLabel>Settings</UiLabel>.
						</p>
					</Steps.Item>
					<Steps.Item title="Choose the file">
						<p>
							Under <UiLabel>Carrying your subscriptions</UiLabel>, pick your file in{" "}
							<UiLabel>OPML file</UiLabel>.
						</p>
					</Steps.Item>
					<Steps.Item title="Import">
						<p>
							Press <UiLabel>Import</UiLabel>. Reader follows each feed in the file and files it
							into the folder the file names. Posts start arriving in <UiPath items={["Reading"]} />{" "}
							within a minute.
						</p>
					</Steps.Item>
				</Steps>
				<Scene caption="Subscriptions travel in and out of Reader as OPML, folders and all.">
					<DataScene t={t} />
				</Scene>

				<H2 id="results">Read what the import says</H2>
				<p>Settings reports what happened to every feed in the file:</p>
				<ul>
					<li>
						<strong>Followed</strong>: new feeds now in your queue.
					</li>
					<li>
						<strong>Already followed</strong>: feeds you had, left as they were.
					</li>
					<li>
						<strong>Could not be retrieved</strong>: the address did not answer with a feed. See{" "}
						<a href={docHref("no-feed-found")}>Reader says a site has no feed</a>.
					</li>
					<li>
						<strong>Left out</strong>: feeds past your plan's limit. Free follows{" "}
						{figures.freeFeeds} feeds, Paid {figures.paidFeeds} and Premium {figures.premiumFeeds}.
					</li>
				</ul>
				<Callout kind="note" label="Note">
					<p>
						Folders are part of Paid. On Free, every feed in the file is still followed, unfiled,
						and no folder is made. A feed you already follow keeps the folder you put it in, so
						after upgrading you file feeds from each feed's page.
					</p>
				</Callout>

				<H2 id="questions">Questions</H2>
				<Faq
					items={[
						{
							question: "Can I import the same file twice?",
							answer: (
								<p>Yes. Feeds you already follow are counted as already followed and left alone.</p>
							),
						},
						{
							question: "Is there a size limit?",
							answer: (
								<p>
									Reader reads files up to one megabyte. A subscription list is a few hundred
									kilobytes at most.
								</p>
							),
						},
						{
							question: "Does it bring my read and saved posts?",
							answer: (
								<p>
									No. OPML carries only the list of feeds. Each feed's recent posts arrive fresh,
									unread.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}
