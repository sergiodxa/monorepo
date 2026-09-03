/**
 * Shared flow monitor form fields, used by the new-monitor and edit-monitor views. A new
 * monitor is always created enabled, so the toggle only renders when editing. The interval
 * control lists a flow's seven fixed cadences explicitly (ADR-027 §7a), since each carries
 * its own cost. Verified domains render beside the source since they answer what a spec
 * written here may reach.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/middleware/async-context";
import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { m } from "@sdxc/u/size";
import { font, fontSize } from "@sdxc/u/typography";
import { Select, Switch, TextArea, TextField } from "@sdxc/ui";

import type { SelectFlowMonitor } from "~/database/schema";

import { DEFAULT_FLOW_INTERVAL_SECONDS, FLOW_INTERVALS_SECONDS } from "~/app/lib/pricing";
import Field from "~/resources/components/field";

namespace FlowMonitorFormFields {
	export interface Props {
		/** Existing monitor values when editing; omitted when creating. */
		monitor?: SelectFlowMonitor;
		/** The team's verified hostnames — what a spec written here may reach. */
		verifiedDomains: readonly string[];
		/** The request's i18next instance, used to read this page's `form.fields.*` copy. */
		i18next: ReturnType<typeof getContext>["i18next"];
		/** Which page is rendering these fields, selecting the `page.<page>.form.fields.*` keys. */
		page: "createFlowMonitor" | "editFlowMonitor";
	}
}

/** Renders the name/source/interval fields (plus an enabled toggle when editing). */
export default function FlowMonitorFormFields(handle: Handle<FlowMonitorFormFields.Props>) {
	return () => {
		let { monitor, verifiedDomains, i18next, page } = handle.props;
		let t = i18next.getFixedT(null, "translation", `page.${page}.form.fields`);
		let selectedInterval = monitor?.interval_seconds ?? DEFAULT_FLOW_INTERVAL_SECONDS;

		return (
			<>
				<TextField
					type="text"
					name="name"
					required
					defaultValue={monitor?.name}
					label={t("name.label")}
					placeholder={t("name.placeholder")}
					description={t("name.description")}
				/>

				<Field label={t("source.label")} description={t("source.description")}>
					<TextArea
						name="source"
						required
						rows={16}
						spellcheck={false}
						defaultValue={monitor?.source}
						placeholder={t("source.placeholder")}
						mix={[font("mono"), fontSize("sm")]}
					/>
				</Field>

				<p mix={[m(0), fontSize("sm"), fg(verifiedDomains.length === 0 ? "danger" : "muted")]}>
					{verifiedDomains.length === 0
						? t("source.noVerifiedDomains")
						: t("source.verifiedDomains", { domains: verifiedDomains.join(", ") })}
				</p>

				<Field label={t("interval.label")} description={t("interval.description")}>
					<Select name="interval_seconds" required>
						{FLOW_INTERVALS_SECONDS.map((seconds) => (
							<Select.Option
								key={seconds}
								value={String(seconds)}
								selected={seconds === selectedInterval}
							>
								{t(`interval.options.${seconds}`)}
							</Select.Option>
						))}
					</Select>
				</Field>

				{monitor && (
					<Switch name="is_enabled" value="true" defaultChecked={monitor.is_enabled}>
						{t("isEnabled.label")}
					</Switch>
				)}
			</>
		);
	};
}
