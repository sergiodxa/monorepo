/**
 * A single expand/collapse section built on the native `<details>` and
 * `<summary>` elements, so the show/hide state, keyboard handling, and
 * find-in-page behavior all come from the platform itself.
 * `Disclosure.Trigger` is the always-visible `<summary>` label and
 * `Disclosure.Panel` is the content it reveals; `Disclosure.Group` stacks
 * several disclosures into one bordered list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, borderEdge, fg, outline } from "@sdxc/u/color";
import { opacity, roundedCorner, rounded, transition, transitionDuration } from "@sdxc/u/effects";
import { cursor, listStyle, pointerEvents, raw } from "@sdxc/u/general";
import { flex, flexCol, gap, hidden, interpolateSize, items, shrink } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { bs, is, m, pb, pbe, pi } from "@sdxc/u/size";
import { detailsContent, hover, open, when } from "@sdxc/u/state";
import { rotate } from "@sdxc/u/transform";
import { textAlign, weight } from "@sdxc/u/typography";

import { panelChrome } from "../styles/panel-chrome.js";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope.js";

/**
 * Prop types for {@link Disclosure} and its compound parts.
 */
export namespace Disclosure {
	/**
	 * Every native `<details>` attribute, plus the `mix` passthrough. The
	 * `open` attribute alone drives expanded state, and sibling disclosures
	 * sharing a `name` let the browser keep only one open at a time.
	 */
	export interface Props extends TagProps<"details"> {
		/** The section's compound parts: {@link Disclosure.Trigger} followed by {@link Disclosure.Panel}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Disclosure.Header}. The rendered tag matches
	 * the nearest ambient heading level, falling back to `<h1>` where nothing
	 * supplies one.
	 */
	export interface HeaderProps extends TagProps<"h1"> {
		/** The trigger's label text, exposed as a heading for assistive technology. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Disclosure.Trigger}.
	 */
	export interface TriggerProps extends TagProps<"summary"> {
		/** The always-visible label, typically plain text or {@link Disclosure.Header}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Disclosure.Panel}.
	 */
	export interface PanelProps extends TagProps<"div"> {
		/** The content revealed while the section is open. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Disclosure.Group}.
	 */
	export interface GroupProps extends TagProps<"div"> {
		/** One or more {@link Disclosure} sections to stack into a single bordered list. */
		children: RemixNode;
	}
}

/**
 * Renders the section's `<details>` host, revealing
 * {@link Disclosure.Panel}'s content while `open`. The `::details-content`
 * block-size transition is a progressive enhancement over the native toggle.
 *
 * @param handle Runtime handle carrying the host `<details>`'s props.
 * @returns The render function producing the section's markup.
 * @example
 * <Disclosure>
 * 	<Disclosure.Trigger>
 * 		{t("faq.refunds.question")}
 * 		<ChevronDownIcon data-slot="icon" aria-hidden="true" />
 * 	</Disclosure.Trigger>
 * 	<Disclosure.Panel>
 * 		<p>{t("faq.refunds.answer")}</p>
 * 	</Disclosure.Panel>
 * </Disclosure>
 * @example
 * <Disclosure open>
 * 	<Disclosure.Trigger>{t("faq.shipping.question")}</Disclosure.Trigger>
 * 	<Disclosure.Panel>
 * 		<p>{t("faq.shipping.answer")}</p>
 * 	</Disclosure.Panel>
 * </Disclosure>
 */
export function Disclosure(handle: Handle<Disclosure.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<details
				{...rest}
				mix={[
					panelChrome(),
					interpolateSize(),
					detailsContent([
						overflow("clip"),
						bs(0),
						raw({
							transitionProperty: "block-size, content-visibility",
							transitionBehavior: "allow-discrete",
						}),
						transitionDuration("200ms"),
					]),
					when("&[open]::details-content", bs("auto")),
					/*
					 * The glyph a trigger carries as `data-slot="icon"` turns over while the section
					 * is open, the same rule `Accordion` states: the section owns the turn because
					 * only it knows it is open, and the trigger owns which glyph turns.
					 */
					open(when('& summary [data-slot="icon"]', rotate(180))),
					when('& summary [data-slot="icon"]', transition("transform", { duration: 200 })),
					media("(prefers-reduced-motion: reduce)", [
						detailsContent(transitionDuration("0s")),
						when('& summary [data-slot="icon"]', transitionDuration("0s")),
					]),
					mix,
				]}
			>
				{children}
			</details>
		);
	};
}

/**
 * Renders {@link Disclosure.HeaderProps.children} as an accessible heading
 * at the ambient level, nested directly inside
 * {@link Disclosure.Trigger}, since `<summary>` must stay `<details>`'s direct child.
 *
 * @param handle Runtime handle carrying the host heading element's props.
 * @returns The render function producing the heading's markup.
 * @example
 * <Disclosure.Trigger>
 * 	<Disclosure.Header>{t("faq.refunds.question")}</Disclosure.Header>
 * </Disclosure.Trigger>
 */
Disclosure.Header = function DisclosureHeader(handle: Handle<Disclosure.HeaderProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		let resolved = resolveHeadingLevel(handle);
		let Tag = TAG_BY_LEVEL[resolved];

		return (
			<Tag {...rest} data-heading-level={resolved} mix={[m(0), mix]}>
				{children}
			</Tag>
		);
	};
};

/**
 * Renders {@link Disclosure.TriggerProps.children} inside a native `<summary>`
 * with its marker suppressed, so the indicator is a glyph the consumer passes as a
 * child carrying `data-slot="icon"` — which the section turns over while it is open.
 * `aria-disabled="true"` also stops the section toggling: the row leaves the tab order and
 * stops taking pointer events, which is what a `<summary>` has in place of the `disabled`
 * a button would carry.
 *
 * @param handle Runtime handle carrying the host `<summary>`'s props.
 * @returns The render function producing the trigger's markup.
 * @example
 * <Disclosure.Trigger>{t("faq.refunds.question")}</Disclosure.Trigger>
 * @example
 * <Disclosure.Trigger aria-disabled="true">{t("faq.archived.question")}</Disclosure.Trigger>
 */
Disclosure.Trigger = function DisclosureTrigger(handle: Handle<Disclosure.TriggerProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		/*
		 * A `<summary>` has no `disabled`, so a row marked disabled is taken out of the tab
		 * order to stop Enter and Space reaching it. Paired with the pointer-events rule
		 * below, that is the whole of what `disabled` would do, and it holds before any
		 * script runs rather than waiting for a handler to cancel the toggle.
		 */
		let disabled = rest["aria-disabled"] === "true";

		return (
			<summary
				{...rest}
				tabIndex={disabled ? -1 : rest.tabIndex}
				mix={[
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					flex(),
					is("full"),
					items("center"),
					gap(2),
					rounded("lg"),
					pb(3),
					pi(3),
					textAlign("start"),
					weight("medium"),
					fg("neutral.emphasis"),
					hover(bg("neutral.tint")),
					when('&[aria-disabled="true"]', [opacity(50), pointerEvents("none")]),
					cursor("pointer"),
					listStyle(),
					when("&::-webkit-details-marker", hidden()),
					when("&::marker", raw({ content: '""' })),
					/*
					 * The indicator is measured against the label it sits beside rather than against
					 * whatever an icon set draws at, and holds that measure when a long label
					 * squeezes the row.
					 */
					when('& [data-slot="icon"]', [is(4), bs(4), shrink()]),
					transition(
						"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke",
					),
					when('&[aria-disabled="true"]', cursor("not-allowed")),
					mix,
				]}
			>
				{children}
			</summary>
		);
	};
};

