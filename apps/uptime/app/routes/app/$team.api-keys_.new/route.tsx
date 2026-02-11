import { forbidden } from "@pkg/response";
import {
	Button,
	Card,
	Checkbox,
	CheckboxGroup,
	Description,
	FieldError,
	Input,
	Label,
	TextField,
} from "@pkg/ui";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { href, useFetcher, useNavigate } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

export async function loader() {
	let { memberships, id } = team();
	let subjectMembership = memberships[0];

	logger().info("apiKeys.new.loader.start", {
		route: "api-keys/new",
		teamId: id,
		subjectRole: subjectMembership.role,
	});

	if (subjectMembership.role !== "admin") {
		logger().info("apiKeys.new.loader.forbidden", {
			route: "api-keys/new",
			teamId: id,
			subjectRole: subjectMembership.role,
		});
		throw forbidden({ hasActiveSubscription: await hasActiveSubscription() });
	}

	logger().info("apiKeys.new.loader.complete", {
		route: "api-keys/new",
		teamId: id,
	});

	return { hasActiveSubscription: await hasActiveSubscription() };
}

export default function Component({ params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.apiKeys.form" });
	let navigate = useNavigate();
	let fetcher = useFetcher<{
		ok: boolean;
		apiKey?: { key: string; name: string };
	}>();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	// Handle successful creation - navigate back to list with the key in state
	useEffect(() => {
		if (fetcher.data?.ok && fetcher.data.apiKey) {
			navigate(href("/app/:team/api-keys", params), {
				state: { createdKey: fetcher.data.apiKey },
				replace: true,
			});
		}
	}, [fetcher.data, navigate, params]);

	return (
		<>
			<AppHeader heading={t("title")} />

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				<Card className="mx-auto w-full max-w-2xl">
					<fetcher.Form
						method="POST"
						action={href("/actions/:team/create-api-key", { team: params.team })}
					>
						<Card.Header>
							<Card.Title>{t("title")}</Card.Title>
							<Card.Description>{t("description")}</Card.Description>
						</Card.Header>

						<Card.Content className="space-y-6">
							<TextField type="text" name="name" isRequired>
								<Label>{t("fields.name.label")}</Label>
								<Input placeholder={t("fields.name.placeholder")} />
								<Description>{t("fields.name.description")}</Description>
								<FieldError />
							</TextField>

							<CheckboxGroup name="scopes" isRequired>
								<Label>{t("fields.scopes.label")}</Label>
								<Description>{t("fields.scopes.description")}</Description>
								<div className="mt-2 grid gap-2 sm:grid-cols-2">
									<Checkbox value="monitors:read">
										{t("fields.scopes.options.monitors:read", { nsSeparator: false })}
									</Checkbox>
									<Checkbox value="monitors:write">
										{t("fields.scopes.options.monitors:write", { nsSeparator: false })}
									</Checkbox>
									<Checkbox value="alerts:read">
										{t("fields.scopes.options.alerts:read", { nsSeparator: false })}
									</Checkbox>
									<Checkbox value="alerts:write">
										{t("fields.scopes.options.alerts:write", { nsSeparator: false })}
									</Checkbox>
									<Checkbox value="cron-jobs:read">
										{t("fields.scopes.options.cron-jobs:read", { nsSeparator: false })}
									</Checkbox>
									<Checkbox value="cron-jobs:write">
										{t("fields.scopes.options.cron-jobs:write", { nsSeparator: false })}
									</Checkbox>
									<Checkbox value="cron-jobs:ping">
										{t("fields.scopes.options.cron-jobs:ping", { nsSeparator: false })}
									</Checkbox>
								</div>
								<FieldError />
							</CheckboxGroup>

							<TextField type="date" name="expiresAt">
								<Label>{t("fields.expiresAt.label")}</Label>
								<Input min={new Date().toISOString().split("T")[0]} />
								<Description>{t("fields.expiresAt.description")}</Description>
								<FieldError />
							</TextField>
						</Card.Content>

						<Card.Footer className="justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								color="neutral"
								onPress={() => navigate(href("/app/:team/api-keys", params))}
							>
								{t("actions.cancel")}
							</Button>
							<Button type="submit" isPending={isPending}>
								{t("actions.create")}
							</Button>
						</Card.Footer>
					</fetcher.Form>
				</Card>
			</div>
		</>
	);
}
