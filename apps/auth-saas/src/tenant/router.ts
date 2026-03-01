import type { Logger } from "@pkg/logger/request";
import type { Database } from "remix/data-table";

import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import * as brand from "./controllers/api/brand";
import * as clientLogoutUris from "./controllers/api/client/logout-uris";
import * as clientRedirectUris from "./controllers/api/client/redirect-uris";
import * as clientSecrets from "./controllers/api/client/secrets";
import * as clients from "./controllers/api/clients";
import * as resources from "./controllers/api/resources";
import * as subjects from "./controllers/api/subjects";
import jwks from "./controllers/discover/jwks";
import oauth from "./controllers/discover/oauth";
import oidc from "./controllers/discover/oidc";
import notFound from "./controllers/not-found";
import authorize from "./controllers/oauth/authorize";
import introspect from "./controllers/oauth/introspect";
import revoke from "./controllers/oauth/revoke";
import token from "./controllers/oauth/token";
import logout from "./controllers/oidc/logout";
import userinfo from "./controllers/oidc/userinfo";
import verifyEmail from "./controllers/verify-email";
import authOptions from "./controllers/webauthn/auth-options";
import authVerify from "./controllers/webauthn/auth-verify";
import registerOptions from "./controllers/webauthn/register-options";
import registerVerify from "./controllers/webauthn/register-verify";
import database from "./middleware/db";
import logger from "./middleware/logger";
import managementAuth from "./middleware/management-auth";
import routes from "./routes";

export default (db: Database, requestLogger: Logger) => {
	const router = createRouter({
		middleware: [logger(requestLogger), database(db), formData()],
		defaultHandler: notFound,
	});

	router.map(routes, {
		middleware: [],

		actions: {
			verifyEmail,

			webauthn: {
				middleware: [],
				actions: {
					register: {
						middleware: [],
						actions: { options: registerOptions, verify: registerVerify },
					},
					auth: {
						middleware: [],
						actions: { options: authOptions, verify: authVerify },
					},
				},
			},

			oauth: {
				middleware: [],
				actions: { authorize, token, revoke, introspect },
			},

			oidc: {
				middleware: [],
				actions: { userinfo, logout },
			},

			discover: {
				middleware: [],
				actions: { jwks, oauth, oidc },
			},

			api: {
				middleware: [managementAuth()],

				actions: {
					clients: {
						middleware: [],

						actions: {
							...clients,
							secrets: { middleware: [], actions: clientSecrets },
							"logout-uris": { middleware: [], actions: clientLogoutUris },
							"redirect-uris": { middleware: [], actions: clientRedirectUris },
						},
					},

					subjects: { middleware: [], actions: subjects },
					resources: { middleware: [], actions: resources },
					brand: { middleware: [], actions: brand },
				},
			},
		},
	});

	return router;
};
