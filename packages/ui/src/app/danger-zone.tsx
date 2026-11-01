/**
 * The last section of a settings page, holding the actions that cannot be undone. Each
 * action is a row that names its consequences and opens a `Confirm`, so the decision is
 * read twice before anything is deleted, and a danger border sets the section apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle, mergeMix, raw } from "@sdxc/u/general";
import { container, vstack } from "@sdxc/u/layout";
import { divide, overflow } from "@sdxc/u/overflow";
import { m, minIs, p, pis } from "@sdxc/u/size";
import { balance, pretty, text, weight } from "@sdxc/u/typography";

import { Button } from "../components/button.js";
import { Confirm } from "../components/confirm.js";

/** Container an action row measures, stacking its button under the text when narrow. */
const ROW_CONTAINER = "ui-danger-zone";

/**
 * Prop types for {@link DangerZone} and {@link DangerZone.Action}.
 */
export namespace DangerZone {
	/** Props accepted by {@link DangerZone}. */
	export interface Props extends Omit<TagProps<"section">, "title"> {
		/** The section's heading, such as "Danger zone". */
		title: RemixNode;
		description?: RemixNode;
	}

	/** Props accepted by {@link DangerZone.Action}. */
	export interface ActionProps extends Omit<TagProps<"div">, "title"> {
		/** The confirm dialog's `id`, which the row's button opens. */
		id: string;
		/** What the action does, such as "Delete team". */
		title: RemixNode;
		description?: RemixNode;
		/** What is lost, one item each: "14 monitors stop checking", "Invoices stay in Billing". */
		consequences?: ReadonlyArray<RemixNode>;
		/** The row's button text; name the action, such as "Delete team". */
		buttonLabel: RemixNode;
		/**
		 * The confirmation the button opens. Name the item in the title and description and
		 * the action on the confirm button; add `typeToConfirm` for the biggest deletions.
		 */
		confirm: Omit<Confirm.Props, "id">;
	}
}

/**
 * Renders the section: a heading over a card with a danger border whose rows are
 * {@link DangerZone.Action}s.
 *
 * @param handle Runtime handle carrying the section's props.
 * @returns The render function producing the section's markup.
 * @example
 * <DangerZone title="Danger zone">
 * 	<DangerZone.Action id="delete-team" title="Delete team" buttonLabel="Delete team"
 * 		consequences={["14 monitors stop checking", "Status pages go offline"]}
 * 		confirm={{ title: "Delete team?", confirmLabel: "Delete team", cancelLabel: "Cancel", form: { action: "/team/delete" } }} />
 * </DangerZone>
 */
export function DangerZone(handle: Handle<DangerZone.Props>) {
	return () => {
		let { title, description, children, mix, ...rest } = handle.props;
		let titleId = `${handle.id}-title`;

		return (
			<section
				{...rest}
				aria-labelledby={titleId}
				data-slot="danger-zone"
				mix={mergeMix([vstack({ gap: 3, align: "stretch" })], mix)}
			>
				<header mix={[vstack({ gap: 1, align: "stretch" })]}>
					<h2
						id={titleId}
						mix={[m(0), text("base"), weight("semibold"), fg("neutral.emphasis"), balance()]}
					>
						{title}
					</h2>
					{description ? (
						<p mix={[m(0), text("sm"), fg("neutral.muted"), pretty()]}>{description}</p>
					) : null}
				</header>
				<div
					data-slot="danger-zone-card"
					mix={[
						vstack({ gap: 0, align: "stretch" }),
						rounded("lg"),
						border({ color: "danger", width: 1 }),
						bg("neutral.surface"),
						overflow("hidden"),
						divide("block", "danger"),
					]}
				>
					{children}
				</div>
			</section>
		);
	};
}

/**
 * Renders one irreversible action: its title, description and consequence list at the
 * start, and a danger button at the end that opens its {@link Confirm}. The button moves
 * under the text in a narrow card.
 *
 * @param handle Runtime handle carrying the action's props.
 * @returns The render function producing the row's markup.
 * @example
 * <DangerZone.Action id="transfer" title="Transfer ownership" buttonLabel="Transfer…" confirm={…} />
 */
DangerZone.Action = function DangerZoneAction(handle: Handle<DangerZone.ActionProps>) {
	return () => {
		let { id, title, description, consequences, buttonLabel, confirm, mix, ...rest } = handle.props;

		return (
			<div {...rest} data-slot="danger-zone-action" mix={mergeMix([container(ROW_CONTAINER)], mix)}>
				<div
					mix={[
						p(4),
						raw({
							display: "grid",
							gap: "0.75rem 1.5rem",
							alignItems: "start",
							gridTemplateColumns: "minmax(0, 1fr)",
							[`@container ${ROW_CONTAINER} (min-width: 32rem)`]: {
								gridTemplateColumns: "minmax(0, 1fr) auto",
								alignItems: "center",
							},
						}),
					]}
				>
					<div mix={[vstack({ gap: 1, align: "stretch" }), minIs(0)]}>
						<p mix={[m(0), text("sm"), weight("medium"), fg("neutral.emphasis")]}>{title}</p>
						{description ? (
							<p mix={[m(0), text("sm"), fg("neutral.muted"), pretty()]}>{description}</p>
						) : null}
						{consequences && consequences.length > 0 ? (
							<ul
								data-slot="danger-zone-consequences"
								mix={[
									vstack({ gap: 0.5, align: "stretch" }),
									m(0),
									pis(5),
									listStyle("disc"),
									text("sm"),
									fg("neutral.muted"),
								]}
							>
								{consequences.map((consequence) => (
									<li>{consequence}</li>
								))}
							</ul>
						) : null}
					</div>
					<Button
						commandfor={id}
						command="show-modal"
						color="danger"
						variant="outline"
						size="sm"
						mix={[raw({ justifySelf: "start" })]}
					>
						{buttonLabel}
					</Button>
				</div>
				<Confirm {...confirm} id={id} />
			</div>
		);
	};
};
