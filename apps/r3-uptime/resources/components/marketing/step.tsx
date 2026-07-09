/**
 * One numbered item in a "how it works" list. The number itself is drawn by
 * {@link s.marketingStep}'s CSS counter, not client script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import * as s from "~/resources/styles";

namespace MarketingStep {
	export interface Props {
		title: string;
		description: string;
	}
}

/** Renders one {@link s.marketingStep} entry with a title and description. */
export default function MarketingStep(handle: Handle<MarketingStep.Props>) {
	return () => (
		<div mix={[s.marketingStep]}>
			<h3 mix={[s.marketingCardTitle]}>{handle.props.title}</h3>
			<p mix={[s.marketingCardDescription]}>{handle.props.description}</p>
		</div>
	);
}
