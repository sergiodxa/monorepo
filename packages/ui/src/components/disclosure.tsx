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

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { bg, borderEdge, fg, outline } from "@pkg/u/color";
import { opacity, roundedCorner, rounded, transition, transitionDuration } from "@pkg/u/effects";
import { cursor, listStyle, raw } from "@pkg/u/general";
import { flex, flexCol, gap, hidden, interpolateSize, items } from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { media } from "@pkg/u/responsive";
import { bs, is, m, pb, pi } from "@pkg/u/size";
import { detailsContent, hover, when } from "@pkg/u/state";
import { textAlign, weight } from "@pkg/u/typography";

import { panelChrome } from "../styles/panel-chrome";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope";

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
 * 	<Disclosure.Trigger>{t("faq.refunds.question")}</Disclosure.Trigger>
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
					media("(prefers-reduced-motion: reduce)", detailsContent(transitionDuration("0s"))),
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
 * with its marker suppressed so a consumer supplies its own indicator.
 * `aria-disabled="true"` mutes appearance; the consumer's own script must still block toggling.
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

		return (
			<summary
				{...rest}
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
					when('&[aria-disabled="true"]', opacity(50)),
					cursor("pointer"),
					listStyle(),
					when("&::-webkit-details-marker", hidden()),
					when("&::marker", raw({ content: '""' })),
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
			<div {...rest} mix={[overflow(), mix]}>
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
