/**
 * The components that take over ordinary markdown nodes, so prose written without a
 * single tag still lands in the site's type scale and link styling. They are keyed by
 * node type where the document is rendered, which is what keeps a content file free of
 * markup whose only job is styling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { media } from "@sdxc/u/responsive";
import { m, mbe } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { balance, leading, text, textDecoration, tracking, weight } from "@sdxc/u/typography";
import { TAG_BY_LEVEL } from "@sdxc/ui";

import type { MarkdownProps } from "~/resources/components/markdown-props";

/** Font size per heading depth, largest first, so the page reads as one outline. */
const SIZE_BY_LEVEL = ["4xl", "2xl", "xl", "lg", "base", "base"] as const;

namespace Prose {
	export interface HeadingProps extends MarkdownProps {
		level: 1 | 2 | 3 | 4 | 5 | 6;
		id?: string;
	}

	export interface LinkProps extends MarkdownProps {
		href: string;
		title?: string;
	}
}

/** Draws every `heading` node in the document. */
export function ProseHeading(handle: Handle<Prose.HeadingProps>) {
	return () => {
		let { children, id, level } = handle.props;
		let Tag = TAG_BY_LEVEL[level];

		return (
			<Tag
				id={id}
				mix={[
					m(0),
					fg("neutral.emphasis"),
					weight(level === 1 ? "bold" : "semibold"),
					tracking("tight"),
					leading("tight"),
					balance(),
					text(SIZE_BY_LEVEL[level - 1] ?? "base"),
					media(
						"(min-width: 48rem)",
						level === 1 ? text("5xl") : text(SIZE_BY_LEVEL[level - 1] ?? "base"),
					),
				]}
			>
				{children}
			</Tag>
		);
	};
}

/**
 * Draws every `paragraph` node. The containers around it open the space above it — a
 * flex column through its gap, a typeset through its own flow rule — so a trailing
 * margin here would only stack on the padding at the end of one.
 */
export function ProseParagraph(handle: Handle<MarkdownProps>) {
	return () => <p mix={[mbe(0)]}>{handle.props.children}</p>;
}

/** Draws every `link` node in the document. */
export function ProseLink(handle: Handle<Prose.LinkProps>) {
	return () => {
		let { children, href, title } = handle.props;

		return (
			<a
				href={href}
				title={title}
				mix={[fg("brand"), textDecoration("underline"), when("&:hover", fg("brand.emphasis"))]}
			>
				{children}
			</a>
		);
	};
}
