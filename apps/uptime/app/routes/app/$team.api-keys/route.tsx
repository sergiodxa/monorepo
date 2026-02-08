import { cn } from "@pkg/cn";
import { forbidden } from "@pkg/response";
import {
	Alert,
	Badge,
	Button,
	Card,
	Checkbox,
	CheckboxGroup,
	confirm,
	Description,
	Empty,
	FieldError,
	Input,
	Label,
	Menu,
	Popover,
	Skeleton,
	Table,
	TextField,
} from "@pkg/ui";
import {
	CheckIcon,
	ClipboardCopyIcon,
	EllipsisVerticalIcon,
	EyeIcon,
	EyeOffIcon,
	KeyIcon,
	LoaderIcon,
	PlusIcon,
	Trash2Icon,
	TriangleAlertIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { href, useFetcher, useRevalidator } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
	return await serverLoader();
}

clientLoader.hydrate = true as const;

export function HydrateFallback() {
	return (
		<>
			<header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50/80 px-4 dark:border-neutral-800 dark:bg-neutral-950/80">
				<Skeleton className="h-6 w-24" />
				<aside className="ml-auto flex items-center gap-2">
					<Skeleton className="h-10 w-10 rounded-lg max-sm:w-10 sm:w-32" />
				</aside>
			</header>
			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				<ApiKeysTableSkeleton />
			</div>
		</>
	);
}

function ApiKeysTableSkeleton() {
	return (
		<Table aria-label="Loading API keys">
			<Table.Header>
				<Table.Column isRowHeader>
					<Skeleton className="h-4 w-16" />
				</Table.Column>
				<Table.Column>
					<Skeleton className="h-4 w-16" />
				</Table.Column>
				<Table.Column>
					<Skeleton className="h-4 w-20" />
				</Table.Column>
				<Table.Column align="center">
					<span className="sr-only">Actions</span>
				</Table.Column>
			</Table.Header>

			<Table.Body items={[{ id: "1" }, { id: "2" }, { id: "3" }]}>
				{(item) => (
					<Table.Row key={item.id}>
						<Table.Cell>
							<Skeleton className="h-4 w-32" />
						</Table.Cell>
						<Table.Cell>
							<Skeleton className="h-4 w-24" />
						</Table.Cell>
						<Table.Cell>
							<Skeleton className="h-4 w-16" />
						</Table.Cell>
						<Table.Cell className="w-17 text-center">
							<Skeleton className="mx-auto h-10 w-10 rounded-lg" />
						</Table.Cell>
					</Table.Row>
				)}
			</Table.Body>
		</Table>
	);
}

