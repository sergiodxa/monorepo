/**
 * The `fine-print` tag: one small, muted line under a row of actions, for the secondary
 * ways to do what the buttons above it offer. It sets its own size, so a line placed in
 * the large copy of a hero still reads as an aside.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { m } from "@sdxc/u/size";
import { leading, text } from "@sdxc/u/typography";

import type { MarkdownProps } from "~/resources/components/markdown-props";

/** Renders the line. */
export default function FinePrint(handle: Handle<MarkdownProps>) {
	return () => (
		<p mix={[m(0), text("sm"), leading("normal"), fg("neutral.muted")]}>{handle.props.children}</p>
	);
}
