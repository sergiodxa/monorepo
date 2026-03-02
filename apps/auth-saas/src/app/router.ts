import { createRouter } from "remix/fetch-router";

import dashboardIndex from "./controllers/dashboard/index";
import tenants from "./controllers/dashboard/tenants";
import branding from "./controllers/dashboard/tenants/branding";
import clients from "./controllers/dashboard/tenants/clients";
import logoutUris from "./controllers/dashboard/tenants/clients/logout-uris";
import redirectUris from "./controllers/dashboard/tenants/clients/redirect-uris";
import secrets from "./controllers/dashboard/tenants/clients/secrets";
import hostname from "./controllers/dashboard/tenants/hostname";
import resources from "./controllers/dashboard/tenants/resources";
import scopes from "./controllers/dashboard/tenants/resources/scopes";
import users from "./controllers/dashboard/tenants/users";
import index from "./controllers/index";
import notFound from "./controllers/not-found";
import onboardingFinish from "./controllers/onboarding/finish";
import onboardingIndex from "./controllers/onboarding/index";
import onboardingRegion from "./controllers/onboarding/region";
import database from "./middleware/db";
import logger from "./middleware/logger";
import session from "./middleware/session";
import tenantOwner from "./middleware/tenant-owner";
import routes from "./routes";

export const router = createRouter({
	middleware: [logger, database],
	defaultHandler: notFound,
});

router.map(routes, {
	middleware: [],

	actions: {
		index,

		onboarding: {
			middleware: [],
			actions: {
				index: onboardingIndex,
				region: onboardingRegion,
				finish: onboardingFinish,
			},
		},

		dashboard: {
			middleware: [session],

			actions: {
				index: dashboardIndex,

				tenants: {
					middleware: [],

					actions: {
						...tenants,

						clients: {
							middleware: [tenantOwner],

							actions: {
								...clients,
								...redirectUris,
								...logoutUris,
								...secrets,
							},
						},

						users: { middleware: [tenantOwner], actions: users },

						resources: {
							middleware: [tenantOwner],

							actions: {
								...resources,
								scopes: { middleware: [], actions: scopes },
							},
						},

						branding,
						hostname,
					},
				},
			},
		},
	},
});
