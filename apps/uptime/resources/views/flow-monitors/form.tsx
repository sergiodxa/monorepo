/**
 * Shared flow monitor form fields, used by the new-monitor and edit-monitor pages and by the
 * actions that re-render them after a failed submit. Every field reads its value from
 * `values`, so a rejected submission comes back as typed with each field's issue beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Form } from "@sdxc/ui";
import type { Handle } from "remix/component";
import type { getContext } from "remix/middleware/async-context";

import { fg } from "@sdxc/u/color";
import { m } from "@sdxc/u/size";
import { font, fontSize } from "@sdxc/u/typography";
import { Select, Switch, TextArea, TextField } from "@sdxc/ui";

import { withPrefix } from "~/app/services/prefixed-translate";
import { DEFAULT_FLOW_INTERVAL_SECONDS, FLOW_INTERVALS_SECONDS } from "~/config/pricing";
import Field from "~/resources/components/field";

/** What the form shows in each field: a stored monitor's values, or what was just submitted. */
export interface FlowMonitorFormValues {
	name: string;
	source: string;
	interval_seconds: number;
	is_enabled: boolean;
}

/** A rejected submit: what was typed, and the translated issues the form shows beside it. */
export interface FlowMonitorFormState {
	values: FlowMonitorFormValues;
	issues: readonly Form.Issue[];
}

/** The values a new monitor starts from: empty, at the default interval, enabled. */
export const NEW_FLOW_MONITOR_VALUES: FlowMonitorFormValues = {
	name: "",
	source: "",
	interval_seconds: DEFAULT_FLOW_INTERVAL_SECONDS,
	is_enabled: true,
};

namespace FlowMonitorFormFields {
	export interface Props {
		values: FlowMonitorFormValues;
		/** Issues from a rejected submit, for the fields whose control reads no form context. */
		issues?: readonly Form.Issue[];
		/** Shows the enabled toggle, which only editing offers since a new monitor starts enabled. */
		showEnabled?: boolean;
		/** The team's verified hostnames — what a spec written here may reach. */
		verifiedDomains: readonly string[];
		/** The request's translator, used to read this page's `form.fields.*` copy. */
		intl: ReturnType<typeof getContext>["intl"];
		/** Which page is rendering these fields, selecting the `page.<page>.form.fields.*` keys. */
		page: "createFlowMonitor" | "editFlowMonitor";
	}
}

/** Renders the name/source/interval fields (plus an enabled toggle when editing). */
export default function FlowMonitorFormFields(handle: Handle<FlowMonitorFormFields.Props>) {
	return () => {
		let { values, issues = [], showEnabled, verifiedDomains, intl, page } = handle.props;
		let t = withPrefix(intl.t, `page.${page}.form.fields`);
		let issueFor = (name: string) => issues.find((issue) => issue.path?.[0] === name)?.message;

		return (
			<>
				<TextField
					type="text"
					name="name"
					required
					defaultValue={values.name}
					label={t("name.label")}
					placeholder={t("name.placeholder")}
					description={t("name.description")}
				/>

				<Field
					label={t("source.label")}
					description={t("source.description")}
					error={issueFor("source")}
				>
					<TextArea
						name="source"
						required
						rows={16}
						spellcheck={false}
						defaultValue={values.source}
						placeholder={t("source.placeholder")}
						mix={[font("mono"), fontSize("sm")]}
					/>
				</Field>

				<p mix={[m(0), fontSize("sm"), fg(verifiedDomains.length === 0 ? "danger" : "muted")]}>
					{verifiedDomains.length === 0
						? t("source.noVerifiedDomains")
						: t("source.verifiedDomains", { domains: verifiedDomains.join(", ") })}
				</p>

				<Field
					label={t("interval.label")}
					description={t("interval.description")}
					error={issueFor("interval_seconds")}
				>
					<Select name="interval_seconds" required>
						{FLOW_INTERVALS_SECONDS.map((seconds) => (
							<Select.Option
								key={seconds}
								value={String(seconds)}
								selected={seconds === values.interval_seconds}
							>
								{t(`interval.options.${seconds}`)}
							</Select.Option>
						))}
					</Select>
				</Field>

				{showEnabled && (
					<Switch name="is_enabled" value="true" defaultChecked={values.is_enabled}>
						{t("isEnabled.label")}
					</Switch>
				)}
			</>
		);
	};
}
