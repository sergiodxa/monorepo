/**
 * The questions band: what a reader asks before buying a technical book, answered in two
 * or three sentences each. The items share a name, so opening one closes the one before.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ChevronDownIcon } from "@sdxc/icons";
import { Accordion } from "@sdxc/ui";
import { FaqBand } from "@sdxc/ui/patterns";

/** Each question and its answer, in the order the band lists them. */
const QUESTIONS = [
	[
		"Is this for designers or for developers?",
		"Both. The book explains each decision in plain language first and then gives the CSS, so a designer can follow the reasoning and an engineer can ship the result. Most readers work on product teams where those are the same conversation.",
	],
	[
		"How much CSS do I need to know?",
		"Enough to change a font size and a margin. Every technique is introduced from scratch, and the newer features, such as container queries and text-wrap, get their own short primer.",
	],
	[
		"I bought the first edition. Do I get this one?",
		"Yes, for free. Sign in with the email you bought it with and the second edition is already in your library. Upgrading to the complete edition costs the difference.",
	],
	[
		"Do the videos repeat the book?",
		"No. Each lesson takes a chapter's ideas into a real interface and changes it live, so you see the before and after on screen. They work best watched after reading the chapter.",
	],
	[
		"What if it is not for me?",
		"Write within 30 days and you get a full refund, no questions asked. You keep the files, because nobody can unread a chapter.",
	],
	[
		"Can I buy copies for a class?",
		"Teachers and students get 50% off any package with a school email address. For a class of more than twenty, write and we will set up a group licence.",
	],
] as const;

/**
 * Renders the questions as one accordion under the header, at a measure an answer reads
 * comfortably in.
 *
 * @returns The render function producing the band.
 */
export default function BookFaq() {
	return () => (
		<FaqBand id="faq" eyebrow="Questions" title="Before you buy">
			<Accordion>
				{QUESTIONS.map(([question, answer]) => (
					<Accordion.Item key={question} name="book-faq">
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
