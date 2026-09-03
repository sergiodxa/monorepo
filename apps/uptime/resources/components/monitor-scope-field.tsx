/**
 * The "Scope" field shared by the alert and maintenance-window create and edit
 * forms: one `<select>` offering team-wide, every monitor of a type, and each
 * individual monitor, grouped by type. All three live in a single control
 * because the scope is a single fact — split across a type picker and a
 * monitor picker, a no-JavaScript submit could pair "DNS" with an HTTP
 * monitor's id, and encoding it as one option value keeps that contradiction
 * unrepresentable. Option copy comes from one `components.monitorScope`
 * namespace, since a monitor type is named the same wherever it is offered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/middleware/async-context";
import type { Handle } from "remix/ui";

import { Select } from "@sdxc/ui";

import type { ScopeMonitorGroup } from "~/app/data/scope-monitors";
import type { MonitorScope } from "~/app/lib/monitor-scope";

import { encodeMonitorScope } from "~/app/lib/monitor-scope";
import Field from "~/resources/components/field";

namespace MonitorScopeField {
	export interface Props {
		/** The team's monitors, grouped by type; types with no monitors are already omitted. */
		groups: ScopeMonitorGroup[];
		/** The row's saved scope when editing, or the team-wide default when creating. */
		selected: MonitorScope;
		/** What narrowing the scope means on the form rendering it, in the page's own words. */
		description: string;
		/** The request's i18next instance, used to read the shared `components.monitorScope.*` copy. */
		i18next: ReturnType<typeof getContext>["i18next"];
	}
}

/**
 * Renders the scope picker with one option per scope the team can express.
 * `<select>` takes no `defaultValue`, so the saved scope is marked by giving
 * exactly one option a `selected` prop instead, however that scope is stored.
 */
export default function MonitorScopeField(handle: Handle<MonitorScopeField.Props>) {
	return () => {
		let { groups, selected, description, i18next } = handle.props;

		let t = i18next.getFixedT(null, "translation", "components.monitorScope");
		let selectedValue = encodeMonitorScope(selected);

		let offered = new Set<string>([""]);
		for (let group of groups) {
			offered.add(encodeMonitorScope({ monitorType: group.monitorType, monitorId: null }));
			for (let monitor of group.monitors) {
				offered.add(encodeMonitorScope({ monitorType: group.monitorType, monitorId: monitor.id }));
			}
		}

		/**
		 * A since-deleted monitor's scope has no option of its own, and a `<select>` with
		 * nothing selected shows its first — silently widening an untouched save to every
		 * monitor. This value marks the row unknown instead, failing validation until fixed.
		 */
		let danglingValue = offered.has(selectedValue) ? null : selectedValue;

		return (
			<Field label={t("label")} description={description}>
				<Select name="scope">
					{danglingValue !== null && (
						<Select.Option value={danglingValue} selected>
							{t("unknownMonitor")}
						</Select.Option>
					)}
					<Select.Option value="" selected={selectedValue === ""}>
						{t("teamWide")}
					</Select.Option>
					{groups.map((group) => {
						let allOfType = encodeMonitorScope({
							monitorType: group.monitorType,
							monitorId: null,
						});

						return (
							<Select.Group key={group.monitorType} label={t(`types.${group.monitorType}`)}>
								{[
									<Select.Option key="all" value={allOfType} selected={selectedValue === allOfType}>
										{t(`allOfType.${group.monitorType}`)}
									</Select.Option>,
									...group.monitors.map((monitor) => {
										let value = encodeMonitorScope({
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