/**
 * Renders {@link Disclosure.PanelProps.children} in a `<div>` positioned
 * after {@link Disclosure.Trigger}, all `<details>` needs to treat it as
 * the collapsible body. Its padding is left for the consumer to size.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the panel's markup.
 * @example
 * <Disclosure.Panel>
 * 	<p>{t("faq.refunds.answer")}</p>
 * </Disclosure.Panel>
 */
Disclosure.Panel = function DisclosurePanel(handle: Handle<Disclosure.PanelProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={[
					overflow(),
					/*
					 * The panel is inset to the same line the trigger's label sits on, so the
					 * section reads as one block rather than as a label indented above content
					 * running to the border. The block-start stays open because the trigger's own
					 * padding already separates the two.
					 */
					pi(3),
					pbe(3),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Disclosure.GroupProps.children} as a bordered, rounded list
 * of {@link Disclosure} sections sharing one divider between them. Sections
 * keep toggling independently unless they share a `name`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <Disclosure.Group>
 * 	<Disclosure>
 * 		<Disclosure.Trigger>{t("faq.refunds.question")}</Disclosure.Trigger>
 * 		<Disclosure.Panel>
 * 			<p>{t("faq.refunds.answer")}</p>
 * 		</Disclosure.Panel>
 * 	</Disclosure>
 * 	<Disclosure>
 * 		<Disclosure.Trigger>{t("faq.shipping.question")}</Disclosure.Trigger>
 * 		<Disclosure.Panel>
 * 			<p>{t("faq.shipping.answer")}</p>
 * 		</Disclosure.Panel>
 * 	</Disclosure>
 * </Disclosure.Group>
 */
Disclosure.Group = function DisclosureGroup(handle: Handle<Disclosure.GroupProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={[
					flex(),
					flexCol(),
					when("& > details", [
						rounded("none"),
						borderEdge("inline-start", { width: "0", noStyleDefault: true }),
						borderEdge("inline-end", { width: "0", noStyleDefault: true }),
						borderEdge("block-start", { width: "0", noStyleDefault: true }),
						when("&:first-child", [
							roundedCorner("start-start", "lg"),
							roundedCorner("start-end", "lg"),
							borderEdge("block-start", { width: 1, noStyleDefault: true }),
						]),
						when("&:last-child", [
							roundedCorner("end-start", "lg"),
							roundedCorner("end-end", "lg"),
						]),
					]),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};
