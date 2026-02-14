import {
	Alert,
	Button,
	Checkbox,
	Description,
	FieldError,
	Input,
	Label,
	LinkButton,
	NumberField,
	Slider,
	TextField,
} from "@pkg/ui";
import { useTranslation } from "react-i18next";
import { href, Link, redirect, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";
import TcpMonitor from "~/models/tcp-monitor";

import type { Route } from "./+types/route";

export async function loader({ params }: Route.LoaderArgs) {
	logger().info("tcpMonitorEdit.loader.start", {
		route: "tcp.$tcpMonitorId.edit",
		tcpMonitorId: params.tcpMonitorId,
		teamId: team().id,
	});

	let tcpMonitor = await TcpMonitor.findByIdAndTeam(db(), params.tcpMonitorId, team().id);

	if (!tcpMonitor) {
		logger().info("tcpMonitorEdit.loader.not-found", {
			route: "tcp.$tcpMonitorId.edit",
			tcpMonitorId: params.tcpMonitorId,
			teamId: team().id,
		});
		return redirect(href("/app/:team/tcp", params));
	}

	logger().info("tcpMonitorEdit.loader.complete", {
		route: "tcp.$tcpMonitorId.edit",
		tcpMonitorId: tcpMonitor.id,
		teamId: team().id,
	});

	return {
		hasActiveSubscription: await hasActiveSubscription(),
		tcpMonitor: {
			id: tcpMonitor.id,
			name: tcpMonitor.name,
			host: tcpMonitor.host,
			port: tcpMonitor.port,
			isEnabled: tcpMonitor.isEnabled,
			timeoutMs: tcpMonitor.timeoutMs,
			intervalSeconds: tcpMonitor.intervalSeconds,
		},
	};
}

export default function EditTcpMonitorPage({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.editTcpMonitor" });
	let { t: tSidebar } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.navigation.items",
	});

	return (
		<>
			<AppHeader
				heading={t("header.title")}
				breadcrumbs={[
					{ label: tSidebar("dashboard"), href: href("/app/:team/dashboard", params) },
					{ label: t("header.breadcrumb.tcpMonitors"), href: href("/app/:team/tcp", params) },
					{
						label: loaderData.tcpMonitor.name,
						href: href("/app/:team/tcp/:tcpMonitorId", {
							team: params.team,
							tcpMonitorId: loaderData.tcpMonitor.id,
						}),
					},
					{ label: t("header.title") },
				]}
			/>

			{loaderData.hasActiveSubscription ? null : (
				<div className="p-4">
					<Alert color="warning">
						<Alert.Content>
							<Alert.Title>{t("alert.subscription.title")}</Alert.Title>
							<Alert.Description>{t("alert.subscription.description")}</Alert.Description>
						</Alert.Content>
						<Alert.Action>
							<Link to={href("/app/:team/checkout", params)}>{t("alert.subscription.cta")}</Link>
						</Alert.Action>
					</Alert>
				</div>
			)}

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				<EditTcpMonitorForm tcpMonitor={loaderData.tcpMonitor} />
			</div>
		</>
	);
}

function EditTcpMonitorForm({
	tcpMonitor,
}: {
	tcpMonitor: {
		id: string;
		name: string;
		host: string;
		port: number;
		isEnabled: boolean;
		timeoutMs: number;
		intervalSeconds: number;
	};
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.editTcpMonitor.form" });

	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let team = useTeam();

	return (
		<fetcher.Form
			method="POST"
			className="mx-auto flex w-full max-w-prose flex-col gap-6"
			action={href("/actions/:team/update-tcp-monitor", { team: team.slug })}
		>
			<input type="hidden" name="tcpMonitorId" value={tcpMonitor.id} />

			<TextField type="text" name="name" isRequired defaultValue={tcpMonitor.name}>
				<Label>{t("fields.name.label")}</Label>
				<Input placeholder={t("fields.name.placeholder")} />
				<FieldError />
				<Description>{t("fields.name.description")}</Description>
			</TextField>

			<TextField type="text" name="host" isRequired defaultValue={tcpMonitor.host}>
				<Label>{t("fields.host.label")}</Label>
				<Input placeholder={t("fields.host.placeholder")} />
				<FieldError />
				<Description>{t("fields.host.description")}</Description>
			</TextField>

			<NumberField
				name="port"
				isRequired
				minValue={1}
				maxValue={65535}
				defaultValue={tcpMonitor.port}
			>
				<Label>{t("fields.port.label")}</Label>
				<NumberField.Group>
					<NumberField.DecrementButton />
					<NumberField.Input />
					<NumberField.IncrementButton />
				</NumberField.Group>
				<FieldError />
				<Description>{t("fields.port.description")}</Description>
			</NumberField>

			<Slider
				minValue={1}
				maxValue={60}
				step={1}
				defaultValue={tcpMonitor.intervalSeconds / 60}
				formatOptions={{
					style: "unit",
					unit: "minute",
					unitDisplay: "narrow",
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				}}
			>
				<div className="flex justify-between">
					<Label>{t("fields.interval.label")}</Label>
					<Slider.Output />
				</div>
				<Slider.Track>
					<Slider.Thumb name="intervalSeconds" />
				</Slider.Track>
				<div className="flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
					<span>1m</span>
					<span>60m</span>
				</div>
				<Description>{t("fields.interval.description")}</Description>
			</Slider>

			<Slider
				minValue={1}
				maxValue={30}
				step={1}
				defaultValue={tcpMonitor.timeoutMs / 1000}
				formatOptions={{
					style: "unit",
					unit: "second",
					unitDisplay: "narrow",
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				}}
			>
				<div className="flex justify-between">
					<Label>{t("fields.timeout.label")}</Label>
					<Slider.Output />
				</div>
				<Slider.Track>
					<Slider.Thumb name="timeoutMs" />
				</Slider.Track>
				<div className="flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
					<span>1s</span>
					<span>30s</span>
				</div>
				<Description>{t("fields.timeout.description")}</Description>
			</Slider>

			<Checkbox name="isEnabled" defaultSelected={tcpMonitor.isEnabled}>
				{t("fields.isEnabled.label")}
			</Checkbox>

			<div className="flex justify-end gap-2">
				<LinkButton
					color="neutral"
					href={href("/app/:team/tcp/:tcpMonitorId", {
						team: team.slug,
						tcpMonitorId: tcpMonitor.id,
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
