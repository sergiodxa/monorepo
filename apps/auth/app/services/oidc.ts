import { eq } from "drizzle-orm";

import * as schema from "~/db/schema";
import AuthzCode from "~/entities/authz-code";
import { db } from "~/middleware/drizzle";
import { getSigningKey } from "~/modules/jwks";
import { OIDCProvider } from "~/modules/oauth2";

export default new OIDCProvider(
	"auth.sergiodxa.com", // The issuer name
	// The repositories required by the OIDCProvider
	{
		getSigningKey,
		async findClientById(clientId) {
			let client = await db().query.clients.findFirst({
				where(fields, operators) {
					return operators.eq(fields.id, clientId);
				},
			});

			return client ?? null;
		},

		async findAuthorizationCodeData(code) {
			let authz = await AuthzCode.find(code);
			if (authz) return authz;
			throw new Error("Authorization code not found.");
		},

		async findSessionById(sessionId) {
			let session = await db().query.sessions.findFirst({
				where(fields, operators) {
					return operators.eq(fields.id, sessionId);
				},
			});

			return session ?? null;
		},

		async findSubjectById(subjectId) {
			let subject = await db().query.subjects.findFirst({
				where(fields, operators) {
					return operators.eq(fields.id, subjectId);
				},
			});

			return subject ?? null;
		},

		async deleteSessionById(sessionId) {
			await db().delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
		},

		async deleteSessionBySubjectId(subjectId) {
			await db().delete(schema.sessions).where(eq(schema.sessions.subjectId, subjectId));
		},
	},
);
