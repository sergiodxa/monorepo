/**
 * The frame of a settings area: a section nav on the start side and a content column held to
 * a reading measure, or the column alone where the app shell's swapped panel lists the sections.
 * On a narrow container the nav is the parent page and a section route shows content and a back link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronLeftIcon } from "@sdxc/icons";
import { bg, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { listStyle, mergeMix, raw } from "@sdxc/u/general";
import { container, hstack, vstack } from "@sdxc/u/layout";
import { is, m, minIs, p, pi } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { text, textDecoration, truncate, weight } from "@sdxc/u/typography";

/** Container the layout measures its own width against. */
const LAYOUT_CONTAINER = "ui-settings-layout";

/** Width at which the nav and the content sit side by side. */
const WIDE = `@container ${LAYOUT_CONTAINER} (min-width: 48rem)`;

/** Which route the layout renders for when `page` is omitted. */
const DEFAULT_PAGE: NonNullable<SettingsLayout.Props["page"]> = "section";

/** Width below which only one of the two columns shows. */
const NARROW = `@container ${LAYOUT_CONTAINER} (max-width: 47.999rem)`;

/**
 * Prop types for {@link SettingsLayout}.
 */
export namespace SettingsLayout {
	/** One section of the settings area. */
	export interface Item {
		href: string;
		label: RemixNode;
		/** Marks the section being shown, rendered as `aria-current="page"`. */
		current?: boolean;
	}

	/** A run of sections under an optional heading, such as "Workspace" or "Account". */
	export interface Group {
		label?: RemixNode;
		items: ReadonlyArray<Item>;
	}

	/** Every string the layout shows or announces. */
	export interface Labels {
		/** Name of the nav landmark, such as "Settings"; required with `sections`. */
		nav?: string;
		/** Text of the back link a narrow section page shows, such as "Settings". */
		back: string;
	}

	/** Props accepted by {@link SettingsLayout}. */
	export interface Props extends TagProps<"div"> {
		/**
		 * The nav's groups of sections. Omit them where the app shell's swapped panel already
		 * lists the sections: the layout is then the content column alone at every width.
		 */
		sections?: ReadonlyArray<Group>;
		/**
		 * Which route renders the layout. `"index"` is the settings root, which a narrow
		 * container shows as the nav alone; `"section"` shows a section's content.
		 *
		 * @default "section"
		 */
		page?: "index" | "section";
		/** Where the narrow back link returns to: the settings index route. */
		backHref?: string;
		labels: Labels;
	}
}

/**
 * Renders the nav and the content column. Both are in the markup on every route and the
 * container decides which one a narrow screen shows, so the layout needs no script and
 * follows a resized pane. Without `sections` the content shows on every route.
 *
 * @param handle Runtime handle carrying the layout's props.
 * @returns The render function producing the layout's markup.
 * @example
 * <SettingsLayout
 * 	sections={[{ items: [{ href: "/settings/general", label: "General", current: true }, { href: "/settings/billing", label: "Billing" }] }]}
 * 	backHref="/settings"
 * 	labels={{ nav: "Settings", back: "Settings" }}
 * >
 * 	<SettingsSection title="Monitor defaults" save="explicit" labels={{ save: "Save" }}>…</SettingsSection>
 * </SettingsLayout>
 * @example
 * <SettingsLayout backHref="/settings" labels={{ back: "Settings" }}>…</SettingsLayout>
 */
