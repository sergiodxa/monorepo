/**
 * A stat card's small muted line under its big figure — `StatCard` has no dedicated
 * description slot, so this renders inside its `value`. Shared by the dashboard's
 * stat-card fragment views (usage, overview, counts).
 *
 * Built on `@pkg/ui`'s `Text` — its default size and `--ui-neutral-fg` color are
 * already the catalog's "small, muted body copy" contract, so this only adds the
 * block-level display and top margin a standalone caption line needs (`Text` itself
 * renders an inline `<span>`, styled here to sit on its own line below the value it
 * follows).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { block } from "@pkg/u/layout";
import { mbs } from "@pkg/u/size";
import { Text } from "@pkg/ui";

namespace Subtitle {
	export interface Props {
		children: RemixNode;
	}
}

/** Renders {@link Subtitle.Props.children} as a stat card's muted description line. */
export default function Subtitle(handle: Handle<Subtitle.Props>) {
	return () => <Text mix={[block(), mbs("0.25rem")]}>{handle.props.children}</Text>;
}
