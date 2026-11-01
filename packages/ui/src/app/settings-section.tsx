/**
 * One group of settings: a title and description beside or above a bordered card of
 * 1px-ruled rows. A section saves one way only: `"explicit"` for typed inputs, with its own
 * primary Save at the bottom start, `"instant"` for switches, or `"none"` for a table or list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { mergeMix, raw } from "@sdxc/u/general";
import { container, hstack, vstack } from "@sdxc/u/layout";
import { divide, overflow } from "@sdxc/u/overflow";
import { m, minIs, p } from "@sdxc/u/size";
import { balance, pretty, text, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { Button } from "../components/button.js";

import type { ActionPlacement as ActionPlacementType } from "./styles/action-row.js";

import { submitOnChange } from "./mixins/submit-on-change.js";
import { SaveShortcut } from "./save-bar.js";
import { actionRowGrid, onTitleLine } from "./styles/action-row.js";

/** Container the card measures, so a row stacks in a narrow pane as well as on a phone. */
const CARD_CONTAINER = "ui-settings-card";

/** Container the section measures to put its heading beside the card. */
const SECTION_CONTAINER = "ui-settings-section";

/** Card width below which a split row stacks its label over its control. */
const SPLIT_MIN = "32rem";

/** HTTP method a section's form falls back to, since saving changes state. */
const DEFAULT_METHOD = "post";

/** How a section saves when `save` is omitted. */
const DEFAULT_SAVE: SettingsSection.Save = "explicit";

/** Where the heading sits when `heading` is omitted. */
const DEFAULT_HEADING: NonNullable<SettingsSection.Props["heading"]> = "above";

/** How a row lays out when `layout` is omitted. */
const DEFAULT_ROW_LAYOUT: SettingsSection.RowLayout = "split";

/** Gap between a row's text and its control, stacked or side by side. */
const ROW_GAP = "0.5rem 1.5rem";

/** Where an action row's control sits when `actionPlacement` is omitted. */
const DEFAULT_ACTION_PLACEMENT: SettingsSection.ActionPlacement = "end";

/**
 * Prop types for {@link SettingsSection} and {@link SettingsSection.Row}.
 */
export namespace SettingsSection {
	/**
	 * How the section's changes persist. Typed inputs save explicitly, so a half-typed
	 * value never applies; switches save the moment they flip. Mixing them in one section
	 * leaves a person unsure what is saved, so a section picks one; a section holding a table
	 * or list whose rows act on their own saves nothing.
	 */
	export type Save = "explicit" | "instant" | "none";

	/** Where a row's label sits against its control. */
	export type RowLayout = "split" | "stacked" | "inline-switch" | "action";

	/** Where an action row's control sits: at the end on its label's first line, or below its text. */
	export type ActionPlacement = ActionPlacementType;

	/** The form the card submits. */
	export interface FormProps {
		/** URL the section submits to; omit to submit to the current URL. */
		action?: string;
		/** @default "post" */
		method?: "get" | "post";
		/** Hidden inputs submitted with the section: a CSRF token, an intent. */
		fields?: RemixNode;
	}

	/** Every string the section shows. */
	export interface Labels {
		/**
		 * The Save button's text. An instant section shows it only to a browser running no
		 * script, which needs a button to submit its switches.
		 */
		save: string;
	}

	/** Props every section accepts, whatever it saves. */
	export interface BaseProps extends Omit<TagProps<"section">, "title"> {
		title: RemixNode;
		description?: RemixNode;
		/**
		 * Controls on the title's row, at its end, that wrap under the title when the
		 * container is too narrow for both: an "Invite member" or "Add domain" button.
		 */
		actions?: RemixNode;
		/**
		 * Puts the heading in a column beside the card on a wide container.
		 *
		 * @default "above"
		 */
		heading?: "above" | "beside";
	}

	/** A section that saves its controls, explicitly or as they change. */
	export interface SavingProps extends BaseProps {
		/** @default "explicit" */
		save?: "explicit" | "instant";
		/** The form the card becomes; omit for a section whose controls submit on their own. */
		form?: FormProps;
		/** Content after the Save button in an explicit section's footer, such as a `SaveStatus`. */
		footer?: RemixNode;
		labels: Labels;
	}

	/** A section holding a table or list: its card is a plain container with no Save. */
	export interface ListProps extends BaseProps {
		save: "none";
		form?: never;
		footer?: never;
		labels?: never;
	}

	/** Props accepted by {@link SettingsSection}. */
	export type Props = SavingProps | ListProps;

