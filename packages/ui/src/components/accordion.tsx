/**
 * A set of expand/collapse sections built on {@link Disclosure}, stacked into
 * one divider-separated list. Each section holds its state on its native
 * `<details>` element; giving sibling {@link Accordion.Item}s the same `name`
 * makes the set exclusive through the platform's `<details name>` behavior,
 * closing whichever section was open as another opens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { bg, borderEdge, fg } from "@pkg/u/color";
import { opacity, rounded, transition, transitionDuration } from "@pkg/u/effects";
import { justify, shrink } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { bs, is, pb, pbe, pi } from "@pkg/u/size";
import { hover, open, when } from "@pkg/u/state";
import { rotate } from "@pkg/u/transform";
import { text, textDecoration } from "@pkg/u/typography";

import { Disclosure } from "./disclosure";

/**
 * Prop types for {@link Accordion} and its compound parts.
 */
export namespace Accordion {
	/**
	 * Props accepted by {@link Accordion}.
	 */
	export interface Props extends TagProps<"div"> {
		/** One or more {@link Accordion.Item} sections to stack into a list. */
		children: RemixNode;
	}

	/**
	 * Every prop {@link Disclosure.Props} accepts, unchanged: the section's
	 * `open` state and, when set to the same value across siblings, the
	 * `name` that makes the group exclusive.
	 */
	export interface ItemProps extends Disclosure.Props {}

	/** Every prop {@link Disclosure.TriggerProps} accepts, unchanged. */
	export interface TriggerProps extends Disclosure.TriggerProps {}

	/** Every prop {@link Disclosure.PanelProps} accepts, unchanged. */
	export interface ContentProps extends Disclosure.PanelProps {}
}

/**
 * Renders the list's root host: a plain `<div>` that stacks
 * {@link Accordion.Item} sections in normal block flow, each drawing its own
 * divider so the whole list reads as one continuous group.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <Accordion>
 * 	<Accordion.Item>
 * 		<Accordion.Trigger>
 * 			{t("faq.refunds.question")}
 * 			<ChevronDownIcon data-slot="icon" aria-hidden />
 * 		</Accordion.Trigger>
 * 		<Accordion.Content>
 * 			<p>{t("faq.refunds.answer")}</p>
 * 		</Accordion.Content>
 * 	</Accordion.Item>
 * 	<Accordion.Item>
 * 		<Accordion.Trigger>
 * 			{t("faq.shipping.question")}
 * 			<ChevronDownIcon data-slot="icon" aria-hidden />
 * 		</Accordion.Trigger>
 * 		<Accordion.Content>
 * 			<p>{t("faq.shipping.answer")}</p>
 * 		</Accordion.Content>
 * 	</Accordion.Item>
 * </Accordion>
 * @example
 * <Accordion>
 * 	<Accordion.Item name="faq" open>
 * 		<Accordion.Trigger>
 * 			{t("faq.refunds.question")}
 * 			<ChevronDownIcon data-slot="icon" aria-hidden />
 * 		</Accordion.Trigger>
 * 		<Accordion.Content>
 * 			<p>{t("faq.refunds.answer")}</p>
 * 		</Accordion.Content>
 * 	</Accordion.Item>
 * 	<Accordion.Item name="faq">
 * 		<Accordion.Trigger>
 * 			{t("faq.shipping.question")}
 * 			<ChevronDownIcon data-slot="icon" aria-hidden />
 * 		</Accordion.Trigger>
 * 		<Accordion.Content>
 * 			<p>{t("faq.shipping.answer")}</p>
 * 		</Accordion.Content>
 * 	</Accordion.Item>
 * </Accordion>
 */
export function Accordion(handle: Handle<Accordion.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div {...rest} mix={[is("full"), mix]}>
				{children}
			</div>
		);
	};
}

/**
 * Renders one section as {@link Disclosure} restyled into a flush list row:
 * only a shared block-end divider survives, restored block-start on the first
 * section. A trigger marked `aria-disabled="true"` dims the whole section.
 *
 * @param handle Runtime handle carrying the host `<details>`'s props.
 * @returns The render function producing the section's markup.
 * @example
 * <Accordion.Item>
 * 	<Accordion.Trigger>
 * 		{t("faq.refunds.question")}
 * 		<ChevronDownIcon data-slot="icon" aria-hidden />
 * 	</Accordion.Trigger>
 * 	<Accordion.Content>
 * 		<p>{t("faq.refunds.answer")}</p>
 * 	</Accordion.Content>
 * </Accordion.Item>
 * @example
 * <Accordion.Item name="faq" open>
 * 	<Accordion.Trigger>
 * 		{t("faq.refunds.question")}
 * 		<ChevronDownIcon data-slot="icon" aria-hidden />
 * 	</Accordion.Trigger>
 * 	<Accordion.Content>
 * 		<p>{t("faq.refunds.answer")}</p>
 * 	</Accordion.Content>
 * </Accordion.Item>
 */
Accordion.Item = function AccordionItem(handle: Handle<Accordion.ItemProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<Disclosure
				{...rest}
				mix={[
					rounded("none"),
					borderEdge("inline-start", { width: "0", noStyleDefault: true }),
					borderEdge("inline-end", { width: "0", noStyleDefault: true }),
					borderEdge("block-start", { width: "0", noStyleDefault: true }),
					open(when('& summary [data-slot="icon"]', rotate(180))),
					when("&:first-child", borderEdge("block-start", { width: 1 })),
					when('&:has(> summary[aria-disabled="true"])', opacity(50)),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link Accordion.TriggerProps.children} as the section's label row,
 * spread to opposite ends and underlined on hover. An icon element carrying
 * `data-slot="icon"` rotates 180 degrees while its section is open.
 *
 * @param handle Runtime handle carrying the host `<summary>`'s props.
 * @returns The render function producing the label row's markup.
 * @example
 * <Accordion.Trigger>
 * 	{t("faq.refunds.question")}
 * 	<ChevronDownIcon data-slot="icon" aria-hidden />
 * </Accordion.Trigger>
 * @example
 * <Accordion.Trigger aria-disabled="true">
 * 	{t("faq.archived.question")}
 * 	<ChevronDownIcon data-slot="icon" aria-hidden />
 * </Accordion.Trigger>
 */
Accordion.Trigger = function AccordionTrigger(handle: Handle<Accordion.TriggerProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<Disclosure.Trigger
				{...rest}
				mix={[
					justify("between"),
					pb(4),
					pi(0),
					rounded("none"),
					hover([bg("transparent"), textDecoration("underline")]),
					when('& [data-slot="icon"]', [
						is(4),
						bs(4),
						shrink(),
						transition("transform", { duration: "200ms" }),
					]),
					media(
						"(prefers-reduced-motion: reduce)",
						when('& [data-slot="icon"]', transitionDuration("0s")),
					),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link Accordion.ContentProps.children} as the section's revealed
 * body: {@link Disclosure.Panel} restyled with block-end padding and small,
 * muted text sized for supporting copy.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the body's markup.
 * @example
 * <Accordion.Content>
 * 	<p>{t("faq.refunds.answer")}</p>
 * </Accordion.Content>
 */
Accordion.Content = function AccordionContent(handle: Handle<Accordion.ContentProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <Disclosure.Panel {...rest} mix={[pbe(4), fg("neutral"), text("sm"), mix]} />;
	};
};
