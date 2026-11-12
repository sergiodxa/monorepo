/**
 * Draws a Tern reply from its blocks the way a model's Markdown renders: headings, lists,
 * quotes and tables set by `Typeset`'s chat rhythm, and code in a `CodeBlock` with its own
 * copy button, so every reply on every screen reads the same.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { Typeset } from "@sdxc/ui";
import { CodeBlock } from "@sdxc/ui/docs/code-block";

import type { Block } from "~/resources/views/demo-apps/tern/data";

/** The code block's copy button strings. */
const CODE_LABELS = { copy: "Copy code", copied: "Copied" };

/**
 * Splits a line into text, `**bold**` and `` `code` `` runs.
 *
 * @param text The line as the fixtures write it.
 * @returns The runs as nodes.
 */
export function inline(text: string): RemixNode[] {
	return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part) => {
		if (part.startsWith("**") && part.endsWith("**")) return <strong>{part.slice(2, -2)}</strong>;
		if (part.startsWith("`") && part.endsWith("`") && part.length > 1)
			return <code>{part.slice(1, -1)}</code>;
		return part;
	});
}

/** One block as its element. */
function BlockView(handle: Handle<{ block: Block; codeId: string }>) {
	return () => {
		let { block, codeId } = handle.props;
		switch (block.type) {
			case "p":
				return <p>{inline(block.text)}</p>;
			case "h":
				return <h3>{inline(block.text)}</h3>;
			case "ul":
				return (
					<ul>
						{block.items.map((item) => (
							<li>{inline(item)}</li>
						))}
					</ul>
				);
			case "ol":
				return (
					<ol>
						{block.items.map((item) => (
							<li>{inline(item)}</li>
						))}
					</ol>
				);
			case "quote":
				return (
					<blockquote>
						{block.paragraphs.map((paragraph) => (
							<p>{inline(paragraph)}</p>
						))}
					</blockquote>
				);
			case "code":
				return (
					<CodeBlock
						code={block.code}
						language={block.language}
						title={block.title}
						labels={CODE_LABELS}
						codeId={codeId}
						mix={[raw({ marginBlock: "1em" })]}
					/>
				);
			case "table":
				return (
					<table>
						<thead>
							<tr>
								{block.head.map((cell, column) => (
									<th
										scope="col"
										style={block.numeric?.includes(column) ? "text-align:end" : undefined}
									>
										{cell}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{block.rows.map((row) => (
								<tr>
									{row.map((cell, column) => (
										<td
											style={
												block.numeric?.includes(column)
													? "text-align:end;font-variant-numeric:tabular-nums"
													: undefined
											}
										>
											{inline(cell)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				);
		}
	};
}

namespace ReplyBlocks {
	export interface Props {
		blocks: Block[];
		/** Prefixes each code block's id, so two replies on a page copy their own code. */
		id: string;
	}
}

/** Renders a reply's blocks as chat-sized prose. */
export function ReplyBlocks(handle: Handle<ReplyBlocks.Props>) {
	return () => {
		let { blocks, id } = handle.props;
		return (
			<Typeset preset="chat" mix={[raw({ minInlineSize: 0 })]}>
				{blocks.map((block, index) => (
					<BlockView block={block} codeId={`${id}-code-${index}`} />
				))}
			</Typeset>
		);
	};
}
