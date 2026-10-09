/**
 * Live example for a `Disclosure` that starts expanded. `open` is the native `<details>`
 * attribute, so the answer is visible on first paint and the reader collapses it with
 * no script at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ChevronDownIcon } from "@sdxc/icons";
import { m } from "@sdxc/u/size";
import { Disclosure } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Disclosure open>
	<Disclosure.Trigger>
		How long does shipping take?
		<ChevronDownIcon data-slot="icon" aria-hidden="true" />
	</Disclosure.Trigger>
	<Disclosure.Panel>
		<p mix={[m(0)]}>Orders leave the Acme warehouse within two business days and arrive in three to five.</p>
	</Disclosure.Panel>
</Disclosure>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Open by default",
	code: CODE,
	render: () => (
		<Disclosure open>
			<Disclosure.Trigger>
				How long does shipping take?
				<ChevronDownIcon data-slot="icon" aria-hidden="true" />
			</Disclosure.Trigger>
			<Disclosure.Panel>
				<p mix={[m(0)]}>
					Orders leave the Acme warehouse within two business days and arrive in three to five.
				</p>
			</Disclosure.Panel>
		</Disclosure>
	),
};
