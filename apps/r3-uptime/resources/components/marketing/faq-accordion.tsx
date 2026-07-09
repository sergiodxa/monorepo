/**
 * A list of native `<details>` FAQ items, no client JS required for the disclosure
 * behavior. Every marketing page's FAQ section maps the same `{question, answer}`
 * shape over {@link s.marketingFaqItem}, so that loop is centralized here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import * as s from "~/resources/styles";

namespace FaqAccordion {
	export interface Item {
		question: string;
		answer: string;
	}

	export interface Props {
		items: Item[];
	}
}

/** Renders one `<details>` per FAQ item. */
export default function FaqAccordion(handle: Handle<FaqAccordion.Props>) {
	return () => (
		<>
			{handle.props.items.map((faq) => (
				<details key={faq.question} mix={[s.marketingFaqItem]}>
					<summary mix={[s.marketingFaqQuestion]}>{faq.question}</summary>
					<p mix={[s.marketingFaqAnswer]}>{faq.answer}</p>
				</details>
			))}
		</>
	);
}