export async function loader() {
	let { memberships, id } = team();
	let subjectMembership = memberships[0];

	if (subjectMembership.role !== "admin") {
		throw forbidden({ hasActiveSubscription: await hasActiveSubscription() });
	}

	let apiKeys = await measure("findApiKeys", () => {
		return db().query.apiKeys.findMany({
			where(fields, operators) {
				return operators.eq(fields.teamId, id);
			},
			columns: {
				id: true,
				name: true,
				keyPrefix: true,
				scopes: true,
				lastUsedAt: true,
				expiresAt: true,
				createdAt: true,
			},
			orderBy(fields, operators) {
				return operators.desc(fields.createdAt);
			},
		});
	});

	return { apiKeys, hasActiveSubscription: await hasActiveSubscription() };
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.apiKeys" });
	let id = useId();
	let [showCreateForm, setShowCreateForm] = useState(false);
	let [createdKey, setCreatedKey] = useState<{
		key: string;
		name: string;
	} | null>(null);

	let columns = [
		{ id: "name" as const, name: t("table.columns.name"), align: "left" as const },
		{ id: "prefix" as const, name: t("table.columns.prefix"), align: "left" as const },
		{ id: "scopes" as const, name: t("table.columns.scopes"), align: "left" as const },
		{ id: "lastUsed" as const, name: t("table.columns.lastUsed"), align: "center" as const },
		{ id: "expires" as const, name: t("table.columns.expires"), align: "center" as const },
		{ id: "actions" as const, name: t("table.columns.actions"), align: "center" as const },
	];

	return (
		<>
			<AppHeader heading={t("header.title")}>
				{loaderData.apiKeys.length < 10 && !showCreateForm && (
					<Button
						color="neutral"
						className="flex-shrink-0 px-2"
						onPress={() => setShowCreateForm(true)}
					>
						<PlusIcon className="size-5" aria-hidden />
						<span className="max-sm:sr-only">{t("header.action.create")}</span>
					</Button>
				)}
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
							<a href={href("/app/:team/checkout", params)}>{t("alert.subscription.cta")}</a>
						</Alert.Action>
					</Alert>
				</div>
			)}

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				{createdKey && (
					<NewKeyAlert
						keyName={createdKey.name}
						fullKey={createdKey.key}
						onDismiss={() => setCreatedKey(null)}
					/>
				)}

				{showCreateForm && (
					<CreateApiKeyForm
						teamSlug={params.team}
						onCancel={() => setShowCreateForm(false)}
						onSuccess={(key, name) => {
							setCreatedKey({ key, name });
							setShowCreateForm(false);
						}}
					/>
				)}

				{loaderData.apiKeys.length === 0 && !showCreateForm ? (
					<Empty className="mx-auto max-w-md py-16">
						<Empty.Icon>
							<KeyIcon className="size-12" />
						</Empty.Icon>
						<Empty.Title>{t("empty.title")}</Empty.Title>
						<Empty.Description>{t("empty.description")}</Empty.Description>
						<Empty.Action>
							<Button onPress={() => setShowCreateForm(true)}>
								<PlusIcon className="size-5" aria-hidden />
								{t("empty.cta")}
							</Button>
						</Empty.Action>
					</Empty>
				) : (
					loaderData.apiKeys.length > 0 && (
						<div className="flex flex-col gap-4">
							<h2 id={`${id}-api-keys-table`}>{t("table.label")}</h2>

							<Table aria-labelledby={`${id}-api-keys-table`}>
								<Table.Header columns={columns}>
									{(column) => (
										<Table.Column align={column.align} isRowHeader={column.id === "name"}>
											<span className={cn({ "sr-only": column.id === "actions" })}>
												{column.name}
											</span>
										</Table.Column>
									)}
								</Table.Header>

								<Table.Body items={loaderData.apiKeys}>
									{(apiKey) => <ApiKeyTableRow apiKey={apiKey} />}
								</Table.Body>
							</Table>
						</div>
					)
				)}
			</div>
		</>
	);
}

