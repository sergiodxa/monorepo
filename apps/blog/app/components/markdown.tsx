/**
 * Markdown view component for the blog app. Takes a Markdoc renderable tree and
 * renders it to React elements via Markdoc's React renderer, wiring in the
 * custom Fence component for code blocks. It is the presentation counterpart to
 * the Markdown parsing utility, used to display post content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderableTreeNodes } from "@markdoc/markdoc";

import { renderers } from "@markdoc/markdoc";
import * as React from "react";

import { Fence } from "~/components/md/fence";

type Props = {
	content: RenderableTreeNodes;
};

export function MarkdownView({ content }: Props) {
	return <>{renderers.react(content, React, { components: { Fence } })}</>;
}
