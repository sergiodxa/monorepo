/**
 * The pieces every help page body is written with: anchored section headings, key caps,
 * a question list, and a frame that sets a product scene into the prose. Numbers a page
 * quotes arrive as `figures`, read from the limits that enforce them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import { ChevronDownIcon } from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { m, minIs, p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { Accordion, AnchorHeading } from "@sdxc/ui";

export namespace DocBody {
	export interface Props {
		/** The request's translator with every landing figure bound, for product scenes. */
		t: Translate;
		/** Every limit and interval a page may quote, formatted for the request's locale. */
		figures: Record<string, string>;
		/** The request's locale, for numbers a scene formats itself. */
		locale: string;
	}
}

/** The label each section heading's `#` link is read out with. */
const ANCHOR_LABEL = "Link to this section";

/** A page section's heading, with the `#` link and the scroll margin the shell expects. */
export function H2(handle: Handle<{ id: string; children: RemixNode }>) {
	return () => (
		<AnchorHeading id={handle.props.id} level={2} linkLabel={ANCHOR_LABEL}>
			{handle.props.children}
		</AnchorHeading>
	);
}

/** One key cap, set inline in a sentence; a chord is written as one cap per key. */
export function Kbd(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<kbd
			mix={[
				raw({
					display: "inline-block",
					minInlineSize: "1.6em",
					padding: "0 0.35em",
					borderRadius: "0.3125rem",
					boxShadow: "inset 0 -1px 0 var(--ui-neutral-border)",
					textAlign: "center",
					lineHeight: "1.5",
					fontSize: "0.85em",
				}),
				font("mono"),
				bg("neutral.tint"),
				border({ color: "neutral.border", width: 1, style: "solid" }),
				fg("neutral.emphasis"),
			]}
		>
			{handle.props.children}
		</kbd>
	);
}

namespace Faq {
	export interface Item {
		question: string;
		answer: RemixNode;
	}
}

/**
 * The reader's own questions as disclosures, closed until asked, so a page ends on the
 * edge cases without making everybody read them.
 */
export function Faq(handle: Handle<{ items: Faq.Item[] }>) {
	return () => (
		<Accordion data-slot="docs-faq">
			{handle.props.items.map((item) => (
				<Accordion.Item key={item.question}>
					<Accordion.Trigger>
						{item.question}
						<ChevronDownIcon data-slot="icon" aria-hidden="true" />
					</Accordion.Trigger>
					<Accordion.Content>{item.answer}</Accordion.Content>
				</Accordion.Item>
			))}
		</Accordion>
	);
}

/**
 * A product scene set into the prose with a caption under it. The scene is one image to
 * assistive technology, so the caption is what a reader of the text learns from it.
 */
export function Scene(handle: Handle<{ caption: string; children: RemixNode }>) {
	return () => (
		<figure data-slot="docs-scene" mix={[vstack({ gap: 3, align: "stretch" }), m(0), minIs(0)]}>
			<div mix={[minIs(0), raw({ maxInlineSize: "100%", overflow: "hidden" })]}>
				{handle.props.children}
			</div>
			<figcaption mix={[text("sm"), fg("neutral.muted"), p(0, 1)]}>
				{handle.props.caption}
			</figcaption>
		</figure>
	);
}

/** A two-column table of facts, for reference material a page states once. */
export function FactTable(
	handle: Handle<{ caption: string; head: [string, string]; rows: [RemixNode, RemixNode][] }>,
) {
	return () => {
		let { caption, head, rows } = handle.props;
		return (
			<table data-slot="docs-table">
				<caption mix={[raw({ textAlign: "start" }), text("sm"), fg("neutral.muted")]}>
					{caption}
				</caption>
				<thead>
					<tr>
						<th scope="col">{head[0]}</th>
						<th scope="col">{head[1]}</th>
					</tr>
				</thead>
				<tbody>
					{rows.map(([key, value], index) => (
						<tr key={index}>
							<th scope="row" mix={[weight("medium")]}>
								{key}
							</th>
							<td>{value}</td>
						</tr>
					))}
				</tbody>
			</table>
		);
	};
}
