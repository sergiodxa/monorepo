/**
 * The admin users-list route (/admin/subjects). Its loader returns a paginated list of
 * subjects with total counts, and the component renders them in a table with avatars,
 * roles and view/edit links plus pagination controls. Exists as the admin overview for
 * browsing registered users.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/response";
import {
	Avatar,
	Badge,
	Link,
	LinkButton,
	Pagination,
	PaginationButton,
	PaginationItem,
	PaginationLink,
	PaginationList,
	Table,
} from "@pkg/ui";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { AppHeader } from "~/components/app-header";
import { db } from "~/middleware/drizzle";
import Subject from "~/models/subject";

import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
	return [{ title: "Users | Auth" }];
}

const PAGE_SIZE = 10;

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);
	let page = Math.max(1, Number(url.searchParams.get("page")) || 1);
	let offset = (page - 1) * PAGE_SIZE;

	let [subjects, totalCount] = await Promise.all([
		Subject.findAll(db(), { limit: PAGE_SIZE, offset }),
		Subject.count(db()),
	]);

	let totalPages = Math.ceil(totalCount / PAGE_SIZE);

	return ok({
		subjects: subjects.map((s) => ({
			id: s.id,
			displayName: s.displayName,
			username: s.username,
			emailAddress: s.emailAddress,
			avatar: s.avatar,
			role: s.role,
			createdAt: s.createdAt.toISOString(),
		})),
		pagination: {
			page,
			totalPages,
			totalCount,
		},
	});
}

export default function SubjectsListPage({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "admin.subjects" });
	let { subjects, pagination } = loaderData;
	let [searchParams] = useSearchParams();

	function getPageUrl(page: number) {
		let params = new URLSearchParams(searchParams);
		params.set("page", page.toString());
		return `?${params.toString()}`;
	}

	return (
		<>
			<AppHeader heading={t("title")} />

			<p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t("description")}</p>

			{subjects.length === 0 ? (
				<div className="mt-8 rounded-lg border border-neutral-200 p-8 text-center dark:border-neutral-700">
					<p className="text-neutral-500">{t("empty")}</p>
				</div>
			) : (
				<>
					<Table aria-label={t("title")} className="mt-6">
						<Table.Header>
							<Table.Column>{t("table.avatar")}</Table.Column>
							<Table.Column isRowHeader>{t("table.displayName")}</Table.Column>
							<Table.Column>{t("table.email")}</Table.Column>
							<Table.Column>{t("table.role")}</Table.Column>
							<Table.Column>{t("table.createdAt")}</Table.Column>
							<Table.Column>{t("table.actions")}</Table.Column>
						</Table.Header>
						<Table.Body items={subjects}>
							{(subject) => (
								<Table.Row id={subject.id}>
									<Table.Cell>
										<Avatar>
											<Avatar.Image src={subject.avatar} alt={subject.displayName} />
											<Avatar.Fallback>
												{subject.displayName.slice(0, 2).toUpperCase()}
											</Avatar.Fallback>
										</Avatar>
									</Table.Cell>
									<Table.Cell>
										<Link href={`subjects/${subject.id}`} className="font-medium hover:underline">
											{subject.displayName}
										</Link>
										<p className="text-sm text-neutral-500">@{subject.username}</p>
									</Table.Cell>
									<Table.Cell className="text-sm">{subject.emailAddress}</Table.Cell>
									<Table.Cell>
										<Badge color={subject.role === "admin" ? "primary" : "neutral"}>
											{t(`roles.${subject.role}`)}
										</Badge>
									</Table.Cell>
									<Table.Cell>
										{new Date(subject.createdAt).toLocaleDateString(undefined, {
											year: "numeric",
											month: "short",
											day: "numeric",
										})}
									</Table.Cell>
									<Table.Cell>
										<div className="flex gap-2">
											<LinkButton href={`subjects/${subject.id}`} size="sm" color="neutral">
												{t("actions.view")}
											</LinkButton>
											<LinkButton href={`subjects/${subject.id}/edit`} size="sm" color="neutral">
												{t("actions.edit")}
											</LinkButton>
										</div>
									</Table.Cell>
								</Table.Row>
							)}
						</Table.Body>
					</Table>

					{pagination.totalPages > 1 && (
						<Pagination aria-label="Users pagination" className="mt-4 flex justify-center">
							<PaginationList>
								<PaginationItem>
									<PaginationButton
										aria-label="Previous page"
										isDisabled={pagination.page === 1}
										onPress={() => {
											window.location.href = getPageUrl(pagination.page - 1);
										}}
									>
										Previous
									</PaginationButton>
								</PaginationItem>
								{Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
									<PaginationItem key={page}>
										<PaginationLink href={getPageUrl(page)} isCurrent={page === pagination.page}>
											{page}
										</PaginationLink>
									</PaginationItem>
								))}
								<PaginationItem>
									<PaginationButton
										aria-label="Next page"
										isDisabled={pagination.page === pagination.totalPages}
										onPress={() => {
											window.location.href = getPageUrl(pagination.page + 1);
										}}
									>
										Next
									</PaginationButton>
								</PaginationItem>
							</PaginationList>
						</Pagination>
					)}
				</>
			)}
		</>
	);
}