	/** Props accepted by {@link SettingsSection.Row}. */
	export interface RowProps extends TagProps<"div"> {
		label: RemixNode;
		/** Help under the label: what the setting changes, in a sentence. */
		description?: RemixNode;
		/** The control's `id`, which turns the label into a `<label for>`. */
		htmlFor?: string;
		/** The label's `id`, for a control named through `aria-labelledby`, such as a `Switch`. */
		labelId?: string;
		/** The description's `id`, for a control's `aria-describedby`. */
		descriptionId?: string;
		/**
		 * `"split"` puts the label at the start and the control at the end, stacking under
		 * 32rem; `"stacked"` puts the control under the label; `"inline-switch"` keeps a
		 * small control at the end at every width; `"action"` gives the text the row's width
		 * and puts a button that acts at once, such as "Open billing portal", where
		 * `actionPlacement` says, stacking under the text below 32rem.
		 *
		 * @default "split"
		 */
		layout?: RowLayout;
		/**
		 * Where an `"action"` row's control sits on a wide card.
		 *
		 * @default "end"
		 */
		actionPlacement?: ActionPlacement;
	}
}

/**
 * Renders the section. The card is a `<form>` when `form` is set; an explicit section ends
 * in a footer holding its own Save, which ⌘S presses while focus is in the section, an
 * instant one submits whenever a control changes, and a `"none"` one is a plain card.
 *
 * @param handle Runtime handle carrying the section's props.
 * @returns The render function producing the section's markup.
 * @example
 * <SettingsSection title="Monitor defaults" save="explicit" form={{ action: "/settings/monitors" }} labels={{ save: "Save" }}>
 * 	<SettingsSection.Row label="Check interval" htmlFor="interval"><Select id="interval" name="interval">…</Select></SettingsSection.Row>
 * </SettingsSection>
 * @example
 * <SettingsSection title="Notifications" save="instant" form={{ action: "/settings/notifications" }} labels={{ save: "Save" }}>
 * 	<SettingsSection.Row layout="inline-switch" label="Email me when a monitor goes down" labelId="down-label">
 * 		<Switch name="emailOnDown" aria-labelledby="down-label" />
 * 	</SettingsSection.Row>
 * </SettingsSection>
 * @example
 * <SettingsSection title="Members" save="none" actions={<Button commandfor="invite" command="show-modal">Invite member</Button>}>
 * 	<Table.Container>…</Table.Container>
 * </SettingsSection>
 */
export function SettingsSection(handle: Handle<SettingsSection.Props>) {
	return () => {
		let props = handle.props;
		let saveLabel = props.save === "none" ? null : props.labels.save;
		let {
			title,
			description,
			actions,
			save: saveProp,
			form,
			heading: headingProp,
			footer,
			labels: _labels,
			children,
			mix,
			...rest
		} = props;
		let save = saveProp ?? DEFAULT_SAVE;
		let heading = headingProp ?? DEFAULT_HEADING;
		let titleId = `${handle.id}-title`;
		let isExplicit = save === "explicit";
		let cardMix = [
			container(CARD_CONTAINER),
			minIs(0),
			rounded("lg"),
			border({ color: "neutral", width: 1 }),
			bg(),
			overflow("hidden"),
		];
		let rows = (
			<div
				data-slot="settings-rows"
				mix={[vstack({ gap: 0, align: "stretch" }), divide("block", "neutral")]}
			>
				{children}
			</div>
		);
		let saveFooter = isExplicit ? (
			<footer
				data-slot="settings-footer"
				mix={[
					hstack({ gap: 3, align: "center" }),
					raw({ flexWrap: "wrap" }),
					p(3, 4),
					borderEdge("block-start", { color: "neutral", width: 1, style: "solid" }),
					bg("neutral.bg-tint"),
				]}
			>
				<Button type="submit" color="brand" variant="solid" size="sm">
					{saveLabel}
				</Button>
				{footer}
			</footer>
		) : null;
		/**
		 * An instant section saves through script, so a browser running none gets the Save
		 * button an explicit section shows.
		 */
		let instantSave =
			save !== "instant" ? null : (
				<>
					<noscript>
						<div
							mix={[
								p(3, 4),
								borderEdge("block-start", { color: "neutral", width: 1, style: "solid" }),
							]}
						>
							<Button type="submit" color="brand" variant="solid" size="sm">
								{saveLabel}
							</Button>
						</div>
					</noscript>
					<SettingsInstantSave />
				</>
			);

		return (
			<section
				{...rest}
				aria-labelledby={titleId}
				data-slot="settings-section"
				data-save={save}
				mix={mergeMix([container(SECTION_CONTAINER)], mix)}
			>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr)",
							gap: "0.75rem",
							...(heading === "beside"
								? {
										[`@container ${SECTION_CONTAINER} (min-width: 48rem)`]: {
											gridTemplateColumns: "minmax(0, 16rem) minmax(0, 1fr)",
											gap: "2rem",
										},
									}
								: {}),
						}),
					]}
				>
					<header mix={[vstack({ gap: 1, align: "stretch" }), minIs(0)]}>
						<div
							data-slot="settings-title-row"
							mix={[
								hstack({ gap: 2, align: "center" }),
								raw({ flexWrap: "wrap", columnGap: "1rem" }),
							]}
						>
							<h2
								id={titleId}
								mix={[
									m(0),
									raw({ flex: "1 1 auto" }),
									minIs(0),
									text("base"),
									weight("semibold"),
									fg("neutral.emphasis"),
									balance(),
								]}
							>
								{title}
							</h2>
							{actions ? (
								<div
									data-slot="settings-actions"
									mix={[
										hstack({ gap: 2, align: "center" }),
										raw({ flexWrap: "wrap", flex: "0 1 auto" }),
										minIs(0),
									]}
								>
									{actions}
								</div>
							) : null}
						</div>
						{description ? (
							<p mix={[m(0), text("sm"), fg("neutral.muted"), pretty()]}>{description}</p>
						) : null}
					</header>

					{form ? (
						<form
							action={form.action}
							method={form.method ?? DEFAULT_METHOD}
							data-slot="settings-card"
							mix={cardMix}
						>
							{form.fields}
							{rows}
							{saveFooter}
							{isExplicit ? <SaveShortcut /> : null}
							{instantSave}
						</form>
					) : (
						<div data-slot="settings-card" mix={cardMix}>
							{rows}
							{saveFooter}
						</div>
					)}
				</div>
			</section>
		);
	};
}

