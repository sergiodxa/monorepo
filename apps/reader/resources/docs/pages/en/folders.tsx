/**
 * Folders: filing a feed, making a folder from that same menu, reading a folder as one
 * stream, renaming and deleting one, and what a plan change does to them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { Steps, UiLabel, UiPath } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { OrganizeScene } from "~/resources/components/marketing/scenes";
import { Faq, H2, Scene } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "file", text: "File a feed into a folder", level: 2 },
	{ id: "read", text: "Read a folder", level: 2 },
	{ id: "manage", text: "Rename or delete a folder", level: 2 },
	{ id: "questions", text: "Questions", level: 2 },
];

/** The folders guide's body. */
export default function Folders(handle: Handle<DocBody.Props>) {
	return () => {
		let { t } = handle.props;
		return (
			<>
				<H2 id="file">File a feed into a folder</H2>
				<Steps>
					<Steps.Item title="Open the feed">
						<p>
							Pick the feed under <UiLabel>Feeds</UiLabel> in the sidebar.
						</p>
					</Steps.Item>
					<Steps.Item title="Choose its folder">
						<p>
							Open <UiPath items={["More actions", "Which folder this feed reads in"]} />. Pick a
							folder you have, or type a name in <UiLabel>Name this folder…</UiLabel> to make a new
							one.
						</p>
					</Steps.Item>
					<Steps.Item title="File it">
						<p>
							Press <UiLabel>File</UiLabel>. The feed now sits under that folder in the sidebar. To
							take it out, choose <UiLabel>Take out of this folder</UiLabel> in the same menu.
						</p>
					</Steps.Item>
				</Steps>
				<Scene caption="Feeds grouped under folders in the sidebar, each with its unread count.">
					<OrganizeScene t={t} />
				</Scene>

				<H2 id="read">Read a folder</H2>
				<p>
					Press a folder's name in the sidebar. Its page is every post from every feed filed there,
					newest first, read like the main queue. It shows how many posts are waiting across the
					folder.
				</p>

				<H2 id="manage">Rename or delete a folder</H2>
				<p>
					On the folder's page, press <UiLabel>Rename</UiLabel>, or <UiLabel>Delete folder</UiLabel>{" "}
					and confirm. Deleting a folder puts its feeds back among the unfiled ones, and every post
					stays.
				</p>

				<H2 id="questions">Questions</H2>
				<Faq
					items={[
						{
							question: "Do folders come with OPML?",
							answer: (
								<p>
									Yes. <a href={docHref("import-opml")}>Importing</a> files feeds into the folders
									the file names, and <a href={docHref("export")}>exporting</a> writes yours out.
								</p>
							),
						},
						{
							question: "What happens to my folders if I move to Free?",
							answer: (
								<p>
									The folders you have stay where they are. Making new folders and filing feeds
									needs Paid or Premium.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}
