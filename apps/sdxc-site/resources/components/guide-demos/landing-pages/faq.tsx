/**
 * The questions band from the landing-page guide: one accordion whose items share a name,
 * so opening one question closes the one before.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ChevronDownIcon } from "@sdxc/icons";
import { Accordion, HeadingScope } from "@sdxc/ui";
import { FaqBand } from "@sdxc/ui/patterns";

/** Each question and its answer, in the order the band lists them. */
const QUESTIONS = [
	[
		"How often do checks run?",
		"Every thirty seconds on paid plans and every three minutes on the free one. Each check runs from every region you pick, so one slow network never decides the result on its own.",
	],
	[
		"Can I use my own domain?",
		"Yes. Point a CNAME at your status page and the certificate is issued for you within a few minutes. Subscribers keep their emails when you switch domains.",
	],
	[
		"Is there a free plan?",
		"Five monitors and one status page, free for as long as you need them. No card is required, and upgrading keeps every check's history.",
	],
] as const;

/** What the guide demo registry reads: the band, drawn at a page's width. */
export default {
	viewports: true,
	render: () => (
		<HeadingScope>
			<FaqBand eyebrow="FAQ" title="Questions, answered">
				<Accordion>
					{QUESTIONS.map(([question, answer]) => (
						<Accordion.Item key={question} name="guide-faq">
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
		</HeadingScope>
	),
};
