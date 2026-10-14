/**
 * Live example for an exclusive `Accordion`. Sibling items share one `<details name>`, so
 * the browser closes the open section as another opens, and the first starts expanded
 * through `open`; the platform runs it all before any script loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ChevronDownIcon } from "@sdxc/icons";
import { Accordion } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Accordion>
	<Accordion.Item name="faq" open>
		<Accordion.Trigger>
			How do refunds work?
			<ChevronDownIcon data-slot="icon" aria-hidden="true" />
		</Accordion.Trigger>
		<Accordion.Content>
			<p>Ask within thirty days of the charge and the full amount goes back to your card.</p>
		</Accordion.Content>
	</Accordion.Item>
	<Accordion.Item name="faq">
		<Accordion.Trigger>
			When does my order ship?
			<ChevronDownIcon data-slot="icon" aria-hidden="true" />
		</Accordion.Trigger>
		<Accordion.Content>
			<p>Orders placed before 2 p.m. leave the Acme warehouse the same business day.</p>
		</Accordion.Content>
	</Accordion.Item>
</Accordion>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "One section at a time",
	code: CODE,
	render: () => (
		<Accordion>
			<Accordion.Item name="example-accordion-exclusive" open>
				<Accordion.Trigger>
					How do refunds work?
					<ChevronDownIcon data-slot="icon" aria-hidden="true" />
				</Accordion.Trigger>
				<Accordion.Content>
					<p>Ask within thirty days of the charge and the full amount goes back to your card.</p>
				</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item name="example-accordion-exclusive">
				<Accordion.Trigger>
					When does my order ship?
					<ChevronDownIcon data-slot="icon" aria-hidden="true" />
				</Accordion.Trigger>
				<Accordion.Content>
					<p>Orders placed before 2 p.m. leave the Acme warehouse the same business day.</p>
				</Accordion.Content>
			</Accordion.Item>
		</Accordion>
	),
};
