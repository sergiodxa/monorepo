/**
 * The DNS monitor's name/domain/interval/enabled fields, reading copy from
 * `page.<page>.form.fields.*`. A monitor covers a whole domain, so there is no record type or
 * expected value here — those are derived from the zone at review time. The zone-file paste
 * is deliberately kept separate: it is read once, for a single request, and submitted under
 * its own action and copy, through markup of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/middleware/async-context";
import type { Handle } from "remix/ui";

import { Select, Switch, TextField } from "@sdxc/ui";

import type { SelectDnsMonitor } from "~/database/schema";

import Field from "~/resources/components/field";

/**
 * How often every tracked name is resolved, in seconds, paired with each option's locale key.
 * Floors at 900 seconds: other monitor types go as low as 300, but a full-zone sweep already
 * pushes detection latency against the records' own TTLs, making 900 seconds the useful floor.
 */
const INTERVAL_OPTIONS = [
	{ value: 900, key: "15m" },
	{ value: 1800, key: "30m" },
	{ value: 3600, key: "1h" },
	{ value: 21_600, key: "6h" },
	{ value: 43_200, key: "12h" },
	{ value: 86_400, key: "24h" },
] as const;

namespace DnsMonitorFormFields {
	export interface Props {
		/** Existing monitor values when editing; omitted when creating. */
		monitor?: SelectDnsMonitor;
		/** The request's i18next instance, used to read this page's `form.fields.*` copy. */
		i18next: ReturnType<typeof getContext>["i18next"];
		/** Which page is rendering these fields, selecting the `page.<page>.form.fields.*` keys to read. */
		page: "createDnsMonitor" | "editDnsMonitor";
	}
}

/**
 * Renders the name/domain/interval/enabled fields, pre-filled from `monitor` when editing.
 * Defaults the interval to daily, since DNS changes are human-paced, and selects the saved
 * option explicitly — comparing values as numbers — since `<select>` ignores `defaultValue`.
 */
export default function DnsMonitorFormFields(handle: Handle<DnsMonitorFormFields.Props>) {
	return () => {
		let { monitor, i18next, page } = handle.props;
		let t = i18next.getFixedT(null, "translation", `page.${page}.form.fields`);

		let intervalSeconds = monitor?.interval_seconds ?? 86_400;

		return (
			<>
				<TextField
					label={t("name.label")}
					description={t("name.description")}
					name="name"
					required
					defaultValue={monitor?.name}
					placeholder={t("name.placeholder")}
				/>

				<TextField
					label={t("domain.label")}
					description={t("domain.description")}
					name="domain"
					required
					defaultValue={monitor?.domain}
					placeholder={t("domain.placeholder")}
				/>

				<Field label={t("interval.label")} description={t("interval.description")}>
					<Select name="interval_seconds">
						{INTERVAL_OPTIONS.map((option) => (
							<Select.Option
								key={option.value}
								value={option.value}
								selected={option.value === intervalSeconds}
							>
								{t(`interval.options.${option.key}`)}
							</Select.Option>
						))}
					</Select>
				</Field>

				<Switch name="is_enabled" value="true" defaultChecked={monitor?.is_enabled ?? true}>
					{t("isEnabled.label")}
				</Switch>
			</>
		);
	};
}
