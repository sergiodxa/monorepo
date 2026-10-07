/**
 * The label inside a navigation pill, trimmed to its capitals and baseline so the pill's
 * symmetric padding centers what the eye reads as the text. A serif face sits its letters
 * off the middle of its line box, so centering the line box alone leaves them visibly low.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { leading } from "@sdxc/u/typography";

/**
 * Renders the label. Browsers without `text-box` center a one-line box instead, which keeps
 * every pill the same height and nearly centered.
 */
export function PillLabel(handle: Handle<{ children: RemixNode; mix?: TagProps<"span">["mix"] }>) {
	return () => (
		<span mix={[leading(1), raw({ textBox: "trim-both cap alphabetic" }), handle.props.mix]}>
			{handle.props.children}
		</span>
	);
}
