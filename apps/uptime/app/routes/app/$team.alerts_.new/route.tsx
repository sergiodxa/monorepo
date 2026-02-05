import { cn } from "@pkg/cn";
import { ChevronDownIcon, LoaderIcon } from "lucide-react";
import { useState } from "react";
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
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";

import type { Route } from "./+types/route";

export async function loader() {
	return { hasActiveSubscription: await hasActiveSubscription() };
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.createAlert" });

	return (
		<>
			<AppHeader heading={t("header.title")} />

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

			<div className="p-12 flex flex-col gap-12">
				<CreateAlertForm />
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
			className="max-w-prose w-full mx-auto flex flex-col gap-6"
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
						"border border-solid border-neutral-400 rounded focus:outline-2 focus:outline-primary-500 py-2 px-4 ring-0 user-invalid:outline-red-500 user-invalid:outline-2 flex items-center justify-between gap-2"
					}
				>
					<SelectValue />
					<ChevronDownIcon className="size-4" aria-hidden />
				</AriaButton>

				<FieldError />

				<Description>{t("fields.strategy.description")}</Description>

				<Popover
					className="bg-white shadow dark:bg-neutral-800 rounded-lg"
					style={{ minWidth: "var(--trigger-width)" }}
				>
					<ListBox className="flex flex-col gap-0.5 p-1" items={strategies}>
						{(strategy) => (
							<ListBoxItem
								textValue={strategy.textValue}
								className={cn(
									// Default
									"flex items-center justify-between",
									"cursor-default py-1 px-2 rounded",
									// Selected
									"data-[selected]:after:content-['✓']",
									// Hovered
									"data-[hovered]:bg-primary-50 data-[hovered]:text-primary-900",
									"dark:data-[hovered]:bg-primary-800 dark:data-[hovered]:text-primary-200",
									// Focused
									"data-[focused]:bg-primary-50 data-[focused]:text-primary-900",
									"dark:data-[focused]:bg-primary-800 dark:data-[focused]:text-primary-200",
									// Disabled
									"data-[disabled]:text-neutral-400 data-[disabled]:cursor-not-allowed",
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
