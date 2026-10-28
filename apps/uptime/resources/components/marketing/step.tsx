/**
 * One numbered item in a "how it works" list. Thin adapter over
 * {@link StepList.Item} so pages that still map steps outside a
 * {@link FeatureBand} keep a stable `MarketingStep` name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { StepList } from "@sdxc/ui/patterns";

namespace MarketingStep {
	export interface Props {
		title: string;
		description: string;
	}
}

/**
 * Renders a numbered step title and supporting copy. Nest inside a
 * {@link StepList} (or a {@link FeatureBand} with `layout="steps"`) so CSS
 * counters and connector lines apply.
 */
export default function MarketingStep(handle: Handle<MarketingStep.Props>) {
	return () => <StepList.Item title={handle.props.title}>{handle.props.description}</StepList.Item>;
}
