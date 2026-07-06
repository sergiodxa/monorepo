/**
 * Route for creating a new maintenance window. The loader lists the team's monitors to populate
 * a target selector; the component renders a form with a start date-time picker, a duration
 * select that derives the end time, an optional recurrence pattern, and switches for
 * suppressing alerts and showing on the status page, handling hydration so the initial time
 * matches the client. It exists to let teams schedule planned downtime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CalendarDateTime, getLocalTimeZone, now } from "@internationalized/date";
import {
	Button,
	DatePicker,
	Description,
	FieldError,
	Input,
	Label,
	ListBox,
	Popover,
	Select,
	Switch,
	TextField,
} from "@pkg/ui";
import { useEffect, useState } from "react";
import { type Key } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { href, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

export async function loader() {
	logger().info("maintenanceNew.loader.start", {
		route: "maintenance.new",
		teamId: team().id,
	});

	let monitors = await db().query.monitors.findMany({
		columns: { id: true, name: true },
		where(fields, operators) {
			return operators.eq(fields.teamId, team().id);
		},
		orderBy(fields, operators) {
			return operators.asc(fields.name);
		},
	});

	logger().info("maintenanceNew.loader.complete", {
		route: "maintenance.new",
		teamId: team().id,
		monitorsCount: monitors.length,
	});

	return { monitors };
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.createMaintenance" });
	let { t: tSidebar } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.navigation.items",
	});

	return (
		<>
			<AppHeader
				heading={t("header.title")}
				breadcrumbs={[
					{ label: tSidebar("maintenance"), href: href("/app/:team/maintenance", params) },
					{ label: t("header.title") },
				]}
			/>

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				<CreateMaintenanceForm monitors={loaderData.monitors} />
			</div>
		</>
	);
}

function CreateMaintenanceForm(props: { monitors: Array<{ id: string; name: string }> }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.createMaintenance.form" });
	let team = useTeam();

	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let [selectedMonitor, setSelectedMonitor] = useState<Key | null>(null);
	let [duration, setDuration] = useState<Key>("1h");
	let [isRecurring, setIsRecurring] = useState(false);
	let [isHydrated, setIsHydrated] = useState(false);

	let timeZone = getLocalTimeZone();

	// Use a fixed initial value to avoid hydration mismatch, then update after hydration
	let [startsAt, setStartsAt] = useState<CalendarDateTime>(
		() => new CalendarDateTime(2000, 1, 1, 0, 0),
	);

	useEffect(() => {
		let currentTime = now(timeZone);
		setStartsAt(
			new CalendarDateTime(
				currentTime.year,
				currentTime.month,
				currentTime.day,
				currentTime.hour,
				currentTime.minute,
			),
		);
		setIsHydrated(true);
	}, [timeZone]);

	// Calculate end time based on duration
	function getEndsAt() {
		let durationMinutes =
			{
				"15m": 15,
				"30m": 30,
				"1h": 60,
				"2h": 120,
				"4h": 240,
				"8h": 480,
				custom: 60,
			}[duration as string] ?? 60;

		return startsAt.add({ minutes: durationMinutes });
	}

	let endsAt = getEndsAt();

	let monitorOptions = [
		{ id: "all", name: t("fields.monitor.all") },
		...props.monitors.map((m) => ({ id: m.id, name: m.name })),
	];

	let durationOptions = [
		{ id: "15m", name: t("fields.duration.options.15m") },
		{ id: "30m", name: t("fields.duration.options.30m") },
		{ id: "1h", name: t("fields.duration.options.1h") },
		{ id: "2h", name: t("fields.duration.options.2h") },
		{ id: "4h", name: t("fields.duration.options.4h") },
		{ id: "8h", name: t("fields.duration.options.8h") },
	];

	return (
		<fetcher.Form
			method="POST"
			action={href("/actions/:team/create-maintenance", { team: team.slug })}
			className="mx-auto flex w-full max-w-prose flex-col gap-6"
		>
			<TextField type="text" name="name" isRequired>
				<Label>{t("fields.name.label")}</Label>
				<Input placeholder={t("fields.name.placeholder")} />
				<Description>{t("fields.name.description")}</Description>
				<FieldError />
			</TextField>

			<Select selectedKey={selectedMonitor} onSelectionChange={(key) => setSelectedMonitor(key)}>
				<Label>{t("fields.monitor.label")}</Label>
				<Select.Trigger />
				<FieldError />
				<Description>{t("fields.monitor.description")}</Description>
				<Popover>
					<ListBox items={monitorOptions}>
						{(item) => <Select.Item id={item.id}>{item.name}</Select.Item>}
					</ListBox>
				</Popover>
			</Select>
			{selectedMonitor && selectedMonitor !== "all" && (
				<input type="hidden" name="monitorId" value={selectedMonitor.toString()} />
			)}

			<DatePicker
				name="startsAt"
				granularity="minute"
				value={startsAt}
				onChange={(value) => value && setStartsAt(value)}
			>
				<Label>{t("fields.startsAt.label")}</Label>
				<DatePicker.Trigger />
				<FieldError />
				<Description>{t("fields.startsAt.description")}</Description>
			</DatePicker>
			<input type="hidden" name="startsAt" value={startsAt.toDate(timeZone).toISOString()} />

			<Select selectedKey={duration} onSelectionChange={(key) => key && setDuration(key)}>
				<Label>{t("fields.duration.label")}</Label>
				<Select.Trigger />
				<FieldError />
				<Description>{t("fields.duration.description")}</Description>
				<Popover>
					<ListBox items={durationOptions}>
						{(item) => <Select.Item id={item.id}>{item.name}</Select.Item>}
					</ListBox>
				</Popover>
			</Select>
			<input type="hidden" name="endsAt" value={endsAt.toDate(timeZone).toISOString()} />

			{isHydrated && (
				<div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
					<p className="text-sm text-neutral-600 dark:text-neutral-400">
						{t("preview.label")}:{" "}
						<span className="font-medium text-neutral-900 dark:text-neutral-100">
							{startsAt.toDate(timeZone).toLocaleString()} -{" "}
							{endsAt.toDate(timeZone).toLocaleString()}
						</span>
					</p>
				</div>
			)}

			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-1">
					<Switch name="suppressAlerts" defaultSelected>
						<span className="font-medium">{t("fields.suppressAlerts.label")}</span>
					</Switch>
					<Description className="text-sm text-neutral-500 dark:text-neutral-400">
						{t("fields.suppressAlerts.description")}
					</Description>
				</div>

				<div className="flex flex-col gap-1">
					<Switch name="showOnStatusPage" defaultSelected>
						<span className="font-medium">{t("fields.showOnStatusPage.label")}</span>
					</Switch>
					<Description className="text-sm text-neutral-500 dark:text-neutral-400">
						{t("fields.showOnStatusPage.description")}
					</Description>
				</div>

				<div className="flex flex-col gap-1">
					<Switch name="isRecurring" isSelected={isRecurring} onChange={setIsRecurring}>
						<span className="font-medium">{t("fields.isRecurring.label")}</span>
					</Switch>
					<Description className="text-sm text-neutral-500 dark:text-neutral-400">
						{t("fields.isRecurring.description")}
					</Description>
				</div>

				{isRecurring && (
					<TextField type="text" name="recurringPattern">
						<Label>{t("fields.recurringPattern.label")}</Label>
						<Input placeholder={t("fields.recurringPattern.placeholder")} />
						<Description>{t("fields.recurringPattern.description")}</Description>
						<FieldError />
					</TextField>
				)}
			</div>

			<Button type="submit" className="self-end" isPending={isPending}>
				{t("cta")}
			</Button>
		</fetcher.Form>
	);
}
