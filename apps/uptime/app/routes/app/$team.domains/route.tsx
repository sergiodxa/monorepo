import { cn } from "@pkg/cn";
import {
	Alert,
	Button,
	Description,
	FieldError,
	Input,
	Label,
	LinkButton,
	Menu,
	Popover,
	Table,
	TextField,
} from "@pkg/ui";
import {
	BadgeMinusIcon,
	BadgePlusIcon,
	ClipboardCopyIcon,
	EllipsisVerticalIcon,
	LoaderIcon,
	RefreshCcwIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useId } from "react";
import { Trans, useTranslation } from "react-i18next";
import { data, href, isRouteErrorResponse, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

export async function loader() {
	let { memberships, id } = team();
	let subjectMembership = memberships[0];

	if (subjectMembership.role === "member") {
		throw data(
			{ status: 403, hasActiveSubscription: await hasActiveSubscription() },
			{ status: 403, statusText: "Forbidden" },
		);
	}

	let domains = await measure("findVerifiedDomains", async () => {
		return await db().query.teamDomains.findMany({
			where(fields, operators) {
				return operators.eq(fields.teamId, id);
			},
		});
	});

	return { domains, hasActiveSubscription: await hasActiveSubscription() };
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.domains" });
	let id = useId();

	let columns = [
		{
			id: "hostname" as const,
			name: t("table.columns.hostname"),
			align: "left" as const,
		},
		{
			id: "id" as const,
			name: t("table.columns.id"),
			align: "right" as const,
		},
		{
			id: "verifiedAt" as const,
			name: t("table.columns.verifiedAt"),
			align: "right" as const,
		},
		{
			id: "actions" as const,
			name: t("table.columns.actions"),
			align: "center" as const,
		},
	];

	let hasPendingVerification = loaderData.domains.some((domain) => !domain.verifiedAt);

	return (
		<>
			<AppHeader heading={t("header.title")}>
				<LinkButton
					color="neutral"
					href={href("/app/:team/domains/new", params)}
					className="flex-shrink-0 px-2"
				>
					<BadgePlusIcon className="size-5" aria-hidden />
					<span className="max-sm:sr-only">{t("header.action.addDomain")}</span>
				</LinkButton>
			</AppHeader>

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
				{loaderData.domains.length === 0 ? (
					<CreateDomainForm />
				) : (
					<>
						<div className="flex flex-col gap-4">
							<h2 id={`${id}-members-table`}>{t("table.label")}</h2>

							<Table aria-labelledby={`{id}-members-table`}>
								<Table.Header columns={columns}>
									{(column) => {
										return (
											<Table.Column align={column.align} isRowHeader={column.id === "hostname"}>
												<span
													className={cn({
														"sr-only":
															column.id === "actions" ||
															(!hasPendingVerification && column.id === "id"),
													})}
												>
													{column.name}
												</span>
											</Table.Column>
										);
									}}
								</Table.Header>

								<Table.Body items={loaderData.domains}>
									{(domain) => <DomainTableRow domain={domain} />}
								</Table.Body>
							</Table>
						</div>

						{hasPendingVerification && <Instructions />}
					</>
				)}
			</div>
		</>
	);
}

function DomainTableRow(props: { domain: Route.ComponentProps["loaderData"]["domains"][number] }) {
	let { t, i18n } = useTranslation("translation", {
		keyPrefix: "page.domains.table",
	});

	let team = useTeam();

	let verifiedAt = props.domain.verifiedAt
		? new Date(props.domain.verifiedAt).toLocaleString(i18n.language, {
				dateStyle: "long",
			})
		: t("verifiedAt.pending", { id: props.domain.id });

	let removeDomainFetcher = useFetcher();
	let isRemovingDomain = useSpinDelay(removeDomainFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let retryDomainVerificationFetcher = useFetcher();
	let isRetryingDomainVerification = useSpinDelay(retryDomainVerificationFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let verificationId = `ping_${props.domain.id}`;

	return (
		<Table.Row>
			<Table.Cell>{props.domain.hostname}</Table.Cell>
			{props.domain.verifiedAt ? (
				<Table.Cell>{null}</Table.Cell>
			) : (
				<Table.Cell className="w-110 text-right">{verificationId}</Table.Cell>
			)}
			<Table.Cell className="w-60 text-right">{verifiedAt}</Table.Cell>
			<Table.Cell className="w-17 text-center">
				<Menu.Trigger>
					<Button type="button" color="neutral" className="p-2">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("actions.menu")}</span>
					</Button>

					<Popover placement="left top">
						<Menu>
							{!props.domain.verifiedAt && (
								<>
									<Menu.Item
										isDisabled={isRetryingDomainVerification}
										onAction={() => {
											retryDomainVerificationFetcher.submit(
												{ domainId: props.domain.id },
												{
													method: "POST",
													action: href("/actions/:team/retry-domain-verification", {
														team: team.slug,
													}),
												},
											);
										}}
									>
										<RefreshCcwIcon aria-hidden className="size-5" />
										<span>{t("actions.retryVerification")}</span>
									</Menu.Item>

									<Menu.Item onAction={() => navigator.clipboard.writeText(verificationId)}>
										<ClipboardCopyIcon aria-hidden className="size-5" />
										<span>{t("actions.copy")}</span>
										<span className="sr-only">{props.domain.id}</span>
									</Menu.Item>

									<Menu.Separator />
								</>
							)}

							<Menu.Item
								danger
								isDisabled={isRemovingDomain}
								onAction={() => {
									if (window.confirm(t("confirmation.removeDomain", props.domain))) {
										removeDomainFetcher.submit(
											{
												domainId: props.domain.id,
												hostname: props.domain.hostname,
											},
											{
												method: "POST",
												action: href("/actions/:team/remove-domain", {
													team: team.slug,
												}),
											},
										);
									}
								}}
							>
								<BadgeMinusIcon aria-hidden className="size-5" />
								<span>{t(`actions.remove`)}</span>
								{isRemovingDomain && (
									<LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />
								)}
							</Menu.Item>
						</Menu>
					</Popover>
				</Menu.Trigger>
			</Table.Cell>
		</Table.Row>
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
			<TextField type="text" name="hostname" isRequired autoComplete="off">
				<Label>{t("fields.hostname.label")}</Label>
				<Input placeholder={t("fields.hostname.placeholder")} />
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

function Instructions() {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.domains.instructions",
	});

	return (
		<aside className="flex flex-col gap-2 rounded-2xl border border-neutral-300 p-4 dark:border-neutral-700">
			<h3 className="text-xl font-semibold">{t("title")}</h3>

			<p>{t("description")}</p>

			<dl className="my-2 flex flex-col gap-2 [&_code]:rounded-lg [&_code]:bg-neutral-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-sm [&_code]:dark:bg-neutral-800 [&_div]:ml-2 [&_div]:flex [&_div]:gap-2 [&_dt]:font-semibold">
				<div>
					<dt>{t("record.name.label")}</dt>
					<dd>
						<code>{t("record.name.value")}</code>
					</dd>
				</div>

				<div>
					<dt>{t("record.content.label")}</dt>
					<dd>
						<code>{t("record.content.value")}</code>
					</dd>
				</div>
			</dl>

			<Trans
				parent="p"
				t={t}
				i18nKey="note"
				components={{
					code: <code className="rounded-lg bg-neutral-100 px-1.5 py-1 dark:bg-neutral-800" />,
				}}
			/>

			<p className="mt-2">{t("disclaimer")}</p>
		</aside>
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
