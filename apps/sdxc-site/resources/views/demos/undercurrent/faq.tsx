/**
 * The questions band: what someone asks before giving an address to a newsletter that is
 * also a podcast, answered in two or three sentences. The items share a name, so opening
 * one closes the one before.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ChevronDownIcon } from "@sdxc/icons";
import { Accordion } from "@sdxc/ui";
import { FaqBand } from "@sdxc/ui/landing";

/** Each question and its answer, in the order the band lists them. */
const QUESTIONS = [
	[
		"Do I need to listen as well as read?",
		"No. The letter stands on its own, and the episode is the same story with the voices in it. Plenty of readers never press play, and some listeners never open the email.",
	],
	[
		"Where do the episodes play?",
		"In any podcast app, from the public feed, and in the browser on this page. Every episode comes with chapters and a full transcript.",
	],
	[
		"How often will you email me?",
		"Every other Thursday at 7 a.m., and nothing in between. Members also get one recording a month in their private feed.",
	],
	[
		"Can I suggest a subject?",
		"Reply to any letter. About half of them start from a reader’s question, and the mailbag at the end of each episode answers more.",
	],
] as const;

/**
 * Renders the questions as one accordion under the header.
 *
 * @returns The render function producing the band.
 */
export default function NewsletterFaq() {
	return () => (
		<FaqBand id="questions" eyebrow="Questions" title="Before you subscribe">
			<Accordion>
				{QUESTIONS.map(([question, answer]) => (
					<Accordion.Item key={question} name="undercurrent-faq">
						<Accordion.Trigger>
							{question}
							<ChevronDownIcon data-slot="icon" aria-hidden="true" />
						</Accordion.Trigger>
						<Accordion.Content>
							<p>{answer}</p>
						</Accordion.Content>
					</Accordion.Item>
				))}
			</Accordion>
		</FaqBand>
	);
}
