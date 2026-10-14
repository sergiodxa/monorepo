/**
 * The components that take over ordinary markdown nodes, so prose written without a
 * single tag still lands in the site's type scale and link styling. They are keyed by
 * node type where the document is rendered, which is what keeps a content file free of
 * markup whose only job is styling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { media } from "@sdxc/u/responsive";
import { m, mbe, pis } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { balance, leading, text, textDecoration, tracking, weight } from "@sdxc/u/typography";
import { TAG_BY_LEVEL } from "@sdxc/ui";

import type { MarkdownProps } from "~/resources/components/markdown-props";

/** Font size per heading depth, largest first, so the page reads as one outline. */
const SIZE_BY_LEVEL = ["4xl", "2xl", "xl", "lg", "base", "base"] as const;

/**
 * Font size per heading depth when a band draws its headings at display size, as the
 * landing page does: fewer, larger steps, since a band holds one heading and not an outline.
 */
const DISPLAY_SIZE_BY_LEVEL = [
	["5xl", "7xl"],
	["3xl", "5xl"],
	["xl", "2xl"],
] as const;

namespace Prose {
	export interface HeadingProps extends MarkdownProps {
		level: 1 | 2 | 3 | 4 | 5 | 6;
		id?: string;
	}

	export interface ListProps extends MarkdownProps {
		ordered?: boolean;
		start?: number | null;
	}

	export interface LinkProps extends MarkdownProps {
		href: string;
		title?: string;
	}
}

namespace DisplayHeadings {
	export interface Props {
		children: RemixNode;
	}

	/** What a heading inside the scope reads off it. */
	export interface Value {
		display: true;
	}
}

/**
 * Draws every heading inside it at display size: set in a lighter weight with tighter
 * tracking, the way a headline is set rather than a section title.
 */
export function DisplayHeadings(handle: Handle<DisplayHeadings.Props, DisplayHeadings.Value>) {
	handle.context.set({ display: true });

	return () => handle.props.children;
}

/** Draws every `heading` node in the document. */
export function ProseHeading(handle: Handle<Prose.HeadingProps>) {
	return () => {
		let { children, id, level } = handle.props;
		let Tag = TAG_BY_LEVEL[level];
		let display = level <= 3 ? DISPLAY_SIZE_BY_LEVEL[level - 1] : undefined;

		if (display && handle.context.get(DisplayHeadings)?.display) {
			let [size, wide] = display;

			return (
				<Tag
					id={id}
					mix={[
						m(0),
						fg("neutral.emphasis"),
						weight("medium"),
						tracking(level === 3 ? "tight" : "-0.04em"),
						leading(level === 3 ? "tight" : 1.05),
						balance(),
						text(size),
						media("(min-width: 48rem)", text(wide)),
					]}
				>
					{children}
				</Tag>
			);
		}

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

/**
 * Draws every `list` node. It sets the indent and leaves the space around the list to the
 * container, so under a heading or after a paragraph a list sits at the same distance a
 * paragraph would.
 */
export function ProseList(handle: Handle<Prose.ListProps>) {
	return () => {
		let { children, ordered, start } = handle.props;

		if (ordered) {
			return (
				<ol start={start ?? undefined} mix={[mbe(0), pis("1.25rem")]}>
					{children}
				</ol>
			);
		}

		return <ul mix={[mbe(0), pis("1.25rem")]}>{children}</ul>;
	};
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
