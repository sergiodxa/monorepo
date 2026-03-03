import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

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
import onboardingFinish from "./controllers/onboarding/finish";
import onboardingIndex from "./controllers/onboarding/index";
import onboardingRegion from "./controllers/onboarding/region";
import webauthnAuthOptions from "./controllers/onboarding/webauthn/auth-options";
import webauthnAuthVerify from "./controllers/onboarding/webauthn/auth-verify";
import webauthnRegisterOptions from "./controllers/onboarding/webauthn/register-options";
import webauthnRegisterVerify from "./controllers/onboarding/webauthn/register-verify";
import database from "./middleware/db";
import logger from "./middleware/logger";
import session from "./middleware/session";
import subscription from "./middleware/subscription";
import tenantOwner from "./middleware/tenant-owner";
import routes from "./routes";

export const router = createRouter({
	middleware: [logger, database, formData()],
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
				region: onboardingRegion,
				finish: onboardingFinish,

				webauthn: {
					middleware: [],
					actions: {
						register: {
							middleware: [],
							actions: {
								options: webauthnRegisterOptions,
								verify: webauthnRegisterVerify,
							},
						},
						auth: {
							middleware: [],
							actions: {
								options: webauthnAuthOptions,
								verify: webauthnAuthVerify,
							},
						},
					},
				},
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
