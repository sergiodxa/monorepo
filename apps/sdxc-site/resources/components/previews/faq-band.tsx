/**
 * Live preview for `FaqBand`: a chapter header over two accordion columns, which stack
 * into one list when the band is narrow. A band is a page-width surface, so it meets the
 * frame's edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ChevronDownIcon } from "@sdxc/icons";
import { Accordion, HeadingScope } from "@sdxc/ui";
import { FaqBand } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<FaqBand title="Questions" columns={2}>
	<Accordion>
		<Accordion.Item name="faq">
			<Accordion.Trigger>
				How often do checks run?
				<ChevronDownIcon data-slot="icon" aria-hidden="true" />
			</Accordion.Trigger>
			<Accordion.Content>
				<p>Every thirty seconds on paid plans, every five minutes on the free one.</p>
			</Accordion.Content>
		</Accordion.Item>
		<Accordion.Item name="faq">
			<Accordion.Trigger>
				Where do probes run from?
				<ChevronDownIcon data-slot="icon" aria-hidden="true" />
			</Accordion.Trigger>
			<Accordion.Content>
				<p>Six regions across North America, Europe and Asia.</p>
			</Accordion.Content>
		</Accordion.Item>
	</Accordion>
	<Accordion>
		<Accordion.Item name="faq">
			<Accordion.Trigger>
				Can I use my own domain?
				<ChevronDownIcon data-slot="icon" aria-hidden="true" />
			</Accordion.Trigger>
			<Accordion.Content>
				<p>Yes, point a CNAME at your status page and the certificate follows.</p>
			</Accordion.Content>
		</Accordion.Item>
		<Accordion.Item name="faq">
			<Accordion.Trigger>
				Is there a free plan?
				<ChevronDownIcon data-slot="icon" aria-hidden="true" />
			</Accordion.Trigger>
			<Accordion.Content>
				<p>Five monitors and one status page, with no card required.</p>
			</Accordion.Content>
		</Accordion.Item>
	</Accordion>
</FaqBand>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<FaqBand title="Questions" columns={2}>
				<Accordion>
					<Accordion.Item name="faq">
						<Accordion.Trigger>
							How often do checks run?
							<ChevronDownIcon data-slot="icon" aria-hidden="true" />
						</Accordion.Trigger>
						<Accordion.Content>
							<p>Every thirty seconds on paid plans, every five minutes on the free one.</p>
						</Accordion.Content>
					</Accordion.Item>
					<Accordion.Item name="faq">
						<Accordion.Trigger>
							Where do probes run from?
							<ChevronDownIcon data-slot="icon" aria-hidden="true" />
						</Accordion.Trigger>
						<Accordion.Content>
							<p>Six regions across North America, Europe and Asia.</p>
						</Accordion.Content>
					</Accordion.Item>
				</Accordion>
				<Accordion>
					<Accordion.Item name="faq">
						<Accordion.Trigger>
							Can I use my own domain?
							<ChevronDownIcon data-slot="icon" aria-hidden="true" />
						</Accordion.Trigger>
						<Accordion.Content>
							<p>Yes, point a CNAME at your status page and the certificate follows.</p>
						</Accordion.Content>
					</Accordion.Item>
					<Accordion.Item name="faq">
						<Accordion.Trigger>
							Is there a free plan?
							<ChevronDownIcon data-slot="icon" aria-hidden="true" />
						</Accordion.Trigger>
						<Accordion.Content>
							<p>Five monitors and one status page, with no card required.</p>
						</Accordion.Content>
					</Accordion.Item>
				</Accordion>
			</FaqBand>
		</HeadingScope>
	),
};
