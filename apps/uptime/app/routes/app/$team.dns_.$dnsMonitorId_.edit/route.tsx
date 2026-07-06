/**
 * Route for editing an existing DNS monitor. The loader loads the monitor scoped to the current
 * team, throwing a 404 if it is missing; the component renders a form to update name, domain,
 * record type, expected value, check interval, and enabled state before posting to the update
 * action. It exists so teams can reconfigure their DNS monitors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	Button,
	Description,
	FieldError,
	Input,
	Label,
	LinkButton,
	ListBox,
	NumberField,
	Popover,
	Select,
	Switch,
	TextField,
} from "@pkg/ui";
import { useState } from "react";
import { type Key } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { data, href, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

export async function loader({ params }: Route.LoaderArgs) {
	logger().info("dnsMonitorEdit.loader.start", {
		route: "dns.$dnsMonitorId.edit",
		dnsMonitorId: params.dnsMonitorId,
		teamId: team().id,
	});

	let dnsMonitor = await db().query.dnsMonitors.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.dnsMonitorId),
				operators.eq(fields.teamId, team().id),
			);
		},
	});

	if (!dnsMonitor) {
		logger().info("dnsMonitorEdit.loader.not-found", {
			route: "dns.$dnsMonitorId.edit",
			dnsMonitorId: params.dnsMonitorId,
			teamId: team().id,
		});
		throw data({ message: "DNS Monitor not found" }, { status: 404 });
	}

	logger().info("dnsMonitorEdit.loader.complete", {
		route: "dns.$dnsMonitorId.edit",
		dnsMonitorId: dnsMonitor.id,
		teamId: team().id,
	});

	return { dnsMonitor };
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.editDnsMonitor" });
	let { t: tSidebar } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.navigation.items",
	});

	return (
		<>
			<AppHeader
				heading={t("header.title")}
				breadcrumbs={[
					{ label: tSidebar("dnsMonitors"), href: href("/app/:team/dns", params) },
					{
						label: loaderData.dnsMonitor.name,
						href: href("/app/:team/dns/:dnsMonitorId", {
							team: params.team,
							dnsMonitorId: params.dnsMonitorId,
						}),
					},
					{ label: t("header.title") },
				]}
			/>

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				<EditDnsMonitorForm dnsMonitor={loaderData.dnsMonitor} />
			</div>
		</>
	);
}

function EditDnsMonitorForm(props: {
	dnsMonitor: Route.ComponentProps["loaderData"]["dnsMonitor"];
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.editDnsMonitor.form" });
	let team = useTeam();

	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let [recordType, setRecordType] = useState<Key>(props.dnsMonitor.recordType);
	let [intervalSeconds, setIntervalSeconds] = useState<number>(props.dnsMonitor.intervalSeconds);

	let recordTypes = [
		{ id: "A", name: "A" },
		{ id: "AAAA", name: "AAAA" },
		{ id: "CNAME", name: "CNAME" },
		{ id: "MX", name: "MX" },
		{ id: "TXT", name: "TXT" },
		{ id: "NS", name: "NS" },
	] as const;

	let intervalOptions = [
		{ id: 300, name: t("fields.interval.options.5m") },
		{ id: 900, name: t("fields.interval.options.15m") },
		{ id: 1800, name: t("fields.interval.options.30m") },
		{ id: 3600, name: t("fields.interval.options.1h") },
		{ id: 21600, name: t("fields.interval.options.6h") },
		{ id: 43200, name: t("fields.interval.options.12h") },
		{ id: 86400, name: t("fields.interval.options.24h") },
	] as const;

	return (
		<fetcher.Form
			method="POST"
			action={href("/actions/:team/update-dns-monitor", { team: team.slug })}
			className="mx-auto flex w-full max-w-prose flex-col gap-6"
		>
			<input type="hidden" name="dnsMonitorId" value={props.dnsMonitor.id} />

			<TextField name="name" isRequired defaultValue={props.dnsMonitor.name}>
				<Label>{t("fields.name.label")}</Label>
				<Input placeholder={t("fields.name.placeholder")} />
				<Description>{t("fields.name.description")}</Description>
				<FieldError />
			</TextField>

			<TextField name="domain" isRequired defaultValue={props.dnsMonitor.domain}>
				<Label>{t("fields.domain.label")}</Label>
				<Input placeholder={t("fields.domain.placeholder")} />
				<Description>{t("fields.domain.description")}</Description>
				<FieldError />
			</TextField>

			<Select
				name="recordType"
				isRequired
				selectedKey={recordType}
				onSelectionChange={(key) => key && setRecordType(key)}
			>
				<Label>{t("fields.recordType.label")}</Label>
				<Select.Trigger />
				<FieldError />
				<Description>{t("fields.recordType.description")}</Description>
				<Popover>
					<ListBox items={recordTypes}>
						{(item) => <Select.Item id={item.id}>{item.name}</Select.Item>}
					</ListBox>
				</Popover>
			</Select>

			<TextField name="expectedValue" defaultValue={props.dnsMonitor.expectedValue ?? ""}>
				<Label>{t("fields.expectedValue.label")}</Label>
				<Input placeholder={t("fields.expectedValue.placeholder")} />
				<Description>{t("fields.expectedValue.description")}</Description>
				<FieldError />
			</TextField>

			<NumberField
				name="intervalSeconds"
				value={intervalSeconds}
				onChange={(value) => !Number.isNaN(value) && setIntervalSeconds(value)}
				minValue={300}
				maxValue={86400}
			>
				<Label>{t("fields.interval.label")}</Label>
				<Select
					aria-label={t("fields.interval.label")}
					selectedKey={intervalSeconds}
					onSelectionChange={(key) => key && setIntervalSeconds(Number(key))}
				>
					<Select.Trigger />
					<Popover>
						<ListBox items={intervalOptions}>
							{(item) => <Select.Item id={item.id}>{item.name}</Select.Item>}
						</ListBox>
					</Popover>
				</Select>
				<Description>{t("fields.interval.description")}</Description>
				<FieldError />
			</NumberField>

			<div className="flex flex-col gap-1">
				<Switch name="isEnabled" defaultSelected={props.dnsMonitor.isEnabled}>
					<span className="font-medium">{t("fields.isEnabled.label")}</span>
				</Switch>
				<Description className="text-sm text-neutral-500 dark:text-neutral-400">
					{t("fields.isEnabled.description")}
				</Description>
			</div>

			<div className="flex justify-end gap-2">
				<LinkButton
					color="neutral"
					href={href("/app/:team/dns/:dnsMonitorId", {
						team: team.slug,
						dnsMonitorId: props.dnsMonitor.id,
					})}
				>
					{t("cancel")}
				</LinkButton>
				<Button type="submit" isPending={isPending}>
					{t("cta")}
				</Button>
			</div>
		</fetcher.Form>
	);
}
