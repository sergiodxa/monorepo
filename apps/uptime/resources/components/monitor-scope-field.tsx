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

import type { Handle } from "remix/component";
import type { getContext } from "remix/middleware/async-context";

import { Select } from "@sdxc/ui";

import type { MonitorScope } from "~/app/lib/monitor-scope";
import type { ScopeMonitorGroup } from "~/app/services/scope-monitors";

import { encodeMonitorScope } from "~/app/lib/monitor-scope";
import { withPrefix } from "~/app/lib/prefixed-translate";
import Field from "~/resources/components/field";

namespace MonitorScopeField {
	export interface Props {
		/** The team's monitors, grouped by type; types with no monitors are already omitted. */
		groups: ScopeMonitorGroup[];
		/** The row's saved scope when editing, or the team-wide default when creating. */
		selected: MonitorScope;
		/** What narrowing the scope means on the form rendering it, in the page's own words. */
		description: string;
		/** The request's translator, used to read the shared `components.monitorScope.*` copy. */
		intl: ReturnType<typeof getContext>["intl"];
	}
}

/**
 * Renders the scope picker with one option per scope the team can express.
 * `<select>` takes no `defaultValue`, so the saved scope is marked by giving
 * exactly one option a `selected` prop instead, however that scope is stored.
 */
export default function MonitorScopeField(handle: Handle<MonitorScopeField.Props>) {
	return () => {
		let { groups, selected, description, intl } = handle.props;

		let t = withPrefix(intl.t, "components.monitorScope");
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
