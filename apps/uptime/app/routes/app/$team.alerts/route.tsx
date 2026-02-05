import { cn } from "@pkg/cn";
import {
	BellMinusIcon,
	BellPlusIcon,
	ChevronDownIcon,
	EllipsisVerticalIcon,
	LoaderIcon,
} from "lucide-react";
import { useId, useState } from "react";
import {
	Button as AriaButton,
	type Key,
	ListBox,
	ListBoxItem,
	Popover,
	Select,
	SelectValue,
	TextField,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Description, FieldError, Input, Label } from "~/components/ui/field";
import { LinkButton } from "~/components/ui/link-button";
import { Menu } from "~/components/ui/menu";
import { ColumnAlignment, Table } from "~/components/ui/table";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

export async function loader() {
	let alerts = await measure("findAlerts", () => {
		return db().query.alerts.findMany({
			where(fields, operators) {
				return operators.eq(fields.teamId, team().id);
			},
		});
	});

	return { alerts, hasActiveSubscription: await hasActiveSubscription() };
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.alerts" });
	let id = useId();

	let columns = [
		{
			id: "name" as const,
			name: t("table.columns.name"),
			align: ColumnAlignment.Left,
		},
		{
			id: "strategy" as const,
			name: t("table.columns.strategy"),
			align: ColumnAlignment.Right,
		},
		{
			id: "actions" as const,
			name: t("table.columns.actions"),
			align: ColumnAlignment.Center,
		},
	];

	return (
		<>
			<AppHeader heading={t("header.title")}>
				{loaderData.alerts.length < 10 && (
					<LinkButton
						color="neutral"
						href={href("/app/:team/alerts/new", params)}
						className="flex-shrink-0 px-2"
					>
						<BellPlusIcon className="size-5" aria-hidden />
						<span className="max-sm:sr-only">{t("header.action.create")}</span>
					</LinkButton>
				)}
			</AppHeader>

			{loaderData.hasActiveSubscription ? null : (
				<div className="p-4">
					<Alert
						intent="warning"
						title={t("alert.subscription.title")}
						description={t("alert.subscription.description")}
						cta={
							<Link to={href("/app/:team/checkout", params)}>{t("alert.subscription.cta")}</Link>
						}
					/>
				</div>
			)}

			<div className="flex flex-col gap-12 p-12">
				{loaderData.alerts.length === 0 ? (
					<CreateAlertForm />
				) : (
					<div className="flex flex-col gap-4">
						<h2 id={`${id}-members-table`}>{t("table.label")}</h2>

						<Table aria-labelledby={`{id}-members-table`}>
							<Table.Header columns={columns}>
								{(column) => {
									return (
										<Table.Column align={column.align} isRowHeader={column.id === "name"}>
											<span
												className={cn({
													"sr-only": column.id === "actions",
												})}
											>
												{column.name}
											</span>
										</Table.Column>
									);
								}}
							</Table.Header>

							<Table.Body items={loaderData.alerts}>
								{(alert) => <AlertTableRow alert={alert} />}
							</Table.Body>
						</Table>
					</div>
				)}
			</div>
		</>
	);
}

