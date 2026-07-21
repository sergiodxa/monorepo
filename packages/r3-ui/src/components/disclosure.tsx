/**
 * A single expand/collapse section built on the native `<details>` and
 * `<summary>` elements, so the show/hide state, keyboard handling, and
 * find-in-page behavior all come from the platform rather than tracked
 * state. `Disclosure.Trigger` is the always-visible `<summary>` label and
 * `Disclosure.Panel` is the content it reveals; `Disclosure.Group` stacks
 * several disclosures into one bordered list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import { focusRingPrimary } from "../styles/focus-ring";
import { panelChrome } from "../styles/panel-chrome";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope";

/**
 * Prop types for {@link Disclosure} and its compound parts.
 */
export namespace Disclosure {
	/**
	 * Every native `<details>` attribute, plus the `mix` passthrough. `open`
	 * sets the section's initial and current expanded state declaratively —
	 * there is no separate "default expanded" prop, since the attribute
	 * itself is what the browser tracks. Setting the same `name` on several
	 * sibling `Disclosure` elements lets the browser keep only one of them
	 * open at a time, closing the others automatically when one is opened.
	 */
	export interface Props extends TagProps<"details"> {
		/** The section's compound parts: {@link Disclosure.Trigger} followed by {@link Disclosure.Panel}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Disclosure.Header}. Every native heading-element
	 * attribute still applies, since the rendered tag depends on the nearest
	 * ambient heading level, falling back to `<h1>` where nothing supplies
	 * one.
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
 * Renders the section's `<details>` host: a rounded, bordered container that
 * shows {@link Disclosure.Panel}'s content whenever it carries the native
 * `open` attribute. The reveal animates through the `::details-content`
 * pseudo-element's `block-size`, so the platform's own hide/show behavior
 * still works instantly wherever that pseudo-element or `interpolate-size`
 * isn't supported — the animation is a progressive enhancement layered on
 * top of, never a replacement for, the native toggle.
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
					css({
						interpolateSize: "allow-keywords",

						"&::details-content": {
							overflow: "clip",
							blockSize: "0",
							transitionProperty: "block-size, content-visibility",
							transitionDuration: "200ms",
							transitionBehavior: "allow-discrete",
						},
						"&[open]::details-content": {
							blockSize: "auto",
						},
						"@media (prefers-reduced-motion: reduce)": {
							"&::details-content": {
								transitionDuration: "0s",
							},
						},
					}),
					mix,
				]}
			>
				{children}
			</details>
		);
	};
}

/**
 * Renders {@link Disclosure.HeaderProps.children} as the trigger's label
 * inside the native heading element matching the nearest ambient heading
 * level — `<h1>` where nothing supplies one — exposing the section's
 * question or title as a heading landmark for assistive technology while
 * inheriting its font size, weight, and color from {@link Disclosure.Trigger}
 * through ordinary CSS inheritance. Nest it directly inside
 * {@link Disclosure.Trigger} — a heading is only meaningful there, since
 * `<summary>` must stay the `<details>` element's direct child for the
 * browser to recognize it as the section's trigger.
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
			<Tag {...rest} data-heading-level={resolved} mix={[css({ margin: "0" }), mix]}>
				{children}
			</Tag>
		);
	};
};

/**
 * Renders {@link Disclosure.TriggerProps.children} inside a native
 * `<summary>`, the section's always-visible, always-focusable label. Its
 * default disclosure triangle is suppressed in favor of a plain row layout,
 * so a consumer supplies its own leading or trailing indicator (an icon that
 * rotates on `[open]`, for instance) as part of its children when one is
 * wanted. Setting `aria-disabled="true"` mutes the label's color and swaps
 * its cursor to signal that the section shouldn't be toggled; the browser
 * still toggles `<details>` on activation regardless, since preventing that
 * natively requires script a consumer attaches itself.
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
					focusRingPrimary(),
					css({
						display: "flex",
						inlineSize: "100%",
						alignItems: "center",
						gap: "0.5rem",
						borderRadius: "var(--ui-radius-lg, 0.5rem)",
						paddingBlock: "0.75rem",
						paddingInline: "0.75rem",
						textAlign: "start",
						fontWeight: "500",
						cursor: "pointer",
						listStyle: "none",
						color: "var(--ui-neutral-fg-emphasis)",
						transitionProperty:
							"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke",
						transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
						transitionDuration: "150ms",

						"&::-webkit-details-marker": {
							display: "none",
						},
						"&::marker": {
							content: '""',
						},

						"&:hover": {
							backgroundColor: "var(--ui-neutral-bg-tint)",
						},
						'&[aria-disabled="true"]': {
							cursor: "not-allowed",
							opacity: 0.5,
						},
					}),
					mix,
				]}
			>
				{children}
			</summary>
		);
	};
};

/**
 * Renders {@link Disclosure.PanelProps.children} as the section's revealed
 * content: a plain `<div>` positioned after {@link Disclosure.Trigger} inside
 * {@link Disclosure}, which is all a `<details>` element needs for the
 * browser to treat it as the collapsible body the `::details-content`
 * pseudo-element wraps and animates. It carries no padding of its own, so a
 * consumer sizes its own inner content the way {@link Disclosure.Trigger}'s
 * padding is sized.
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
			<div {...rest} mix={[css({ overflow: "hidden" }), mix]}>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Disclosure.GroupProps.children} as a single bordered,
 * rounded list stacking several {@link Disclosure} sections: each section's
 * own border and radius are stripped down to a shared block-end divider,
 * with the outer rounding and block-start border restored only on the first
 * and last direct `<details>` child. Every section inside keeps toggling
 * independently — sharing a `name` across them is what makes the browser
 * hold only one open at a time.
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
					css({
						display: "flex",
						flexDirection: "column",

						"& > details": {
							borderRadius: "0",
							borderInlineWidth: "0",
							borderBlockStartWidth: "0",

							"&:first-child": {
								borderStartStartRadius: "var(--ui-radius-lg, 0.5rem)",
								borderStartEndRadius: "var(--ui-radius-lg, 0.5rem)",
								borderBlockStartWidth: "1px",
							},
							"&:last-child": {
								borderEndStartRadius: "var(--ui-radius-lg, 0.5rem)",
								borderEndEndRadius: "var(--ui-radius-lg, 0.5rem)",
							},
						},
					}),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};
