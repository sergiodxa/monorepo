import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import methodOverride from "./middleware/method-override";

import polarWebhook from "./controllers/api/webhooks/polar";
import dashboardIndex from "./controllers/dashboard/index";
import tenants from "./controllers/dashboard/tenants";
import billing from "./controllers/dashboard/tenants/billing";
import branding from "./controllers/dashboard/tenants/branding";
import clients from "./controllers/dashboard/tenants/clients";
import logoutUris from "./controllers/dashboard/tenants/clients/logout-uris";
import redirectUris from "./controllers/dashboard/tenants/clients/redirect-uris";
import secrets from "./controllers/dashboard/tenants/clients/secrets";
import hostname from "./controllers/dashboard/tenants/hostname";
import resources from "./controllers/dashboard/tenants/resources";
import scopes from "./controllers/dashboard/tenants/resources/scopes";
import users from "./controllers/dashboard/tenants/users";
import health from "./controllers/health";
import index from "./controllers/index";
import notFound from "./controllers/not-found";
import onboardingCallback from "./controllers/onboarding/callback";
import onboardingIndex from "./controllers/onboarding/index";
import csrf from "./middleware/csrf";
import database from "./middleware/db";
import logger from "./middleware/logger";
import session from "./middleware/session";
import subscription from "./middleware/subscription";
import tenantOwner from "./middleware/tenant-owner";
import trailingSlash from "./middleware/trailing-slash";
import routes from "./routes";

export const router = createRouter({
	middleware: [trailingSlash, logger, database, formData(), methodOverride],
	defaultHandler: notFound,
});

router.map(routes, {
	middleware: [],

	actions: {
		index,
		health,

		api: {
			middleware: [],
			actions: {
				webhooks: {
					middleware: [],
					actions: {
						polar: polarWebhook,
					},
				},
			},
		},

		onboarding: {
			middleware: [],
			actions: {
				index: onboardingIndex,
				callback: onboardingCallback,
			},
		},

		dashboard: {
			middleware: [session, csrf],

			actions: {
				index: dashboardIndex,

				tenants: {
					middleware: [],

					actions: {
						...tenants,

						clients: {
							middleware: [tenantOwner, subscription],

							actions: {
								...clients,
								...redirectUris,
								...logoutUris,
								...secrets,
							},
						},

						users: { middleware: [tenantOwner, subscription], actions: users },

						resources: {
							middleware: [tenantOwner, subscription],

							actions: {
								...resources,
								scopes: { middleware: [], actions: scopes },
							},
						},

						branding,
						hostname,
						billing,
					},
				},
			},
		},
	},
});
