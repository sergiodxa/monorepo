/**
 * A compact feature entry: a tinted icon well beside a title and one line of
 * supporting copy. Thin adapter over {@link Feature} so secondary capability
 * lists share the marketing feature vocabulary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { hstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Feature, HeadingScope } from "@sdxc/ui";

namespace MarketingFeatureRow {
	export interface Props {
		title: string;
		description: string;
		/**
		 * Icon rendered in a brand-tinted well at the row's inline-start edge.
		 */
		icon: RemixNode;
	}
}

/**
 * Icon + title + description row. The heading uses ambient level 3, nested
 * below the page's hero and the section's chapter title.
 */
export default function MarketingFeatureRow(handle: Handle<MarketingFeatureRow.Props>) {
	return () => {
		let { title, description, icon } = handle.props;

		return (
			<HeadingScope level={3}>
				<Feature mix={[hstack({ gap: 4, align: "start" }), p(5)]}>
					<Feature.Icon aria-hidden="true">{icon}</Feature.Icon>
					<div>
						<Feature.Title mix={[text("base")]}>{title}</Feature.Title>
						<Feature.Description mix={[text("sm")]}>{description}</Feature.Description>
					</div>
				</Feature>
			</HeadingScope>
		);
	};
}
