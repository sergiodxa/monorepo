/**
 * Tabs over code that mirrors a reader's choice — package manager, framework, language.
 * The tabs are radios switched by CSS, so they work without script; with a `syncKey`, a
 * small island switches every set sharing it and remembers the choice for the next page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { grid, gap } from "@sdxc/u/layout";
import { minIs } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";

import type { CodeTabsPersistence } from "../mixins/code-tabs-sync.js";
import type { CSSStyles } from "../utils/css-styles.js";

import { CODE_TABS_ATTRIBUTE } from "../mixins/code-tabs-sync.js";

import { CodeTabsSync } from "./code-tabs-sync.js";

/**
 * Radio name every set uses. Each set is its own `<form>`, which scopes the name to it, so
 * two sets on a page never share a group however alike their tabs are.
 */
const RADIO_NAME = "code-tab";

/**
 * Prop types for {@link CodeTabs}.
 */
export namespace CodeTabs {
	/** One tab: its label in the strip, the value a sync key stores, and its panel. */
	export interface Tab {
		label: string;
		/** Stable across pages and sets, such as `bun`; the value a sync key remembers. */
		value: string;
		/** What the panel shows, usually a `CodeBlock`. */
		children: RemixNode;
	}

	/** Props accepted by {@link CodeTabs}. */
	export interface Props extends Omit<TagProps<"form">, "children" | "aria-label"> {
		tabs: readonly Tab[];
		/** Every set with this key on the page switches together, such as `package-manager`. */
		syncKey?: string;
		/**
		 * Where a synced choice is remembered between pages: `cookie` lets the server render
		 * it (read it with `readCodeTabsCookie` and pass `selected`), `local` restores it after
		 * hydration, and `none` only syncs this page. Defaults to `local`.
		 */
		persist?: CodeTabsPersistence;
		/** The value of the tab to render selected, such as the reader's remembered choice. Defaults to the first tab. */
		selected?: string;
		/** Names the strip of tabs for assistive technology, such as "Package manager". */
		"aria-label": string;
	}
}

/**
 * Renders the strip of tabs over a stack of panels that share one grid cell, so the set
 * is as tall as its tallest panel and switching never moves the page. The selected tab's
 * underline grows in over 150ms, and holds still under reduced motion.
 *
 * @param handle Runtime handle carrying the set's props.
 * @returns The render function producing the set.
 * @example
 * <CodeTabs syncKey="framework" aria-label={t("framework")} tabs={[
 * 	{ label: "Remix", value: "remix", children: <CodeBlock title="app/root.tsx" … /> },
 * 	{ label: "Hono", value: "hono", children: <CodeBlock title="src/index.ts" … /> },
 * ]} />
 */
export function CodeTabs(handle: Handle<CodeTabs.Props>) {
	return () => {
		let {
			"aria-label": label,
			mix,
			persist = "local",
			selected,
			syncKey,
			tabs,
			...rest
		} = handle.props;
		let checked = tabs.some((tab) => tab.value === selected) ? selected : tabs[0]?.value;

		return (
			<form
				{...rest}
				data-slot="code-tabs"
				{...{ [CODE_TABS_ATTRIBUTE]: syncKey ?? "" }}
				mix={mergeMix([grid(), gap(2), minIs(0)], mix)}
			>
				<div
					role="radiogroup"
					aria-label={label}
					data-slot="code-tabs-list"
					mix={[
						raw({
							display: "flex",
							minInlineSize: 0,
							overflowX: "auto",
							scrollbarWidth: "thin",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					{tabs.map((tab) => (
						<label key={tab.value} mix={[text("sm"), weight("medium"), tabRules()]}>
							<input
								type="radio"
								name={RADIO_NAME}
								value={tab.value}
								defaultChecked={tab.value === checked}
								mix={[visuallyHidden()]}
							/>
							{tab.label}
						</label>
					))}
				</div>

				<div data-slot="code-tabs-panels" mix={[grid(), minIs(0)]}>
					{tabs.map((tab, index) => (
						<div key={tab.value} data-slot="code-tabs-panel" mix={[panelRules(index)]}>
							{tab.children}
						</div>
					))}
				</div>

				{syncKey ? <CodeTabsSync syncKey={syncKey} persist={persist} /> : null}
			</form>
		);
	};
}

/**
 * A tab label's rules in one block, so its checked, focused and reduced-motion states
 * resolve by specificity: muted until checked, with an underline that grows from the
 * centre when its radio is checked.
 */
function tabRules() {
	return raw({
		position: "relative",
		flexShrink: 0,
		paddingBlock: "0.5rem",
		paddingInline: "0.75rem",
		whiteSpace: "nowrap",
		cursor: "pointer",
		color: "var(--ui-neutral-fg)",
		transition: "color 150ms ease-out",
		"&::after": {
			content: '""',
			position: "absolute",
			insetInline: "0.5rem",
			insetBlockEnd: 0,
			blockSize: "2px",
			borderRadius: "1px",
			backgroundColor: "var(--ui-brand-fg)",
			transform: "scaleX(0)",
			transition: "transform 150ms ease-out",
		},
		"&:hover": { color: "var(--ui-neutral-fg-emphasis)" },
		"&:has(input:checked)": { color: "var(--ui-neutral-fg-emphasis)" },
		"&:has(input:checked)::after": { transform: "scaleX(1)" },
		"&:has(input:focus-visible)": {
			outline: "2px solid var(--ui-brand-ring)",
			outlineOffset: "-2px",
			borderRadius: "0.375rem",
		},
		"@media (prefers-reduced-motion: reduce)": {
			transition: "none",
			"&::after": { transition: "none" },
		},
	});
}

/**
 * A panel's rules: every panel fills the one shared cell and stays laid out while hidden,
 * which sizes the stack to the tallest; `visibility` keeps a hidden panel out of the
 * accessibility tree and the tab order, and the panel shows while the tab at its index is
 * checked. Its last child stretches so every panel's frame ends on one edge.
 *
 * @param index The panel's position, which pairs it with the tab at the same position.
 */
function panelRules(index: number) {
	let shown = `&:is([${CODE_TABS_ATTRIBUTE}]:has(> [data-slot="code-tabs-list"] > label:nth-child(${index + 1}) > input:checked) > [data-slot="code-tabs-panels"] > *)`;
	let rules: CSSStyles = {
		gridArea: "1 / 1",
		display: "flex",
		flexDirection: "column",
		minInlineSize: 0,
		visibility: "hidden",
		"& > :last-child": { flexGrow: 1 },
	};
	rules[shown] = { visibility: "visible" };
	return raw(rules);
}
