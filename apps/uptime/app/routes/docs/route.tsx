import prismDark from "@pkg/markdown/styles/dark.css?url";
import prismLight from "@pkg/markdown/styles/light.css?url";
import { Breadcrumb, BreadcrumbLink, Breadcrumbs, Button, Sheet, SheetTrigger } from "@pkg/ui";
import Fuse from "fuse.js";
import { Menu } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation } from "react-router";

import { generateMeta } from "~/lib/seo";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { listDocs } from "~/modules/docs";

import type { Route } from "./+types/route";

import { Sidebar } from "./components/sidebar";

export let links: Route.LinksFunction = () => [
	{ rel: "stylesheet", href: prismLight, media: "(prefers-color-scheme: light)" },
	{ rel: "stylesheet", href: prismDark, media: "(prefers-color-scheme: dark)" },
];

export let meta: Route.MetaFunction = ({ loaderData }) => loaderData?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let log = logger();
	let { t } = i18next(context);

	let sections = await listDocs();

	log.info("docs.layout.load", { sectionCount: sections.length });

	return {
		sections,
		meta: generateMeta({
			title: t("docs.meta.title"),
			description: t("docs.meta.description"),
			url: request.url,
		}),
	};
}

export default function DocsLayout({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation();
	let location = useLocation();
	let { sections } = loaderData;
	let [search, setSearch] = useState("");
	let [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	let fuse = useMemo(() => {
		return new Fuse(
			sections.flatMap((section) => section.docs),
			{ keys: ["frontmatter.title"], threshold: 0.4 },
		);
	}, [sections]);

	let searchResults = useMemo(() => {
		if (search.trim().length === 0) return null;
		return fuse.search(search).map((result) => result.item);
	}, [fuse, search]);

	let pathSegments = location.pathname.split("/").filter(Boolean);
	let breadcrumbItems = pathSegments.map((segment, index) => {
		let href = "/" + pathSegments.slice(0, index + 1).join("/");
		let label = segment.replace(/-/g, " ");
		return { href, label };
	});

	return (
		<div className="flex min-h-screen bg-white dark:bg-neutral-950">
			<aside className="hidden w-64 border-r border-neutral-200 bg-neutral-50 md:block dark:border-neutral-800 dark:bg-neutral-900">
				<Sidebar
					sections={sections}
					search={search}
					onSearchChange={setSearch}
					searchResults={searchResults}
					searchPlaceholder={t("docs.sidebar.searchPlaceholder")}
					title={t("docs.sidebar.title")}
					description={t("docs.sidebar.description")}
				/>
			</aside>

			<div className="flex flex-1 flex-col">
				<div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-50/50 px-4 py-3 md:px-6 dark:border-neutral-800 dark:bg-neutral-900/50">
					<SheetTrigger isOpen={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
						<Button
							variant="ghost"
							size="sm"
							className="md:hidden"
							aria-label={t("docs.sidebar.openMenu")}
						>
							<Menu className="size-5" />
						</Button>

						<Sheet.Overlay>
							<Sheet side="left" className="w-72">
								<Sheet.Content className="h-full overflow-hidden bg-neutral-50 p-1 dark:bg-neutral-900">
									<Sidebar
										sections={sections}
										search={search}
										onSearchChange={setSearch}
										searchResults={searchResults}
										searchPlaceholder={t("docs.sidebar.searchPlaceholder")}
										title={t("docs.sidebar.title")}
										description={t("docs.sidebar.description")}
										onClose={() => setMobileMenuOpen(false)}
										closeLabel={t("docs.sidebar.closeMenu")}
									/>
								</Sheet.Content>
							</Sheet>
						</Sheet.Overlay>
					</SheetTrigger>

					<Breadcrumbs>
						{breadcrumbItems.map((item, index) => (
							<Breadcrumb key={item.href}>
								<BreadcrumbLink
									href={item.href}
									className={index === breadcrumbItems.length - 1 ? "font-medium" : undefined}
								>
									{item.label}
								</BreadcrumbLink>
							</Breadcrumb>
						))}
					</Breadcrumbs>
				</div>

				<main className="flex-1">
					<div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	);
}