function NewKeyAlert(props: { keyName: string; fullKey: string; onDismiss: () => void }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.apiKeys" });
	let [showKey, setShowKey] = useState(false);
	let [copied, setCopied] = useState(false);

	let handleCopy = () => {
		navigator.clipboard.writeText(props.fullKey);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Alert color="neutral">
			<Alert.Icon>
				<KeyIcon className="size-5" />
			</Alert.Icon>
			<Alert.Content>
				<Alert.Title>{t("newKey.title", { name: props.keyName })}</Alert.Title>
				<Alert.Description>{t("newKey.description")}</Alert.Description>
				<div className="mt-3 flex items-center gap-2">
					<code className="flex-1 rounded bg-neutral-100 px-3 py-2 font-mono text-sm dark:bg-neutral-800">
						{showKey ? props.fullKey : "•".repeat(40)}
					</code>
					<Button
						type="button"
						color="neutral"
						className="p-2"
						onPress={() => setShowKey(!showKey)}
					>
						{showKey ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
					</Button>
					<Button type="button" color="neutral" className="p-2" onPress={handleCopy}>
						{copied ? <CheckIcon className="size-4" /> : <ClipboardCopyIcon className="size-4" />}
					</Button>
				</div>
			</Alert.Content>
			<Alert.Action>
				<Button type="button" color="neutral" onPress={props.onDismiss}>
					{t("newKey.dismiss")}
				</Button>
			</Alert.Action>
		</Alert>
	);
}

function CreateApiKeyForm(props: {
	teamSlug: string;
	onCancel: () => void;
	onSuccess: (key: string, name: string) => void;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.apiKeys.form" });
	let fetcher = useFetcher<{
		ok: boolean;
		apiKey?: { key: string; name: string };
	}>();
	let revalidator = useRevalidator();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	// Handle successful creation
	if (fetcher.data?.ok && fetcher.data.apiKey) {
		props.onSuccess(fetcher.data.apiKey.key, fetcher.data.apiKey.name);
		revalidator.revalidate();
	}

	return (
		<Card className="mx-auto w-full max-w-2xl">
			<fetcher.Form
				method="POST"
				action={href("/actions/:team/create-api-key", { team: props.teamSlug })}
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
							<Checkbox value="monitors:read">{t("fields.scopes.options.monitors:read")}</Checkbox>
							<Checkbox value="monitors:write">
								{t("fields.scopes.options.monitors:write")}
							</Checkbox>
							<Checkbox value="alerts:read">{t("fields.scopes.options.alerts:read")}</Checkbox>
							<Checkbox value="alerts:write">{t("fields.scopes.options.alerts:write")}</Checkbox>
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
					<Button type="button" variant="outline" color="neutral" onPress={props.onCancel}>
						{t("actions.cancel")}
					</Button>
					<Button type="submit" isPending={isPending}>
						{t("actions.create")}
					</Button>
				</Card.Footer>
			</fetcher.Form>
		</Card>
	);
}

type ApiKey = Route.ComponentProps["loaderData"]["apiKeys"][number];

function ApiKeyTableRow(props: { apiKey: ApiKey }) {
	let { t, i18n } = useTranslation("translation", { keyPrefix: "page.apiKeys" });
	let team = useTeam();

	let deleteFetcher = useFetcher();
	let isDeleting = useSpinDelay(deleteFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let lastUsed = props.apiKey.lastUsedAt
		? new Date(props.apiKey.lastUsedAt).toLocaleDateString(i18n.language, {
				dateStyle: "short",
			})
		: t("table.lastUsed.never");

	let expires = props.apiKey.expiresAt
		? new Date(props.apiKey.expiresAt).toLocaleDateString(i18n.language, {
				dateStyle: "short",
			})
		: t("table.expires.never");

	let isExpired = props.apiKey.expiresAt && new Date(props.apiKey.expiresAt) < new Date();

	return (
		<Table.Row>
			<Table.Cell>
				<div className="flex flex-col gap-0.5">
					<span className="font-semibold">{props.apiKey.name}</span>
				</div>
			</Table.Cell>
			<Table.Cell>
				<code className="text-sm text-neutral-500 dark:text-neutral-400">
					{props.apiKey.keyPrefix}...
				</code>
			</Table.Cell>
			<Table.Cell>
				<div className="flex flex-wrap gap-1">
					{props.apiKey.scopes.map((scope) => (
						<Badge key={scope} color="neutral" className="text-xs">
							{scope}
						</Badge>
					))}
				</div>
			</Table.Cell>
			<Table.Cell className="text-center">{lastUsed}</Table.Cell>
			<Table.Cell className={cn("text-center", { "text-red-500": isExpired })}>
				{expires}
			</Table.Cell>
			<Table.Cell className="w-17 text-center">
				<Menu.Trigger>
					<Button type="button" color="neutral" className="p-2">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("table.actions.menu")}</span>
					</Button>

					<Popover placement="left top">
						<Menu>
							<Menu.Item
								danger
								isDisabled={isDeleting}
								onAction={async () => {
									let confirmed = await confirm(
										t("table.confirmation.delete", { name: props.apiKey.name }),
										{
											confirmLabel: t("table.actions.delete"),
											color: "danger",
										},
									);
									if (confirmed) {
										deleteFetcher.submit(
											{ apiKeyId: props.apiKey.id },
											{
												method: "POST",
												action: href("/actions/:team/delete-api-key", { team: team.slug }),
											},
										);
									}
								}}
							>
								<Trash2Icon aria-hidden className="size-5" />
								<span>{t("table.actions.delete")}</span>
								{isDeleting && <LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />}
							</Menu.Item>
						</Menu>
					</Popover>
				</Menu.Trigger>
			</Table.Cell>
		</Table.Row>
	);
}
