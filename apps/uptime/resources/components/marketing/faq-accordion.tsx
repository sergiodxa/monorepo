/**
 * A list of native `<details>` FAQ items, no client JS required for the disclosure
 * behavior. Every marketing page's FAQ section maps the same `{question, answer}`
 * shape over these items, so that loop is centralized here. Composes `@pkg/ui`'s
 * `Accordion` — itself built entirely on `Disclosure`/native `<details>` — so this
 * stays exactly as zero-JS as the hand-rolled version it replaces.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ChevronDownIcon } from "@pkg/lucide-remix";
import { Accordion } from "@pkg/ui";

namespace FaqAccordion {
	export interface Item {
		question: string;
		answer: string;
	}

	export interface Props {
		name?: string;
		items: Item[];
	}
}

/** Renders one `<details>` (via `Accordion.Item`) per FAQ item. */
export default function FaqAccordion(handle: Handle<FaqAccordion.Props>) {
	return () => (
		<Accordion>
			{handle.props.items.map((faq) => (
				<Accordion.Item key={faq.question} name={handle.props.name}>
					<Accordion.Trigger>
						{faq.question}
						<ChevronDownIcon size={16} strokeWidth={1.5} data-slot="icon" />
					</Accordion.Trigger>
					<Accordion.Content>
						<p>{faq.answer}</p>
					</Accordion.Content>
				</Accordion.Item>
			))}
		</Accordion>
	);
}
