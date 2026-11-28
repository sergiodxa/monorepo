/**
 * How a demo blog's Markdown renders: section headings with their `#` links, fenced code in
 * the kit's code block, GitHub alerts as callouts, and links out marked as leaving the blog.
 * Everything else is plain HTML, which the reading typeset around a post styles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixOptions } from "@sdxc/markdown/remix";
import type { Handle } from "remix/component";

import { TAG_BY_LEVEL } from "@sdxc/ui";
import { AnchorHeading } from "@sdxc/ui/docs";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import { AlertTag, Fence } from "~/resources/components/markdown-blocks";

namespace PostHeading {
	export interface Props extends MarkdownProps {
		level: 1 | 2 | 3 | 4 | 5 | 6;
		id?: string;
	}
}

/**
 * A heading inside a post. Sections and subsections carry the anchor the outline links to,
 * so a reader can share the paragraph they are on; deeper levels are detail and stay plain.
 */
function PostHeading(handle: Handle<PostHeading.Props>) {
	return () => {
		let { children, id, level } = handle.props;
		if (id === undefined || level < 2 || level > 3) {
			let Tag = TAG_BY_LEVEL[level];
			return <Tag id={id}>{children}</Tag>;
		}
		return (
			<AnchorHeading id={id} level={level} linkLabel="Link to this section">
				{children}
			</AnchorHeading>
		);
	};
}

namespace PostLink {
	export interface Props extends MarkdownProps {
		href: string;
		title?: string;
	}
}

/** A link in a post; one to another site opens in place and tells referrers nothing. */
function PostLink(handle: Handle<PostLink.Props>) {
	return () => {
		let { children, href, title } = handle.props;
		let external = /^https?:\/\//.test(href);
		return (
			<a href={href} title={title} rel={external ? "noreferrer" : undefined}>
				{children}
			</a>
		);
	};
}

/** The components every demo blog renders its posts with. */
export const POST_COMPONENTS: NonNullable<RemixOptions["components"]> = {
	heading: PostHeading,
	code: Fence,
	alert: AlertTag,
	link: PostLink,
};
