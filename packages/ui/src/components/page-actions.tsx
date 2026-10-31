/**
 * The "Copy page" split button a docs page carries in its header: the main half copies
 * the page's Markdown twin, and the chevron opens a menu of places to take the page (View
 * as Markdown, Open in Claude, Edit on GitHub). Only the copy hydrates; the menu is HTML.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { CheckIcon, ChevronDownIcon, CopyIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { mergeMix, raw } from "@sdxc/u/general";
import { shrink, vstack } from "@sdxc/u/layout";
import { maxIs } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { copyFeedback } from "../mixins/copy-feedback.js";
import { copyFromUrl } from "../mixins/copy-from-url.js";

import { Button } from "./button.js";
import { Group } from "./group.js";
import { Menu } from "./menu.js";

/** Id the menu and its trigger share when `menuId` is omitted; one page carries one menu. */
const DEFAULT_MENU_ID = "page-actions-menu";

/**
 * Prop types for {@link PageActions}.
 */
export namespace PageActions {
	/** Every string the split button shows or announces. */
	export interface Labels {
		/** The main button's label, such as "Copy page". */
		copy: string;
		/** The label shown and announced for two seconds after a copy, such as "Copied". */
		copied: string;
		/** Announced when the copy fails, such as "Could not copy the page". */
		failed: string;
		/** Accessible name of the chevron that opens the menu, such as "More page actions". */
		more: string;
	}

	/** One place the menu takes the page. */
	export interface Link {
		label: string;
		/** One line saying what the destination does with the page. */
		description?: string;
		href: string;
		/** A 16px glyph drawn before the label. */
		icon?: RemixNode;
		/** Opens in a new tab, for a destination on another site. */
		external?: boolean;
	}

	/** Props accepted by {@link PageActions}. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The page's Markdown twin, fetched and copied by the main button. */
		markdownHref: string;
		labels: Labels;
		/** The menu's entries; with none, the chevron and menu are left out. */
		links?: Link[];
		/** Id shared by the menu and its trigger. @default "page-actions-menu" */
		menuId?: string;
	}

	/**
	 * Props {@link PageActionsCopy} serializes for hydration, which is why they are a `type`:
	 * `SerializableProps` rejects an interface.
	 */
	export type CopyProps = {
		href: string;
		copy: string;
		copied: string;
		failed: string;
	};
}

/**
 * Renders the split button: the copy island, then the chevron opening a native popover
 * menu through `popovertarget`, so the menu opens and closes without JavaScript.
 *
 * @param handle Runtime handle carrying the actions' props.
 * @returns The render function producing the split button's markup.
 * @example
 * <PageActions markdownHref="/docs/install.md" labels={labels} links={[{ label: "View as Markdown", href: "/docs/install.md" }]} />
 */
export function PageActions(handle: Handle<PageActions.Props>) {
	return () => {
		let { markdownHref, labels, links = [], menuId, mix, ...rest } = handle.props;
		let id = menuId ?? DEFAULT_MENU_ID;

		return (
			<Group {...rest} data-slot="page-actions" mix={mergeMix([], mix)}>
				<PageActionsCopy
					href={markdownHref}
					copy={labels.copy}
					copied={labels.copied}
					failed={labels.failed}
				/>
				{links.length > 0 ? (
					<Button
						type="button"
						size="sm"
						variant="outline"
						color="neutral"
						popovertarget={id}
						aria-label={labels.more}
						data-slot="page-actions-trigger"
					>
						<ChevronDownIcon size={16} aria-hidden="true" />
					</Button>
				) : null}
				{links.length > 0 ? (
					<Menu
						id={id}
						aria-label={labels.more}
						placement="bottom-end"
						mix={[maxIs("min(20rem, 90vw)")]}
					>
						{links.map((link) => (
							<Menu.Item
								key={link.href}
								href={link.href}
								{...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
							>
								{link.icon ?? null}
								<span mix={[vstack({ gap: 0.5, align: "start" })]}>
									<span mix={[weight("medium")]}>{link.label}</span>
									{link.description ? (
										<span mix={[text("xs"), fg("neutral.muted")]}>{link.description}</span>
									) : null}
								</span>
							</Menu.Item>
						))}
					</Menu>
				) : null}
			</Group>
		);
	};
}

/**
 * Client island: the main half of {@link PageActions}, loaded from the bare
 * `@sdxc/ui/page-actions` specifier. It copies `href`'s body, swaps its glyph and label to
 * the copied state for two seconds and announces it; before hydration it is inert.
 *
 * @example
 * <PageActionsCopy href="/docs/install.md" copy="Copy page" copied="Copied" failed="Could not copy" />
 */
export const PageActionsCopy: EntryComponent<PageActions.CopyProps> = clientEntry(
	"@sdxc/ui/page-actions#PageActionsCopy",
	function PageActionsCopy(handle) {
		return () => {
			let { copied, copy, failed, href } = handle.props;

			return (
				<Button
					type="button"
					size="sm"
					variant="outline"
					color="neutral"
					data-slot="page-actions-copy"
					mix={[
						shrink(0),
						/**
						 * Each state's glyph and label are drawn together and swapped in one rule, so
						 * the copied state always wins whatever order the stylesheet layers land in.
						 */
						raw({
							"& [data-state]": { display: "inline-flex", alignItems: "center" },
							'& [data-state="copied"]': { display: "none" },
							'&[data-copied] [data-state="idle"]': { display: "none" },
							'&[data-copied] [data-state="copied"]': { display: "inline-flex" },
						}),
						copyFromUrl(href, failed),
						copyFeedback(copied),
					]}
				>
					<span data-state="idle" mix={[raw({ gap: "0.375rem" })]}>
						<CopyIcon size={16} aria-hidden="true" />
						{copy}
					</span>
					<span data-state="copied" mix={[raw({ gap: "0.375rem" })]}>
						<CheckIcon size={16} aria-hidden="true" mix={[fg("success")]} />
						{copied}
					</span>
					<span role="status" mix={[visuallyHidden()]} />
				</Button>
			);
		};
	},
);
