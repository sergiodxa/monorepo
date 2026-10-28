/**
 * The free-sample offer: a heading, one line of copy, and the email field that unlocks the
 * chapter. It is rendered both as a section of the sales page and as the whole of the
 * sample page, so the offer reads identically wherever a visitor meets it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { mbe } from "@sdxc/u/size";
import { textTransform } from "@sdxc/u/typography";
import { HeadingScope, MarketingHeader, MarketingSection } from "@sdxc/ui";

import type { SubscribeForm } from "~/resources/components/subscribe-form";

import SubscribeFormComponent from "~/resources/components/subscribe-form";
import { SAMPLE } from "~/resources/content/release";

export namespace SampleChapterSection {
	export interface Props {
		/** Where the form posts — the sample page unlocks the chapter on POST. */
		action: string;
		/** A server-rendered error to show under the field. */
		error?: string;
		/** The address a typo suggestion was just shown for, kept as typed on resubmit. */
		confirmEmail?: SubscribeForm.Props["confirmEmail"];
		/**
		 * Draws the marketing hairline above this band. On for the sales page,
		 * off when the sample page is the whole document.
		 * @default true
		 */
		ruled?: boolean;
	}
}

/**
 * The `sample` id is load-bearing: it is the anchor external links point at.
 */
export default function SampleChapterSection(handle: Handle<SampleChapterSection.Props>) {
	return () => {
		let { action, confirmEmail, error, ruled } = handle.props;
		let isRuled = ruled ?? true;

		return (
			<MarketingSection id="sample" ruled={isRuled} spacing="compact">
				<div mix={[vstack({ gap: 10 })]}>
					<HeadingScope>
						<MarketingHeader
							description={SAMPLE.description}
							mix={[mbe(0)]}
							parts={{ title: [textTransform("capitalize")] }}
						>
							{SAMPLE.title}
						</MarketingHeader>
					</HeadingScope>

					<SubscribeFormComponent
						action={action}
						confirmEmail={confirmEmail}
						error={error}
						label="Email address"
						submitLabel={SAMPLE.submitLabel}
					/>
				</div>
			</MarketingSection>
		);
	};
}
