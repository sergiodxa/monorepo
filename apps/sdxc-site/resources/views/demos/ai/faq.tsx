/**
 * The questions band: what a team asks before letting an AI listen to its calls, answered
 * in two or three sentences each. The items share a name, so opening one closes the last.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ChevronDownIcon } from "@sdxc/icons";
import { Accordion } from "@sdxc/ui";
import { FaqBand } from "@sdxc/ui/landing";

import { FREE_HOURS } from "~/resources/views/demos/ai/estimate";
import { renderNearView } from "~/resources/views/demos/near-view";

/** Each question and its answer, in the order the band lists them. */
const QUESTIONS = [
	[
		"Does everyone on the call know Margin is listening?",
		"Yes. When Margin joins a call it appears as a participant named “Margin (recording)”, and it posts a one-line notice in the call chat. Anyone can ask it to leave, and it does.",
	],
	[
		"Which languages does it understand?",
		"English, Spanish, Portuguese, French, German, Italian, Dutch, Japanese and Korean. A call that switches language mid-sentence is transcribed, but its notes are flagged for a closer read.",
	],
	[
		"Can I edit the notes before they go out?",
		"Every draft waits for one person to approve it. Edits keep their timestamps, and a line you add by hand is marked as yours rather than Margin’s.",
	],
	[
		"What happens to a timestamp when the transcript is deleted?",
		"The notes stay, and their timestamps stop linking. If you chose to delete transcripts once notes are written, each citation shows the time and speaker only.",
	],
	[
		"How is this different from a transcript with a summary on top?",
		"A summary asks you to trust it. Margin writes nothing it cannot point to, and it leaves an owner or a date blank when nobody said one.",
	],
	[
		"What does a trial cost?",
		`Nothing. The first ${FREE_HOURS} recorded hours every month are free on every workspace, and you add a card only when you go past them.`,
	],
] as const;

/**
 * Renders the questions as two accordions of three, side by side from a wide container,
 * sharing one item name so a single answer is open on the page at a time.
 *
 * @returns The render function producing the band.
 */
export default function MarginFaq() {
	return () => (
		<FaqBand
			id="faq"
			eyebrow="Questions"
			title="Before you invite it to a call"
			columns={2}
			mix={[renderNearView(560, 900)]}
		>
			{[QUESTIONS.slice(0, 3), QUESTIONS.slice(3)].map((column) => (
				<Accordion>
					{column.map(([question, answer]) => (
						<Accordion.Item key={question} name="margin-faq">
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
			))}
		</FaqBand>
	);
}
