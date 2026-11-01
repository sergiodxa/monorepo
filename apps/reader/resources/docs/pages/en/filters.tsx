/**
 * Filters: writing one as a sentence about part of a post, previewing what it would have
 * caught, applying it to those posts, and the plan caps. Filters act on arrivals only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { Callout, Steps, UiLabel, UiPath } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { FiltersScene } from "~/resources/components/marketing/scenes";
import { FactTable, Faq, H2, Scene } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "add", text: "Add a filter", level: 2 },
	{ id: "actions", text: "What a filter can do", level: 2 },
	{ id: "preview", text: "Preview before you add", level: 2 },
	{ id: "manage", text: "Change or delete a filter", level: 2 },
	{ id: "questions", text: "Questions", level: 2 },
];

/** The filters guide's body. */
export default function Filters(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<p>
					A filter reads one part of each arriving post, looks for a piece of text, and decides what
					happens to the post. It reads like a sentence: when the title of a post contains
					"Sponsored", drop it.
				</p>
				<Scene caption="Three filters, each a sentence, with how many posts each one has decided.">
					<FiltersScene t={t} />
				</Scene>

				<H2 id="add">Add a filter</H2>
				<Steps>
					<Steps.Item title="Open Filters">
						<p>
							Open <UiPath items={["Settings", "Filters"]} />.
						</p>
					</Steps.Item>
					<Steps.Item title="Write the sentence">
						<p>
							Under <UiLabel>Add a filter</UiLabel>, choose the <UiLabel>Part of the post</UiLabel>{" "}
							(title, link, summary or author), the <UiLabel>Text to look for</UiLabel> (up to 100
							characters), and <UiLabel>What happens to it</UiLabel>.
						</p>
					</Steps.Item>
					<Steps.Item title="Choose where it applies">
						<p>
							In <UiLabel>Where it applies</UiLabel>, keep <UiLabel>Every feed you follow</UiLabel>{" "}
							or pick one feed.
						</p>
					</Steps.Item>
					<Steps.Item title="Add it">
						<p>
							Press <UiLabel>Add filter</UiLabel>. It acts on what arrives from now on.
						</p>
					</Steps.Item>
				</Steps>

				<H2 id="actions">What a filter can do</H2>
				<FactTable
					caption="The three things a filter does to a post it matches."
					head={["Action", "What happens to the post"]}
					rows={[
						["Drop", "It never reaches your queue."],
						["Mark it read", "It arrives already read, so Unread skips it."],
						["Flag", "It arrives marked Flagged, so it stands out in the list."],
					]}
				/>
				<Callout kind="note" label="Note">
					<p>
						A filter on the summary reads its first {figures.summaryChars} characters, which is the
						line under the title, not the article.
					</p>
				</Callout>

				<H2 id="preview">Preview before you add</H2>
				<p>
					Press <UiLabel>Preview</UiLabel> while writing a filter to see which of your newest posts
					it would have caught. If those are the posts you meant, press{" "}
					<UiLabel>Apply to the … posts above</UiLabel> to act on them now as well. If it matches
					every post, check the part of the post and the spelling before adding it.
				</p>

				<H2 id="manage">Change or delete a filter</H2>
				<p>
					Every filter is listed on the Filters page with how many posts it has decided and when it
					last matched. Change it and press <UiLabel>Save changes</UiLabel>, or press{" "}
					<UiLabel>Delete filter</UiLabel>. Deleting a filter removes no post.
				</p>

				<H2 id="questions">Questions</H2>
				<Faq
					items={[
						{
							question: "How many filters can I have?",
							answer: (
								<p>
									{figures.paidRules} on Paid and {figures.premiumRules} on Premium. Free has no
									filters.
								</p>
							),
						},
						{
							question: "Does a filter change posts I already have?",
							answer: (
								<p>
									No. Filters act on what arrives from now on. The preview can apply one to recent
									posts if you ask it to.
								</p>
							),
						},
						{
							question: "What happens to my filters if I move to Free?",
							answer: (
								<p>
									They stay where they are and stop running. Nothing you follow or have read
									changes.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}
