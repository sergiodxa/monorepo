/**
 * Live preview island for `Accordion`. Each section keeps its own open state on its
 * native `<details>` element, and one `name` shared across the set makes it exclusive
 * through the platform's own behavior, so opening one closes the last with no script
 * involved. Several sections are what shows that, so the example carries a whole FAQ.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ChevronDownIcon } from "@sdxc/icons";
import { maxIs } from "@sdxc/u/size";
import { Accordion } from "@sdxc/ui";
import { clientEntry } from "remix/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Accordion mix={[maxIs("34rem")]}>
	<Accordion.Item name="billing-faq" open>
		<Accordion.Trigger>
			Can I change plans mid-cycle?
			<ChevronDownIcon data-slot="icon" aria-hidden="true" />
		</Accordion.Trigger>
		<Accordion.Content>
			<p>
				Yes. The new price is prorated to the day, so an upgrade is billed for the rest of
				the period and a downgrade lands as credit on the next invoice.
			</p>
		</Accordion.Content>
	</Accordion.Item>
	<Accordion.Item name="billing-faq">
		<Accordion.Trigger>
			What counts as a seat?
			<ChevronDownIcon data-slot="icon" aria-hidden="true" />
		</Accordion.Trigger>
		<Accordion.Content>
			<p>
				Anyone who signs in during the billing period. Invited members who never accept are
				free, and a member you remove stops counting the same day.
			</p>
		</Accordion.Content>
	</Accordion.Item>
	<Accordion.Item name="billing-faq">
		<Accordion.Trigger>
			Do you offer refunds?
			<ChevronDownIcon data-slot="icon" aria-hidden="true" />
		</Accordion.Trigger>
		<Accordion.Content>
			<p>Within thirty days of the charge, for any reason, back to the original card.</p>
		</Accordion.Content>
	</Accordion.Item>
	<Accordion.Item name="billing-faq">
		<Accordion.Trigger>
			Which payment methods work?
			<ChevronDownIcon data-slot="icon" aria-hidden="true" />
		</Accordion.Trigger>
		<Accordion.Content>
			<p>
				Every major card, plus SEPA direct debit in the EU. Annual plans over ten seats can
				pay by invoice with net-30 terms.
			</p>
		</Accordion.Content>
	</Accordion.Item>
	<Accordion.Item name="billing-faq">
		<Accordion.Trigger aria-disabled="true">
			Legacy metered pricing
			<ChevronDownIcon data-slot="icon" aria-hidden="true" />
		</Accordion.Trigger>
		<Accordion.Content>
			<p>Closed to new accounts.</p>
		</Accordion.Content>
	</Accordion.Item>
</Accordion>`;

/** A billing FAQ whose sections close each other, hydrated the way every preview here loads. */
export const AccordionPreview = clientEntry(
	"/resources/components/previews/accordion.tsx#AccordionPreview",
	function AccordionPreview() {
		return () => (
			<Accordion mix={[maxIs("34rem")]}>
				<Accordion.Item name="billing-faq" open>
					<Accordion.Trigger>
						Can I change plans mid-cycle?
						<ChevronDownIcon data-slot="icon" aria-hidden="true" />
					</Accordion.Trigger>
					<Accordion.Content>
						<p>
							Yes. The new price is prorated to the day, so an upgrade is billed for the rest of the
							period and a downgrade lands as credit on the next invoice.
						</p>
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item name="billing-faq">
					<Accordion.Trigger>
						What counts as a seat?
						<ChevronDownIcon data-slot="icon" aria-hidden="true" />
					</Accordion.Trigger>
					<Accordion.Content>
						<p>
							Anyone who signs in during the billing period. Invited members who never accept are
							free, and a member you remove stops counting the same day.
						</p>
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item name="billing-faq">
					<Accordion.Trigger>
						Do you offer refunds?
						<ChevronDownIcon data-slot="icon" aria-hidden="true" />
					</Accordion.Trigger>
					<Accordion.Content>
						<p>Within thirty days of the charge, for any reason, back to the original card.</p>
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item name="billing-faq">
					<Accordion.Trigger>
						Which payment methods work?
						<ChevronDownIcon data-slot="icon" aria-hidden="true" />
					</Accordion.Trigger>
					<Accordion.Content>
						<p>
							Every major card, plus SEPA direct debit in the EU. Annual plans over ten seats can
							pay by invoice with net-30 terms.
						</p>
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item name="billing-faq">
					<Accordion.Trigger aria-disabled="true">
						Legacy metered pricing
						<ChevronDownIcon data-slot="icon" aria-hidden="true" />
					</Accordion.Trigger>
					<Accordion.Content>
						<p>Closed to new accounts.</p>
					</Accordion.Content>
				</Accordion.Item>
			</Accordion>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <AccordionPreview /> };
