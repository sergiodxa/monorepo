/**
 * Tenant home page controller and view for the provider root (`/`).
 *
 * Renders a status page for the active tenant showing branding plus client and
 * user counts, and lists the key OAuth/OIDC endpoints the tenant exposes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ok } from "@pkg/http/response/html";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";
import { css } from "remix/ui";
import { renderToString } from "remix/ui/server";

import Brand from "../branding/models/brand";
import Client from "../clients/models/client";
import routes from "../routes";
import Subject from "../subjects/models/subject";

import { Layout } from "./layout";

/**
 * `GET /` action rendering the tenant home page with live client/user counts.
 *
 * Loads branding and aggregate counts from the tenant database and returns the
 * rendered HTML document.
 * @returns An HTML `Response` with the tenant status page.
 */
export default createAction(routes.index, async ({ logger }) => {
	let db = getServiceContainer().get(Database);
	let log = logger.loader("/");

	let [brand, clientCount, subjectCount] = await Promise.all([
		Brand.show(db),
		Client.list(db).then((clients) => clients.length),
		Subject.list(db).then((subjects) => subjects.length),
	]);

	log.info("Tenant home loaded", { clientCount, subjectCount });

	let body = await renderToString(
		<TenantHomePage brand={brand} stats={{ clients: clientCount, subjects: subjectCount }} />,
	);
	return ok(body);
});

interface TenantHomePageProps {
	brand: Awaited<ReturnType<typeof Brand.show>>;
	stats: { clients: number; subjects: number };
}

/**
 * Renders the tenant home page describing the active authentication service.
 * @param handle - Component handle exposing the brand and stats props.
 * @returns A render function producing the page markup.
 */
function TenantHomePage(handle: Handle<TenantHomePageProps>) {
	return () => {
		let { brand, stats } = handle.props;
		let primaryColor = brand.primary_color;
		let backgroundColor = brand.background_color;

		return (
			<Layout title="Tenant Home">
				<div
					mix={[
						css({
							minHeight: "100vh",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: backgroundColor,
							padding: "1rem",
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: "500px",
								width: "100%",
								backgroundColor: "#fff",
								borderRadius: "0.5rem",
								boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
								padding: "2rem",
								textAlign: "center",
							}),
						]}
					>
						{brand.logo_url && (
							<img
								src={brand.logo_url}
								alt="Logo"
								mix={[
									css({
										maxWidth: "150px",
										marginBottom: "1.5rem",
										marginLeft: "auto",
										marginRight: "auto",
										display: "block",
									}),
								]}
							/>
						)}

						<div
							mix={[
								css({
									width: "64px",
									height: "64px",
									borderRadius: "50%",
									backgroundColor: primaryColor,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									margin: "0 auto 1.5rem",
								}),
							]}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								mix={[css({ width: "32px", height: "32px", color: "#fff" })]}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
								/>
							</svg>
						</div>

						<h1
							mix={[
								css({
									fontSize: "1.5rem",
									fontWeight: "600",
									color: "#111827",
									marginBottom: "0.5rem",
								}),
							]}
						>
							Authentication Service
						</h1>

						<p
							mix={[
								css({
									color: "#6B7280",
									marginBottom: "2rem",
								}),
							]}
						>
							This tenant is active and ready to handle authentication requests.
						</p>

						<div
							mix={[
								css({
									display: "grid",
									gridTemplateColumns: "1fr 1fr",
									gap: "1rem",
									marginBottom: "2rem",
								}),
							]}
						>
							<div
								mix={[
									css({
										backgroundColor: "#F3F4F6",
										borderRadius: "0.5rem",
										padding: "1rem",
									}),
								]}
							>
								<div
									mix={[
										css({
											fontSize: "2rem",
											fontWeight: "700",
											color: primaryColor,
										}),
									]}
								>
									{stats.clients}
								</div>
								<div mix={[css({ fontSize: "0.875rem", color: "#6B7280" })]}>Clients</div>
							</div>

							<div
								mix={[
									css({
										backgroundColor: "#F3F4F6",
										borderRadius: "0.5rem",
										padding: "1rem",
									}),
								]}
							>
								<div
									mix={[
										css({
											fontSize: "2rem",
											fontWeight: "700",
											color: primaryColor,
										}),
									]}
								>
									{stats.subjects}
								</div>
								<div mix={[css({ fontSize: "0.875rem", color: "#6B7280" })]}>Users</div>
							</div>
						</div>

						<div mix={[css({ fontSize: "0.875rem", color: "#9CA3AF" })]}>
							<p mix={[css({ marginBottom: "0.5rem" })]}>Available endpoints:</p>
							<ul mix={[css({ listStyle: "none", padding: 0, margin: 0 })]}>
								<li>
									<code
										mix={[
											css({
												backgroundColor: "#F3F4F6",
												padding: "0.125rem 0.25rem",
												borderRadius: "0.25rem",
											}),
										]}
									>
										/.well-known/openid-configuration
									</code>
								</li>
								<li mix={[css({ marginTop: "0.25rem" })]}>
									<code
										mix={[
											css({
												backgroundColor: "#F3F4F6",
												padding: "0.125rem 0.25rem",
												borderRadius: "0.25rem",
											}),
										]}
									>
										/authorize
									</code>
								</li>
							</ul>
						</div>

						{brand.custom_css && <style>{brand.custom_css}</style>}
					</div>
				</div>
			</Layout>
		);
	};
}
