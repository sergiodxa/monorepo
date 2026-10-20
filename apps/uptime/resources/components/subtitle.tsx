/**
 * A stat card's small muted line under its big figure — `StatCard` has no dedicated
 * description slot, so this renders inside its `value`. Shared by the dashboard's
 * stat-card fragment views (usage, overview, counts).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { block } from "@sdxc/u/layout";
import { mbs } from "@sdxc/u/size";
import { Text } from "@sdxc/ui";

namespace Subtitle {
	export interface Props {
		children: RemixNode;
	}
}

/** Renders {@link Subtitle.Props.children} as a stat card's muted description line. */
export default function Subtitle(handle: Handle<Subtitle.Props>) {
	return () => <Text mix={[block(), mbs("0.25rem")]}>{handle.props.children}</Text>;
}
