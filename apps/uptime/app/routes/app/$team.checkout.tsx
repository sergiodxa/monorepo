/**
 * Route for a team's checkout flow: its loader routes the team owner to a Polar
 * customer portal when a subscription is active or to a hosted checkout otherwise,
 * while non-owners get a 403 with their year-to-date ping usage. It exists to gate
 * billing to owners and drive subscription purchase for the app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Card } from "@pkg/ui";
import { startOfYear } from "date-fns";
import { useTranslation } from "react-i18next";
import { data, href, redirectDocument } from "react-router";

import polar from "~/clients/polar";
import { AppHeader } from "~/components/app-header";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { logger } from "~/middleware/logger";
import { subject } from "~/middleware/subject";
import { team } from "~/middleware/team";
import Customer from "~/models/customer";

import type { Route } from "./+types/$team.checkout";

const PING_METER_ID = "22fabd9b-8b03-4cc2-8981-230717267cd5";

export async function loader({ request }: Route.LoaderArgs) {
	logger().info("checkout.loader.start", {
		route: "checkout",
		teamId: team().id,
	});

	let ownerId = team().ownerId;

	if (subject().id !== ownerId) {
		logger().info("checkout.loader.forbidden", {
			route: "checkout",
			teamId: team().id,
			reason: "non-owner accessing checkout",
		});

		let { total, quantities } = await polar.meters.quantities({
			externalCustomerId: ownerId,
			startTimestamp: startOfYear(new Date()),
			endTimestamp: new Date(),
			interval: "day",
			id: PING_METER_ID,
		});

		return data(
			{ total, quantities: quantities.filter((q) => q.quantity > 0) },
			{ status: 403, statusText: "Forbidden" },
		);
	}

	if (await hasActiveSubscription()) {
		logger().info("checkout.loader.redirect-to-portal", {
			route: "checkout",
			teamId: team().id,
		});

		let { customerPortalUrl } = await polar.customerSessions.create({
			externalCustomerId: ownerId,
		});

		return redirectDocument(customerPortalUrl);
	}

	logger().info("checkout.loader.redirect-to-checkout", {
		route: "checkout",
		teamId: team().id,
	});

	let checkout = await Customer.checkout(
		ownerId,
		new URL(href("/app/:team/dashboard", { team: team().slug }), request.url).toString(),
	);

	return redirectDocument(checkout.url);
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let { t, i18n } = useTranslation("translation", {
		keyPrefix: "page.billing",
	});
	return (
		<>
			<AppHeader heading={t("header.title")} />

			<Card>
				<Card.Header>
					<Card.Title>Usage Quantities</Card.Title>
					<Card.Description>Your monitored quantities over time</Card.Description>
				</Card.Header>
				<Card.Content>
					<ol className="space-y-2">
						{loaderData.quantities.map((q) => (
							<li key={q.timestamp.getTime()} className="flex justify-between text-sm">
								<time dateTime={q.timestamp.toISOString()}>
									{new Date(q.timestamp).toLocaleDateString(i18n.language)}
								</time>
								<span className="font-medium">{q.quantity.toLocaleString(i18n.language)}</span>
							</li>
						))}
					</ol>
				</Card.Content>
			</Card>
		</>
	);
}
