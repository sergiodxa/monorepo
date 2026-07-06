/**
 * Route module for creating a new TCP monitor. Its loader surfaces the team's subscription
 * status, and the page renders a form capturing the monitor name, host, port, check interval,
 * and connection timeout before posting to the create-tcp-monitor action. It exists so teams
 * can set up port-level connectivity monitoring for a host.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	Alert,
	Button,
	Description,
	FieldError,
	Input,
	Label,
	NumberField,
	Slider,
	TextField,
} from "@pkg/ui";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

export async function loader() {
	logger().info("tcpMonitorNew.loader.start", {
		route: "tcp.new",
		teamId: team().id,
	});

	let activeSubscription = await hasActiveSubscription();

	logger().info("tcpMonitorNew.loader.complete", {
		route: "tcp.new",
		teamId: team().id,
		hasActiveSubscription: activeSubscription,
	});

	return { hasActiveSubscription: activeSubscription };
}

export default function CreateTcpMonitorPage({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.createTcpMonitor" });
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
				<CreateTcpMonitorForm />
			</div>
		</>
	);
}

function CreateTcpMonitorForm() {
	let { t } = useTranslation("translation", { keyPrefix: "page.createTcpMonitor.form" });

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
			action={href("/actions/:team/create-tcp-monitor", { team: team.slug })}
		>
			<TextField type="text" name="name" isRequired>
				<Label>{t("fields.name.label")}</Label>
				<Input placeholder={t("fields.name.placeholder")} />
				<FieldError />
				<Description>{t("fields.name.description")}</Description>
			</TextField>

			<TextField type="text" name="host" isRequired>
				<Label>{t("fields.host.label")}</Label>
				<Input placeholder={t("fields.host.placeholder")} />
				<FieldError />
				<Description>{t("fields.host.description")}</Description>
			</TextField>

			<NumberField name="port" isRequired minValue={1} maxValue={65535} defaultValue={80}>
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
				defaultValue={5}
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
				defaultValue={5}
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

			<Button type="submit" className="self-end" isPending={isPending}>
				{t("cta")}
			</Button>
		</fetcher.Form>
	);
}
