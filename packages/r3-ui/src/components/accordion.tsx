/**
 * A set of expand/collapse sections built on {@link Disclosure}, stacked into
 * one divider-separated list. Every section keeps its own show/hide state on
 * its native `<details>` element exactly as {@link Disclosure} does; giving
 * sibling {@link Accordion.Item}s the same `name` turns the set exclusive
 * through the platform's own `<details name>` behavior, closing whichever
 * section was open the moment another one opens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { css } from "remix/ui";

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
 * {@link Accordion.Item} sections in normal block flow, each one drawing its
 * own divider so the whole list reads as one continuous group instead of
 * separate bordered cards.
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
			<div {...rest} mix={[css({ inlineSize: "100%" }), mix]}>
				{children}
			</div>
		);
	};
}

/**
 * Renders one section as {@link Disclosure}, restyled from a rounded,
 * fully-bordered box into a flush list row: rounding and the inline/block-start
 * borders are stripped so only a shared block-end divider remains, with that
 * divider restored on the block-start side for the list's first section so the
 * whole group is framed top and bottom. Every other detail — the `open`
 * attribute driving the state, the `::details-content` reveal transition, and
 * `name` grouping sibling sections into an exclusive set — rides along
 * unchanged from {@link Disclosure}, since this component composes it
 * directly instead of duplicating its markup or styling.
 *
 * Disabling a section is done by setting `aria-disabled="true"` on its
 * {@link Accordion.Trigger}; this host dims to match through a `:has()`
 * selector reading that state, without tracking it itself.
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
					css({
						borderRadius: "0",
						borderInlineWidth: "0",
						borderBlockStartWidth: "0",

						"&:first-child": {
							borderBlockStartWidth: "1px",
						},
						'&:has(> summary[aria-disabled="true"])': {
							opacity: "0.5",
						},
						"&[open]": {
							'& summary [data-slot="icon"]': {
								transform: "rotate(180deg)",
							},
						},
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link Accordion.TriggerProps.children} as the section's label row:
 * {@link Disclosure.Trigger} restyled with its label and trailing content
 * spread to opposite ends and underlined on hover in place of
 * {@link Disclosure.Trigger}'s tinted background. Nest an icon element
 * carrying `data-slot="icon"` in `children`, after the label text, to get a
 * trailing indicator that rotates 180 degrees while the enclosing
 * {@link Accordion.Item} is open; the color, focus-visible ring, and
 * `aria-disabled="true"` handling all carry over unchanged from
 * {@link Disclosure.Trigger}.
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
					css({
						justifyContent: "space-between",
						borderRadius: "0",
						paddingBlock: "1rem",
						paddingInline: "0",

						"&:hover": {
							backgroundColor: "transparent",
							textDecorationLine: "underline",
						},

						'& [data-slot="icon"]': {
							flexShrink: "0",
							inlineSize: "1rem",
							blockSize: "1rem",
							transitionProperty: "transform",
							transitionDuration: "200ms",
						},

						"@media (prefers-reduced-motion: reduce)": {
							'& [data-slot="icon"]': {
								transitionDuration: "0s",
							},
						},
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link Accordion.ContentProps.children} as the section's revealed
 * body: {@link Disclosure.Panel} restyled with block-end padding and small,
 * muted text sized for supporting copy rather than a heading. The reveal
 * itself keeps riding on {@link Disclosure}'s `::details-content` transition,
 * unchanged.
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

		return (
			<Disclosure.Panel
				{...rest}
				mix={[
					css({
						paddingBlockEnd: "1rem",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
						color: "var(--ui-neutral-fg)",
					}),
					mix,
				]}
			/>
		);
	};
};
