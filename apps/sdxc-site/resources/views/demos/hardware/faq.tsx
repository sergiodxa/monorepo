/**
 * The questions a buyer asks before putting down a deposit on hardware that has not
 * shipped: where it ships, how the refund works, the ISO layouts, and repairs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ChevronDownIcon } from "@sdxc/icons";
import { Accordion } from "@sdxc/ui";
import { FaqBand } from "@sdxc/ui/landing";

import { PREORDER } from "~/resources/views/demos/hardware/preorder-data";

/** Each question and its answer, in the order the band lists them. */
const QUESTIONS = [
	[
		"Where do you ship?",
		"To the EU, the UK, the US, Canada, Australia and Japan, with duties paid at checkout so nothing is due at the door. Boards leave the shop in batch order, oldest reservation first.",
	],
	[
		"What happens to my deposit?",
		`The ${PREORDER.deposit} deposit holds your place in the batch. Cancel any time before your board ships and it comes back in full within five days; once it ships, the usual 30-day return applies.`,
	],
	[
		"Which ISO layouts are there?",
		"UK, German, French, Spanish and Nordic legends, each moulded rather than printed. Pick ISO in the form and we email you for the legend set before the batch is moulded.",
	],
	[
		"Can I repair it myself?",
		"Yes. Six hex screws on the floor open the case, every part is sold on its own, and the firmware is open source QMK, so a board outlives its warranty.",
	],
] as const;

/**
 * Renders the questions as one accordion under the header.
 *
 * @returns The render function producing the band.
 */
export default function Faq() {
	return () => (
		<FaqBand id="faq" eyebrow="Questions" title="Before you reserve">
			<Accordion>
				{QUESTIONS.map(([question, answer]) => (
					<Accordion.Item key={question} name="strata-faq">
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
