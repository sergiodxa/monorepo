/**
 * The questions a developer asks before adding a validation library: why compile, what a
 * strict CSP does to it, its size, compatibility, the v3 migration and who keeps it alive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ChevronDownIcon } from "@sdxc/icons";
import { Accordion } from "@sdxc/ui";
import { FaqBand } from "@sdxc/ui/landing";

/** Each question and its two-to-three-sentence answer, split across the two columns. */
const QUESTIONS = [
	[
		[
			"Why compile instead of interpreting the schema?",
			"An interpreter walks a tree of rules on every parse and allocates as it goes. A compiled schema is one function the engine inlines and optimises like your own code, which is where the 6.5× over plumb 3 comes from.",
		],
		[
			"Does it work under a strict Content Security Policy?",
			"Compiling at runtime uses new Function, which a policy without unsafe-eval blocks, and so do Cloudflare Workers. Run plumb build at build time and import the module it writes; the schemas behave the same and nothing is evaluated.",
		],
		[
			"How much does it add to a bundle?",
			"The runtime is 2.9 kB min+gzip with no dependencies. Each compiled schema adds roughly the size of the checks it runs, about 300 bytes for the User schema on this page.",
		],
	],
	[
		[
			"Can I use it with libraries that accept Standard Schema?",
			"Yes. Every plumb schema implements Standard Schema v1, so form libraries, routers and RPC tools that accept one take a plumb schema as it is.",
		],
		[
			"How do I move from plumb 3?",
			"Run bunx plumb migrate in the project. It rewrites the two renamed methods and lists anything it could not change; most codebases need no manual edits.",
		],
		[
			"Who maintains plumb, and how do I report a vulnerability?",
			"Two maintainers paid by sponsors review every change, with 214 contributors behind them. Report a vulnerability through the repository's private security advisories; we answer within two working days.",
		],
	],
] as const;

/**
 * Renders the questions in two columns, one open at a time across both.
 *
 * @returns The render function producing the band.
 */
export function FaqSection() {
	return () => (
		<FaqBand
			id="faq"
			ruled
			columns={2}
			eyebrow="FAQ.md"
			title="Before you npm install"
			description="What developers ask before they put plumb between a request and their database."
		>
			{QUESTIONS.map((column, index) => (
				<Accordion key={index}>
					{column.map(([question, answer]) => (
						<Accordion.Item key={question} name="plumb-faq">
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
