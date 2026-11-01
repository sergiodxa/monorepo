/**
 * Labelling kept posts: putting a label on, reading one label as a list, renaming and
 * deleting labels, and the caps on how many. Labelling a post also saves it.
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

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "add", text: "Put a label on a post", level: 2 },
	{ id: "read", text: "Read one label", level: 2 },
	{ id: "manage", text: "Rename or delete a label", level: 2 },
	{ id: "questions", text: "Questions", level: 2 },
];

/** The labels guide's body. */
export default function Labels(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<p>
					A label says why you kept a post: "to read this weekend", "for the essay", "recipes".
					Labels live on saved posts, and a post can carry up to {figures.tagsPerPost}.
				</p>

				<H2 id="add">Put a label on a post</H2>
				<Steps>
					<Steps.Item title="Open Saved">
						<p>
							Open <UiPath items={["Saved"]} />. Every saved post has a strip of labels under its
							title.
						</p>
					</Steps.Item>
					<Steps.Item title="Add a label">
						<p>
							Type in the <UiLabel>Label…</UiLabel> field and press Enter. Pick a label you already
							have from the suggestions, or type a new name of up to {figures.tagNameLength}{" "}
							characters to make one.
						</p>
					</Steps.Item>
				</Steps>
				<p>
					To take a label off, press the <UiLabel>×</UiLabel> on its chip. The post stays saved.
				</p>
				<Scene caption="Feeds filed into folders, and kept posts carrying their labels.">
					<OrganizeScene t={t} />
				</Scene>

				<H2 id="read">Read one label</H2>
				<p>
					Press a label on any post to open everything saved under it as one list. The page has its
					own address, so you can bookmark it.
				</p>

				<H2 id="manage">Rename or delete a label</H2>
				<p>
					On a label's page, press <UiLabel>Rename</UiLabel> to change its name everywhere, or{" "}
					<UiLabel>Delete label</UiLabel> and confirm. Deleting a label takes it off every post, and
					every post stays saved.
				</p>

				<H2 id="questions">Questions</H2>
				<Faq
					items={[
						{
							question: "How many labels can I have?",
							answer: (
								<p>
									Up to {figures.tagLimit} labels, and up to {figures.tagsPerPost} on one post.
								</p>
							),
						},
						{
							question: "What happens to my labels if I move to Free?",
							answer: (
								<p>
									They are hidden, and none is deleted. Everything you kept stays saved, and your
									labels come back when you return to Paid or Premium.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}
