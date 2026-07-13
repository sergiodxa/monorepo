/**
 * A list of native `<details>` FAQ items, no client JS required for the disclosure
 * behavior. Every marketing page's FAQ section maps the same `{question, answer}`
 * shape over these items, so that loop is centralized here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

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

/**
 * Native `<details>` FAQ item; no client JS required for the disclosure behavior.
 * A white/near-black card with a neutral border.
 */
const marketingFaqItem = css({
	border: "1px solid oklch(0.91 0.008 145)",
	background: "#ffffff",
	borderRadius: 8,
	padding: "12px 16px",
	marginBottom: 12,
	"@media (prefers-color-scheme: dark)": {
		borderColor: "oklch(0.32 0.006 145)",
		background: "oklch(0.24 0.005 145)",
	},
});

/**
 * `<summary>` question row of a {@link marketingFaqItem}: bold, high-contrast
 * text, clickable to expand the answer.
 */
const marketingFaqQuestion = css({
	fontWeight: 600,
	cursor: "pointer",
	color: "oklch(0.24 0.005 145)",
	"@media (prefers-color-scheme: dark)": { color: "oklch(0.98 0.005 145)" },
});

/**
 * Answer paragraph inside an open {@link marketingFaqItem}: a top divider plus
 * muted text.
 */
const marketingFaqAnswer = css({
	marginTop: 8,
	paddingTop: 12,
	borderTop: "1px solid oklch(0.91 0.008 145)",
	color: "oklch(0.52 0.01 145)",
	lineHeight: 1.6,
	"@media (prefers-color-scheme: dark)": {
		borderColor: "oklch(0.32 0.006 145)",
		color: "oklch(0.73 0.01 145)",
	},
});

/** Renders one `<details>` per FAQ item. */
export default function FaqAccordion(handle: Handle<FaqAccordion.Props>) {
	return () => (
		<>
			{handle.props.items.map((faq) => (
				<details key={faq.question} mix={[marketingFaqItem]} name={handle.props.name}>
					<summary mix={[marketingFaqQuestion]}>{faq.question}</summary>
					<p mix={[marketingFaqAnswer]}>{faq.answer}</p>
				</details>
			))}
		</>
	);
}