export function SettingsLayout(handle: Handle<SettingsLayout.Props>) {
	return () => {
		let { sections, page: pageProp, backHref, labels, children, mix, ...rest } = handle.props;
		let page = pageProp ?? DEFAULT_PAGE;
		let hasNav = sections !== undefined;
		let isIndex = page === "index";
		/** The narrow index page is the nav itself, so its content waits for a section route. */
		let hideNarrowContent = isIndex && hasNav;

		return (
			<div
				{...rest}
				data-slot="settings-layout"
				data-page={page}
				data-nav={hasNav ? undefined : "none"}
				mix={mergeMix([is("100%"), container(LAYOUT_CONTAINER)], mix)}
			>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr)",
							gap: "1.5rem",
							[WIDE]: {
								gridTemplateColumns: hasNav
									? "var(--ui-settings-nav-width, 13rem) minmax(0, var(--ui-settings-measure, 42rem))"
									: "minmax(0, var(--ui-settings-measure, 42rem))",
								gap: "2.5rem",
							},
						}),
					]}
				>
					{sections ? (
						<nav
							aria-label={labels.nav}
							data-slot="settings-nav"
							mix={[
								vstack({ gap: 5, align: "stretch" }),
								minIs(0),
								raw({
									[NARROW]: { display: isIndex ? "flex" : "none" },
									[WIDE]: {
										position: "sticky",
										insetBlockStart: "calc(var(--ui-app-sticky-top, 0px) + 1rem)",
										alignSelf: "start",
									},
								}),
							]}
						>
							{sections.map((group) => (
								<SettingsNavGroup group={group} />
							))}
						</nav>
					) : null}

					<div
						data-slot="settings-content"
						mix={[
							vstack({ gap: 8, align: "stretch" }),
							minIs(0),
							raw({ [NARROW]: { display: hideNarrowContent ? "none" : "flex" } }),
						]}
					>
						{!isIndex && backHref ? (
							<a
								href={backHref}
								data-slot="settings-back"
								mix={[
									hstack({ gap: 1, align: "center" }),
									raw({ alignSelf: "start", [WIDE]: { display: "none" } }),
									text("sm"),
									fg("neutral.muted"),
									textDecoration("none"),
									rounded("sm"),
									hover(fg("neutral.emphasis")),
									when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
								]}
							>
								<ChevronLeftIcon size={16} aria-hidden="true" />
								{labels.back}
							</a>
						) : null}
						{children}
					</div>
				</div>
			</div>
		);
	};
}

namespace SettingsNavGroup {
	export interface Props {
		group: SettingsLayout.Group;
	}
}

/**
 * One group of section links. Rows are 32px on a wide container and grow to a 44px
 * touch target where the nav is the whole page.
 */
function SettingsNavGroup(handle: Handle<SettingsNavGroup.Props>) {
	return () => {
		let { group } = handle.props;
		let headingId = group.label ? `${handle.id}-label` : undefined;

		return (
			<div mix={[vstack({ gap: 1, align: "stretch" })]}>
				{group.label ? (
					<p id={headingId} mix={[pi(2.5), text("xs"), weight("medium"), fg("neutral.muted")]}>
						{group.label}
					</p>
				) : null}
				<ul
					aria-labelledby={headingId}
					mix={[vstack({ gap: 0.5, align: "stretch" }), listStyle(), m(0), p(0)]}
				>
					{group.items.map((item) => (
						<li>
							<a
								href={item.href}
								aria-current={item.current ? "page" : undefined}
								data-slot="settings-nav-item"
								mix={[
									hstack({ gap: 2, align: "center" }),
									pi(2.5),
									rounded("md"),
									text("sm"),
									fg("neutral"),
									textDecoration("none"),
									transition("background-color, color"),
									raw({
										blockSize: "var(--ui-app-nav-row-size, 2rem)",
										[NARROW]: { blockSize: "2.75rem" },
									}),
									hover([bg("neutral.bg-tint"), fg("neutral.emphasis")]),
									when('&[aria-current="page"]', [
										bg("neutral.bg-tint"),
										fg("neutral.emphasis"),
										weight("medium"),
									]),
									when("&:focus-visible", outline({ color: "brand.ring", offset: -2 })),
								]}
							>
								<span mix={[truncate(), minIs(0)]}>{item.label}</span>
							</a>
						</li>
					))}
				</ul>
			</div>
		);
	};
}
