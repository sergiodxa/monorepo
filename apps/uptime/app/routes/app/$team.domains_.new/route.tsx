import { LoaderIcon } from "lucide-react";
import { TextField } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { data, href, isRouteErrorResponse, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Description, FieldError, Input, Label } from "~/components/ui/field";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

export async function loader() {
	let { memberships } = team();
	let subjectMembership = memberships[0];

	if (subjectMembership.role === "member") {
		throw data(
			{ status: 403, hasActiveSubscription: await hasActiveSubscription() },
			{ status: 403, statusText: "Forbidden" },
		);
	}

	return { hasActiveSubscription: await hasActiveSubscription() };
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.domains" });

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

			<div className="flex flex-col gap-12 p-12">
				<CreateDomainForm />
			</div>
		</>
	);
}

function CreateDomainForm() {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.domains.form",
	});
	let team = useTeam();

	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	return (
		<fetcher.Form
			method="POST"
			action={href("/actions/:team/add-domain", { team: team.slug })}
			className="mx-auto flex w-full max-w-prose flex-col gap-6"
		>
			<TextField
				type="text"
				name="hostname"
				className="flex flex-col gap-1"
				isRequired
				autoComplete="off"
			>
				<Label>{t("fields.hostname.label")}</Label>
				<Input placeholder={t("fields.hostname.placeholder")} className="mt-2" />
				<Description>
					{t("fields.hostname.description", {
						team: team.name,
					})}
				</Description>
				<FieldError />
			</TextField>

			<Button
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

export function ErrorBoundary({ error, params }: Route.ErrorBoundaryProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.domains" });

	if (isRouteErrorResponse(error)) {
		let data = error.data as {
			hasActiveSubscription: boolean;
			status: number;
		};

		return (
			<>
				<AppHeader heading={t("header.title")} />

				{data.hasActiveSubscription ? null : (
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

				<div className="flex flex-col gap-4 p-12">
					{data.status === 403 ? (
						<>
							<h2>{t("error.forbidden.title")}</h2>
							<p>{t("error.forbidden.description")}</p>
						</>
					) : (
						<>
							<h2>{t("error.unknown.title")}</h2>
							<p>{t("error.unknown.description")}</p>
						</>
					)}
				</div>
			</>
		);
	}

	return (
		<>
			<AppHeader heading={t("header.title")} />
			<div className="flex flex-col gap-4 p-12">
				<h2>{t("error.unknown.title")}</h2>
				<p>{t("error.unknown.description")}</p>
			</div>
		</>
	);
}
