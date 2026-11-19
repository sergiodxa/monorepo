/**
 * Live preview for `PaymentCard`: a physical debit card in the brand's colour beside a
 * frozen virtual card in ink, every number on them a masked placeholder.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { PaymentCard } from "@sdxc/ui/finance/payment-card";

/** The source the page shows, matching the markup below. */
const CODE = `<PaymentCard label="Everyday card ending 4821" brand="Tuppence" last4="4821"
	holder="Noor Halvorsen" expires="09/29" network="debit" />
<PaymentCard label="Online card ending 0937" brand="Tuppence" last4="0937"
	holder="Noor Halvorsen" expires="03/27" network="debit" kind="virtual" tone="ink" frozen />`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={raw({
				display: "grid",
				gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))",
				gap: "1.25rem",
				inlineSize: "100%",
				maxInlineSize: "40rem",
				marginBlock: "1.5rem",
			})}
		>
			<PaymentCard
				label="Everyday card ending 4821"
				brand="Tuppence"
				last4="4821"
				holder="Noor Halvorsen"
				expires="09/29"
				network="debit"
			/>
			<PaymentCard
				label="Online card ending 0937"
				brand="Tuppence"
				last4="0937"
				holder="Noor Halvorsen"
				expires="03/27"
				network="debit"
				kind="virtual"
				tone="ink"
				frozen
			/>
		</div>
	),
};
