import {
	Alert,
	Button,
	Description,
	FieldError,
	Input,
	Label,
	ListBox,
	Popover,
	Select,
	TextField,
} from "@pkg/ui";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { type Key } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
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
					<Alert color="warning">
						<Alert.Icon>
							<TriangleAlertIcon className="size-5" />
						</Alert.Icon>
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

			<div className="flex flex-col gap-12 p-12">
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
			className="mx-auto flex w-full max-w-prose flex-col gap-6"
		>
			<TextField type="text" name="name" isRequired>
				<Label>{t("fields.name.label")}</Label>
				<Input placeholder={t("fields.name.placeholder")} />
				<Description>{t("fields.name.description")}</Description>
				<FieldError />
			</TextField>

			<Select
				name="strategy"
				isRequired
				selectedKey={strategy}
				onSelectionChange={(selection: Key | null) => selection && setStrategy(selection)}
			>
				<Label>{t("fields.strategy.label")}</Label>
				<Select.Trigger />
				<FieldError />
				<Description>{t("fields.strategy.description")}</Description>
				<Popover>
					<ListBox items={strategies}>
						{(strategy: (typeof strategies)[number]) => (
							<Select.Item id={strategy.id}>{strategy.textValue}</Select.Item>
						)}
					</ListBox>
				</Popover>
			</Select>

			{strategy === "email" && (
				<>
					<TextField type="email" name="email" isRequired>
						<Label>{t("fields.config.email.to.label")}</Label>
						<Input placeholder={t("fields.config.email.to.placeholder")} />
						<Description>{t("fields.config.email.to.description")}</Description>
						<FieldError />
					</TextField>

					<TextField type="text" name="subjectPrefix">
						<Label>{t("fields.config.email.subjectPrefix.label")}</Label>
						<Input placeholder={t("fields.config.email.subjectPrefix.placeholder")} />
						<Description>{t("fields.config.email.subjectPrefix.description")}</Description>
						<FieldError />
					</TextField>
				</>
			)}

			{strategy === "webhook" && (
				<>
					<TextField type="url" name="url" isRequired>
						<Label>{t("fields.config.webhook.url.label")}</Label>
						<Input placeholder={t("fields.config.webhook.url.placeholder")} />
						<Description>{t("fields.config.webhook.url.description")}</Description>
						<FieldError />
					</TextField>

					<TextField type="text" name="secret">
						<Label>{t("fields.config.webhook.secret.label")}</Label>
						<Input placeholder={t("fields.config.webhook.secret.placeholder")} />
						<Description>{t("fields.config.webhook.secret.description")}</Description>
						<FieldError />
					</TextField>
				</>
			)}

			<Button type="submit" className="self-end" isPending={isPending} name="intent">
				{t("cta")}
			</Button>
		</fetcher.Form>
	);
}