function CreateAlertForm() {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.alerts.form",
	});
	let team = useTeam();

	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let [strategy, setStrategy] = useState<Key>("email");
	let strategies = [
		{ id: "email", textValue: t("fields.strategy.options.email") },
		{ id: "webhook", textValue: t("fields.strategy.options.webhook") },
	] as const;

	return (
		<fetcher.Form
			method="POST"
			action={href("/actions/:team/create-alert", { team: team.slug })}
			className="mx-auto flex w-full max-w-prose flex-col gap-6"
		>
			<TextField type="text" name="name" className="flex flex-col gap-1" isRequired>
				<Label>{t("fields.name.label")}</Label>
				<Input placeholder={t("fields.name.placeholder")} className="mt-2" />
				<Description>{t("fields.name.description")}</Description>
				<FieldError />
			</TextField>

			<Select
				name="strategy"
				className="flex flex-col gap-1"
				isRequired
				selectedKey={strategy}
				onSelectionChange={(selection) => selection && setStrategy(selection)}
			>
				<Label>{t("fields.strategy.label")}</Label>

				<AriaButton
					className={
						"user-invalid:outline-red-500 flex items-center justify-between gap-2 rounded border border-solid border-neutral-400 px-4 py-2 ring-0 user-invalid:outline-2 focus:outline-2 focus:outline-primary-500"
					}
				>
					<SelectValue />
					<ChevronDownIcon className="size-4" aria-hidden />
				</AriaButton>

				<FieldError />

				<Description>{t("fields.strategy.description")}</Description>

				<Popover
					className="bg-white rounded-lg shadow dark:bg-neutral-800"
					style={{ minWidth: "var(--trigger-width)" }}
				>
					<ListBox className="flex flex-col gap-0.5 p-1" items={strategies}>
						{(strategy) => (
							<ListBoxItem
								textValue={strategy.textValue}
								className={cn(
									// Default
									"flex items-center justify-between",
									"cursor-default rounded px-2 py-1",
									// Selected
									"data-[selected]:after:content-['✓']",
									// Hovered
									"data-[hovered]:bg-primary-50 data-[hovered]:text-primary-900",
									"dark:data-[hovered]:bg-primary-800 dark:data-[hovered]:text-primary-200",
									// Focused
									"data-[focused]:bg-primary-50 data-[focused]:text-primary-900",
									"dark:data-[focused]:bg-primary-800 dark:data-[focused]:text-primary-200",
									// Disabled
									"data-[disabled]:cursor-not-allowed data-[disabled]:text-neutral-400",
								)}
							>
								{strategy.textValue}
							</ListBoxItem>
						)}
					</ListBox>
				</Popover>
			</Select>

			{strategy === "email" && (
				<>
					<TextField type="email" name="email" className="flex flex-col gap-1" isRequired>
						<Label>{t("fields.config.email.to.label")}</Label>
						<Input placeholder={t("fields.config.email.to.placeholder")} className="mt-2" />
						<Description>{t("fields.config.email.to.description")}</Description>
						<FieldError />
					</TextField>

					<TextField type="text" name="subjectPrefix" className="flex flex-col gap-1">
						<Label>{t("fields.config.email.subjectPrefix.label")}</Label>
						<Input
							placeholder={t("fields.config.email.subjectPrefix.placeholder")}
							className="mt-2"
						/>
						<Description>{t("fields.config.email.subjectPrefix.description")}</Description>
						<FieldError />
					</TextField>
				</>
			)}

			{strategy === "webhook" && (
				<>
					<TextField type="url" name="url" className="flex flex-col gap-1" isRequired>
						<Label>{t("fields.config.webhook.url.label")}</Label>
						<Input placeholder={t("fields.config.webhook.url.placeholder")} className="mt-2" />
						<Description>{t("fields.config.webhook.url.description")}</Description>
						<FieldError />
					</TextField>

					<TextField type="text" name="secret" className="flex flex-col gap-1">
						<Label>{t("fields.config.webhook.secret.label")}</Label>
						<Input placeholder={t("fields.config.webhook.secret.placeholder")} className="mt-2" />
						<Description>{t("fields.config.webhook.secret.description")}</Description>
						<FieldError />
					</TextField>
				</>
			)}

			<Button
				color="primary"
				type="submit"
				className="flex items-center justify-between self-end"
				isPending={isPending}
				name="intent"
			>
				<span>{t("cta")}</span>
				{isPending && <LoaderIcon className="size-5 animate-spin" />}
			</Button>
		</fetcher.Form>
	);
}

function AlertTableRow(props: { alert: Route.ComponentProps["loaderData"]["alerts"][number] }) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.alerts.table",
	});

	let team = useTeam();

	let removeAlert = useFetcher();
	let isRemovingAlert = useSpinDelay(removeAlert.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	return (
		<Table.Row>
			<Table.Cell>
				<span className="font-semibold">{props.alert.name}</span>
			</Table.Cell>
			<Table.Cell className="w-28 text-right">
				{props.alert.config.strategy === "email" ? t("types.email") : t("types.webhook")}
			</Table.Cell>
			<Table.Cell className="w-17 text-center">
				<Menu.Trigger>
					<Button type="button" color="neutral" className="p-2">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("actions.menu")}</span>
					</Button>

					<Menu.Popover placement="left top">
						<Menu>
							<Menu.Item
								isDisabled={isRemovingAlert}
								onAction={() => {
									if (window.confirm(t("confirmation.deleteAlert", props.alert))) {
										removeAlert.submit(
											{ alertId: props.alert.id },
											{
												method: "POST",
												action: href("/actions/:team/remove-alert", {
													team: team.slug,
												}),
											},
										);
									}
								}}
							>
								<BellMinusIcon aria-hidden className="size-5" />
								<span>{t(`actions.remove`)}</span>
								{isRemovingAlert && (
									<LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />
								)}
							</Menu.Item>
						</Menu>
					</Menu.Popover>
				</Menu.Trigger>
			</Table.Cell>
		</Table.Row>
	);
}
