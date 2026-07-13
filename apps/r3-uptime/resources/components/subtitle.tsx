/**
 * A stat card's small muted line under its big figure — `StatCard` has no dedicated
 * description slot, so this renders inside its `value`. Shared by the dashboard's
 * stat-card fragment views (usage, overview, counts).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import { neutral } from "~/resources/theme";

namespace Subtitle {
	export interface Props {
		children: RemixNode;
	}
}

const subtitle = css({
	fontSize: "0.75rem",
	fontWeight: 400,
	lineHeight: "1rem",
	marginTop: 4,
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

/** Renders {@link Subtitle.Props.children} as a stat card's muted description line. */
export default function Subtitle(handle: Handle<Subtitle.Props>) {
	return () => <div mix={[subtitle]}>{handle.props.children}</div>;
}
