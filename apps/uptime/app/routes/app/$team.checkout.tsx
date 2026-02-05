import { startOfYear } from "date-fns";
import { useTranslation } from "react-i18next";
import { data, href, redirectDocument } from "react-router";

import polar from "~/clients/polar";
import { AppHeader } from "~/components/app-header";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { subject } from "~/middleware/subject";
import { team } from "~/middleware/team";
import Customer from "~/models/customer";

import type { Route } from "./+types/$team.checkout";

const PING_METER_ID = "22fabd9b-8b03-4cc2-8981-230717267cd5";

export async function loader({ request }: Route.LoaderArgs) {
	let ownerId = team().ownerId;

	if (subject().id !== ownerId) {
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
		let { customerPortalUrl } = await polar.customerSessions.create({
			externalCustomerId: ownerId,
		});

		return redirectDocument(customerPortalUrl);
	}

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

			<ol>
				{loaderData.quantities.map((q) => {
					return (
						<li key={q.timestamp.getTime()}>
							<time dateTime={q.timestamp.toISOString()}>
								{new Date(q.timestamp).toLocaleDateString(i18n.language)}
							</time>
							-
							{q.quantity.toLocaleString(i18n.language, {
								minimumFractionDigits: 0,
								maximumFractionDigits: 0,
							})}
						</li>
					);
				})}
			</ol>
		</>
	);
}
