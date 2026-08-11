/**
 * The DNS monitor fields that describe the monitor itself — its name, its domain, how often
 * it is swept, and whether it runs. Reads its copy from `page.<page>.form.fields.*` through
 * `i18next.getFixedT`, so a page rendering them doesn't duplicate the field markup or
 * hardcode English strings. Fields are composed from `@pkg/ui`'s `TextField`/`Select`
 * directly, wrapping `Select` in this app's own `Field` for its label/description since
 * `Select`, unlike `TextField`, doesn't bundle one; "Enabled" goes through `@pkg/ui`'s
 * `Switch` directly, with an explicit `value="true"` since a native checkbox otherwise
 * submits `"on"`.
 *
 * A monitor covers a whole domain, so there is no record type to pick and no expected value
 * to transcribe: the expectation is imported from the zone and reviewed.
 *
 * **The zone-file paste is deliberately not one of these fields.** It is not a setting the
 * monitor holds — the pasted text is read once and never stored — so it is submitted with
 * the monitor on creation and re-submitted on its own afterwards, to a different action,
 * under different copy, with no value to pre-fill. Sharing markup between those two would
 * mean a field whose meaning changes with its host, which is what this module exists to
 * avoid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/async-context-middleware";
import type { Handle } from "remix/ui";

import { Select, Switch, TextField } from "@pkg/ui";

import type { SelectDnsMonitor } from "~/database/schema";

import Field from "~/resources/components/field";

/**
 * How often every tracked name is resolved, in seconds, paired with the locale key naming
 * each span.
 *
 * The list floors at 900 rather than at the 300 the other monitor types offer: a domain
 * monitor sweeps every supported type at every known name, so a faster cadence buys
 * detection latency the records' own TTLs put a floor under anyway, and it is not a bound a
 * form should put one click away.
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

/** Renders the name/domain/interval/enabled fields, pre-filled from `monitor` when editing. */
export default function DnsMonitorFormFields(handle: Handle<DnsMonitorFormFields.Props>) {
	return () => {
		let { monitor, i18next, page } = handle.props;
		let t = i18next.getFixedT(null, "translation", `page.${page}.form.fields`);

		// Daily, because DNS changes are human-caused and human-paced.
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
					{/*
					 * The saved interval is marked `selected` on its own `<option>`: `<select>` has
					 * no `defaultValue` attribute, so spelling it on the host renders as inert
					 * markup and leaves the first option showing, which on the edit page would
					 * silently rewrite a daily monitor into a 5-minute one on the next save. The
					 * comparison is deliberately between numbers
					 * — the saved column and the option value are both numeric, and only the
					 * rendered attribute is a string — so an interval is never matched by
					 * coercion.
					 */}
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