/**
 * Renders one setting as a label and help beside or above its control. A split row reads
 * its card's width, so it stacks in a narrow pane as well as on a phone.
 *
 * @param handle Runtime handle carrying the row's props.
 * @returns The render function producing the row's markup.
 * @example
 * <SettingsSection.Row label="Alert email" description="Where down alerts go." htmlFor="alert-email">
 * 	<Input id="alert-email" name="alertEmail" type="email" />
 * </SettingsSection.Row>
 * @example
 * <SettingsSection.Row layout="action" label="Subscription" description="Plan, card and invoices.">
 * 	<LinkButton href="/billing/portal" size="sm" variant="outline">Open billing portal</LinkButton>
 * </SettingsSection.Row>
 */
SettingsSection.Row = function SettingsSectionRow(handle: Handle<SettingsSection.RowProps>) {
	return () => {
		let {
			label,
			description,
			htmlFor,
			labelId,
			descriptionId,
			layout: layoutProp,
			actionPlacement: actionPlacementProp,
			children,
			mix,
			...rest
		} = handle.props;
		let layout = layoutProp ?? DEFAULT_ROW_LAYOUT;
		let actionPlacement = actionPlacementProp ?? DEFAULT_ACTION_PLACEMENT;
		let isEndAction = layout === "action" && actionPlacement === "end";
		let labelMix = [text("sm"), weight("medium"), fg("neutral.emphasis")];

		return (
			<div
				{...rest}
				data-slot="settings-row"
				data-layout={layout}
				data-action-placement={layout === "action" ? actionPlacement : undefined}
				mix={mergeMix(
					[
						p(4),
						layout === "action"
							? actionRowGrid(CARD_CONTAINER, actionPlacement, ROW_GAP)
							: raw({
									display: "grid",
									gap: ROW_GAP,
									alignItems: rowAlign(layout, Boolean(description)),
									gridTemplateColumns:
										layout === "inline-switch" ? "minmax(0, 1fr) auto" : "minmax(0, 1fr)",
									...(layout === "split"
										? {
												[`@container ${CARD_CONTAINER} (min-width: ${SPLIT_MIN})`]: {
													gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
												},
											}
										: {}),
								}),
					],
					mix,
				)}
			>
				<div data-slot="settings-row-text" mix={[vstack({ gap: 0.5, align: "stretch" }), minIs(0)]}>
					{htmlFor ? (
						<label id={labelId} for={htmlFor} mix={labelMix}>
							{label}
						</label>
					) : (
						<div id={labelId} mix={labelMix}>
							{label}
						</div>
					)}
					{description ? (
						<p id={descriptionId} mix={[m(0), text("sm"), fg("neutral.muted"), pretty()]}>
							{description}
						</p>
					) : null}
				</div>
				<div
					data-slot="settings-row-control"
					mix={[minIs(0), isEndAction ? onTitleLine(CARD_CONTAINER) : undefined]}
				>
					{children}
				</div>
			</div>
		);
	};
};

/**
 * Where a row's label meets its control: a lone label centres on the control's text line,
 * while a label carrying a description keeps its top on the control's top so the help reads
 * down from it. An inline switch centres on the whole text block.
 */
function rowAlign(layout: SettingsSection.RowLayout, hasDescription: boolean): "center" | "start" {
	if (layout === "inline-switch") return "center";
	if (layout === "split" && !hasDescription) return "center";
	return "start";
}

/**
 * Client island: what makes an instant section save as it changes, attaching
 * `submitOnChange()` to the enclosing form so every flipped control submits it.
 *
 * @example
 * <form method="post"><Switch name="weekly" /><SettingsInstantSave /></form>
 */
export const SettingsInstantSave: EntryComponent<{}> = clientEntry(
	"@sdxc/ui/app/settings-section#SettingsInstantSave",
	function SettingsInstantSave() {
		return () => <span hidden data-slot="settings-instant-save" mix={[submitOnChange()]} />;
	},
);
