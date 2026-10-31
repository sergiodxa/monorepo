/**
 * The small pieces every public page repeats inside its bands: the arrow link that carries
 * a band on to the page arguing it in full, and one column of the FAQ. Written once so the
 * home and each family of pages share one shape for both.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowRightIcon, CheckIcon, ChevronDownIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { hover } from "@sdxc/u/state";
import { Accordion } from "@sdxc/ui";

/**
 * An arrow link in the brand ink under a band's checks. Its arrow nudges by a transform on
 * hover, so nothing around it moves.
 */
export function MoreLink(handle: Handle<{ href: string; label: string }>) {
	return () => (
		<p mix={[raw({ margin: "1.5rem 0 0" })]}>
			<a
				href={handle.props.href}
				data-rmx-prefetch="intent"
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						gap: "0.375rem",
						fontWeight: "500",
						color: "var(--ui-brand-fg)",
						textDecoration: "none",
						"& svg": { transition: "transform 150ms ease" },
					}),
					hover(raw({ textDecoration: "underline", "& svg": { transform: "translateX(2px)" } })),
				]}
			>
				{handle.props.label}
				<ArrowRightIcon size={16} aria-hidden="true" />
			</a>
		</p>
	);
}

namespace FaqColumn {
	export interface Props {
		/** The accordion group's name; every column on a page shares it so one answer opens at a time. */
		name: string;
		items: { key: string; question: string; answer: string }[];
	}
}

/** One column of questions, each a native disclosure with the chevron the patterns expect. */
export function FaqColumn(handle: Handle<FaqColumn.Props>) {
	return () => (
		<Accordion>
			{handle.props.items.map((item) => (
				<Accordion.Item key={item.key} name={handle.props.name}>
					<Accordion.Trigger>
						{item.question}
						<ChevronDownIcon data-slot="icon" aria-hidden="true" />
					</Accordion.Trigger>
					<Accordion.Content>
						<p>{item.answer}</p>
					</Accordion.Content>
				</Accordion.Item>
			))}
		</Accordion>
	);
}

namespace Checks {
	export interface Props {
		items: string[];
		/** Lays the items in a wrapping row, for trust lines under a hero's actions. */
		horizontal?: boolean;
	}
}

/**
 * Claims as a list of checks, each drawn with an inline icon so the mark renders under a
 * policy that admits no image sources beyond the app's own. The items are ARIA list items,
 * so a split band's own list styling leaves them alone.
 */
export function Checks(handle: Handle<Checks.Props>) {
	return () => {
		let { horizontal = false, items } = handle.props;
		return (
			<div
				role="list"
				data-slot="marketing-checks"
				mix={[
					raw({
						display: "flex",
						flexDirection: horizontal ? "row" : "column",
						flexWrap: "wrap",
						gap: horizontal ? "0.5rem 1.5rem" : "0.625rem",
						fontSize: horizontal ? "0.9375rem" : "1rem",
						color: "var(--ui-neutral-fg)",
					}),
				]}
			>
				{items.map((item) => (
					<div
						role="listitem"
						key={item}
						mix={[raw({ display: "flex", alignItems: "baseline", gap: "0.625rem" })]}
					>
						<CheckIcon
							size={16}
							strokeWidth={2}
							aria-hidden="true"
							mix={[
								raw({
									flexShrink: "0",
									color: "var(--ui-brand-fg)",
									transform: "translateY(0.15em)",
								}),
							]}
						/>
						<span>{item}</span>
					</div>
				))}
			</div>
		);
	};
}
