/**
 * The "Scope" field of the alert create and edit forms: one `<select>` offering
 * team-wide, every monitor of a type, and each individual monitor, grouped by type.
 *
 * All three live in a single control because the scope is a single fact. Split across a
 * type picker and a monitor picker, a form with no JavaScript could be submitted saying
 * "DNS" beside an HTTP monitor's id, and the action would have to decide which half to
 * believe. Encoded into one option value (`~/app/lib/alert-scope`), the contradictory
 * states are not expressible at all, and exactly one option carries `selected`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/async-context-middleware";
import type { Handle } from "remix/ui";

import { Select } from "@pkg/ui";

import type { ScopeMonitorGroup } from "~/app/data/alert-scope-monitors";
import type { AlertScope } from "~/app/lib/alert-scope";

import { encodeAlertScope } from "~/app/lib/alert-scope";
import Field from "~/resources/components/field";

namespace AlertScopeField {
	export interface Props {
		/** The team's monitors, grouped by type; types with no monitors are already omitted. */
		groups: ScopeMonitorGroup[];
		/** The alert's saved scope when editing, or the team-wide default when creating. */
		selected: AlertScope;
		/** The request's i18next instance, used to read the shared `page.alerts.form.fields.*` copy. */
		i18next: ReturnType<typeof getContext>["i18next"];
	}
}

/** Renders the scope picker with one option per scope the team can express. */
export default function AlertScopeField(handle: Handle<AlertScopeField.Props>) {
	return () => {
		let { groups, selected, i18next } = handle.props;

		// The create and edit pages label this field identically, so both read the same
		// shared namespace rather than a per-page one.
		let t = i18next.getFixedT(null, "translation", "page.alerts.form.fields");
		let selectedValue = encodeAlertScope(selected);

		let offered = new Set<string>([""]);
		for (let group of groups) {
			offered.add(encodeAlertScope({ monitorType: group.monitorType, monitorId: null }));
			for (let monitor of group.monitors) {
				offered.add(encodeAlertScope({ monitorType: group.monitorType, monitorId: monitor.id }));
			}
		}

		/**
		 * An alert scoped to a monitor that has since been deleted has no option of its own,
		 * and a `<select>` with nothing selected shows its first one — so saving the form
		 * untouched would quietly widen that alert to every monitor the team has. It gets its
		 * own selected option instead, which says the monitor is gone and fails validation on
		 * save until somebody picks a scope that exists.
		 */
		let danglingValue = offered.has(selectedValue) ? null : selectedValue;

		return (
			<Field label={t("scope.label")} description={t("scope.description")}>
				{/*
				 * `<select>` has no `defaultValue` attribute, so naming the saved scope on the
				 * host renders as inert markup and leaves the first option — team-wide — showing.
				 * The selection is marked on the option itself, and comparing against one encoded
				 * `selectedValue` is what keeps it exactly one option however the scope is stored.
				 */}
				<Select name="scope">
					{danglingValue !== null && (
						<Select.Option value={danglingValue} selected>
							{t("scope.unknownMonitor")}
						</Select.Option>
					)}
					<Select.Option value="" selected={selectedValue === ""}>
						{t("scope.teamWide")}
					</Select.Option>
					{groups.map((group) => {
						let allOfType = encodeAlertScope({
							monitorType: group.monitorType,
							monitorId: null,
						});

						return (
							<Select.Group key={group.monitorType} label={t(`scope.types.${group.monitorType}`)}>
								{[
									<Select.Option key="all" value={allOfType} selected={selectedValue === allOfType}>
										{t(`scope.allOfType.${group.monitorType}`)}
									</Select.Option>,
									...group.monitors.map((monitor) => {
										let value = encodeAlertScope({
											monitorType: group.monitorType,
											monitorId: monitor.id,
										});

										return (
											<Select.Option
												key={monitor.id}
												value={value}
												selected={selectedValue === value}
											>
												{monitor.name}
											</Select.Option>
										);
									}),
								]}
							</Select.Group>
						);
					})}
				</Select>
			</Field>
		);
	};
}
