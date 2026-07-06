/**
 * Route for creating a new DNS monitor for a team. It renders a form for the monitor name,
 * domain, DNS record type (A, AAAA, CNAME, MX, TXT, NS), an optional expected value, a
 * check interval chosen from preset durations, and an enabled toggle, posting to the
 * create-dns-monitor action. Exists to let teams watch a domain's DNS records for expected
 * values.
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
import { href, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";

import type { Route } from "./+types/route";

export default function Component({ params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.createDnsMonitor" });
	let { t: tSidebar } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.navigation.items",
	});

	return (
		<>
			<AppHeader
				heading={t("header.title")}
				breadcrumbs={[
					{ label: tSidebar("dnsMonitors"), href: href("/app/:team/dns", params) },
					{ label: t("header.title") },
				]}
			/>

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				<CreateDnsMonitorForm />
			</div>
		</>
	);
}

function CreateDnsMonitorForm() {
	let { t } = useTranslation("translation", { keyPrefix: "page.createDnsMonitor.form" });
	let team = useTeam();

	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let [recordType, setRecordType] = useState<Key>("A");
	let [intervalSeconds, setIntervalSeconds] = useState<number>(3600);

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
			action={href("/actions/:team/create-dns-monitor", { team: team.slug })}
			className="mx-auto flex w-full max-w-prose flex-col gap-6"
		>
			<TextField name="name" isRequired>
				<Label>{t("fields.name.label")}</Label>
				<Input placeholder={t("fields.name.placeholder")} />
				<Description>{t("fields.name.description")}</Description>
				<FieldError />
			</TextField>

			<TextField name="domain" isRequired>
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

			<TextField name="expectedValue">
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
				<Switch name="isEnabled" defaultSelected>
					<span className="font-medium">{t("fields.isEnabled.label")}</span>
				</Switch>
				<Description className="text-sm text-neutral-500 dark:text-neutral-400">
					{t("fields.isEnabled.description")}
				</Description>
			</div>

			<Button type="submit" className="self-end" isPending={isPending}>
				{t("cta")}
			</Button>
		</fetcher.Form>
	);
}
