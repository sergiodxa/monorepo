/**
 * A single labeled figure inside a dashboard/detail-page stat row. `value` accepts
 * any node (not just text) since some stat cards render badges instead of a plain
 * number, e.g. the dashboard's SSL certificate counts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import * as s from "~/resources/styles";

namespace StatCard {
	export interface Props {
		label: string;
		value: RemixNode;
	}
}

/** Renders a {@link s.statCard} with a muted label and a large value. */
export default function StatCard(handle: Handle<StatCard.Props>) {
	return () => (
		<div mix={[s.statCard]}>
			<div mix={[s.mutedSmall]}>{handle.props.label}</div>
			<div mix={[s.statValue]}>{handle.props.value}</div>
		</div>
	);
}
