/**
 * Lattice's live example: the component rendered on a dotted stage under a "Preview" tab,
 * with the markup that produced it one tab over, so a reader sees the result first and
 * copies the code second.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { HeadingScope } from "@sdxc/ui";
import { CodeBlock, CodeTabs } from "@sdxc/ui/docs";

import { CODE_LABELS } from "~/resources/views/demo-docs/blocks";

namespace Example {
	export interface Props {
		/** Names the tab strip, such as "Button variants example". */
		label: string;
		/** The markup the preview renders, shown under the "Code" tab. */
		code: string;
		/** The component as it renders. */
		children: RemixNode;
	}
}

/**
 * A preview and its code as two tabs. Headings a previewed component draws start at level
 * four, so a card's title sits under the page's sections instead of beside them.
 */
export function Example(handle: Handle<Example.Props>) {
	return () => {
		let { children, code, label } = handle.props;
		return (
			<CodeTabs
				aria-label={label}
				persist="none"
				tabs={[
					{
						label: "Preview",
						value: "preview",
						children: (
							<div
								data-not-typeset=""
								mix={[
									raw({
										display: "grid",
										minBlockSize: "10rem",
										padding: "2rem 1rem",
										overflowX: "auto",
										borderRadius: "var(--ui-radius-md, 0.375rem)",
										boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
										backgroundColor: "var(--ui-bg)",
										backgroundImage:
											"radial-gradient(circle at 1px 1px, var(--ui-neutral-border) 1px, transparent 0)",
										backgroundSize: "14px 14px",
									}),
								]}
							>
								<HeadingScope
									level={4}
									mix={[
										raw({
											display: "flex",
											flexWrap: "wrap",
											alignItems: "center",
											justifyContent: "safe center",
											gap: "0.75rem",
											minInlineSize: 0,
										}),
									]}
								>
									{children}
								</HeadingScope>
							</div>
						),
					},
					{
						label: "Code",
						value: "code",
						children: <CodeBlock code={code} language="tsx" labels={CODE_LABELS} />,
					},
				]}
			/>
		);
	};
}
