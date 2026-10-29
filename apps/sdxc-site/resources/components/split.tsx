/**
 * The `split`, `split-copy` and `split-media` tags: a band laid out as prose on one side
 * and what the prose is about on the other — a code sample, a set of tabs. Thin adapters
 * over {@link Split} so markdown tag names stay stable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Split as UiSplit } from "@sdxc/ui";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import { blocksUseGap } from "~/resources/components/block-flow";

/**
 * Renders the two columns. The wider one goes to the media unless `lean="copy"` hands it
 * to the copy, for a band whose sample is short enough to sit in the narrower column.
 */
export default function Split(handle: Handle<MarkdownProps & { lean?: "copy" | "media" }>) {
	return () => <UiSplit lean={handle.props.lean}>{handle.props.children}</UiSplit>;
}

/**
 * Renders the prose column. A list in it reads as the claims the column makes, so each
 * item is marked with a check rather than a bullet.
 */
export function SplitCopy(handle: Handle<MarkdownProps>) {
	return () => (
		<UiSplit.Copy checks mix={[blocksUseGap()]}>
			{handle.props.children}
		</UiSplit.Copy>
	);
}

/**
 * Renders what the copy is about, sized to the column rather than to its own content. A
 * long sample scrolls inside its own block past a fixed height, so switching between the
 * samples of a tab strip never leaves one towering over the copy beside it.
 */
export function SplitMedia(handle: Handle<MarkdownProps>) {
	return () => <UiSplit.Media mix={[blocksUseGap()]}>{handle.props.children}</UiSplit.Media>;
}
