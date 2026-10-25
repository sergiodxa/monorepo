/**
 * Messages from RFC 8935's and RFC 8936's figures, as the RFCs print them, so push and
 * poll delivery are checked against the specifications' own examples.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** RFC 8935 Figure 3: a recipient refusing a SET whose key was revoked. */
export const INVALID_KEY_ERROR = {
	err: "invalid_key",
	description: "Key ID 12345 has been revoked.",
};

/** RFC 8935 Figure 4: a recipient refusing a transmitter whose access token expired. */
export const AUTHENTICATION_FAILED_ERROR = {
	err: "authentication_failed",
	description: "Access token has expired.",
};

/** RFC 8935 Figure 5: a recipient refusing SETs from an issuer for this transmitter. */
export const INVALID_ISSUER_ERROR = {
	err: "invalid_issuer",
	description: "Not authorized for issuer https://iss.example.com/",
};

/** The `jti` of the SCIM create SET RFC 8936 Figure 6 delivers. */
export const CREATE_ID = "4d3559ec67504aaba65d40b0363faad8";

/** The `jti` of the SCIM password reset SET RFC 8936 Figure 6 delivers. */
export const PASSWORD_RESET_ID = "3d0c3cf797584bd193bd0fb1bd4e7d30";

/** RFC 8936 Figure 1: an initial poll that answers at once. */
export const INITIAL_POLL = { returnImmediately: true };

/** RFC 8936 Figure 2: a poll with every default. */
export const DEFAULT_POLL = {};

/** RFC 8936 Figure 3: acknowledging both SETs of Figure 6 without receiving more. */
export const ACKNOWLEDGE_ONLY = {
	ack: [CREATE_ID, PASSWORD_RESET_ID],
	maxEvents: 0,
	returnImmediately: true,
};

/** RFC 8936 Figure 4: acknowledging both SETs of Figure 6 and waiting for the next. */
export const POLL_WITH_ACK = {
	ack: [CREATE_ID, PASSWORD_RESET_ID],
	returnImmediately: false,
};

/** RFC 8936 Figure 5: acknowledging one SET of Figure 6 and reporting the other invalid. */
export const POLL_WITH_ERRORS = {
	ack: [PASSWORD_RESET_ID],
	setErrs: {
		[CREATE_ID]: {
			err: "authentication_failed",
			description: "The SET could not be authenticated",
		},
	},
	returnImmediately: true,
};

/** RFC 8936 Figure 6: two unsecured SETs delivered by `jti`. */
export const POLL_RESPONSE = {
	sets: {
		[CREATE_ID]:
			"eyJhbGciOiJub25lIn0." +
			"eyJqdGkiOiI0ZDM1NTllYzY3NTA0YWFiYTY1ZDQwYjAzNjNmYWFkOCIsImlhdC" +
			"I6MTQ1ODQ5NjQwNCwiaXNzIjoiaHR0cHM6Ly9zY2ltLmV4YW1wbGUuY29tIiwi" +
			"YXVkIjpbImh0dHBzOi8vc2NpbS5leGFtcGxlLmNvbS9GZWVkcy85OGQ1MjQ2MW" +
			"ZhNWJiYzg3OTU5M2I3NzU0IiwiaHR0cHM6Ly9zY2ltLmV4YW1wbGUuY29tL0Zl" +
			"ZWRzLzVkNzYwNDUxNmIxZDA4NjQxZDc2NzZlZTciXSwiZXZlbnRzIjp7InVybj" +
			"ppZXRmOnBhcmFtczpzY2ltOmV2ZW50OmNyZWF0ZSI6eyJyZWYiOiJodHRwczov" +
			"L3NjaW0uZXhhbXBsZS5jb20vVXNlcnMvNDRmNjE0MmRmOTZiZDZhYjYxZTc1Mj" +
			"FkOSIsImF0dHJpYnV0ZXMiOlsiaWQiLCJuYW1lIiwidXNlck5hbWUiLCJwYXNz" +
			"d29yZCIsImVtYWlscyJdfX19.",
		[PASSWORD_RESET_ID]:
			"eyJhbGciOiJub25lIn0." +
			"eyJqdGkiOiIzZDBjM2NmNzk3NTg0YmQxOTNiZDBmYjFiZDRlN2QzMCIsImlhdC" +
			"I6MTQ1ODQ5NjAyNSwiaXNzIjoiaHR0cHM6Ly9zY2ltLmV4YW1wbGUuY29tIiwi" +
			"YXVkIjpbImh0dHBzOi8vamh1Yi5leGFtcGxlLmNvbS9GZWVkcy85OGQ1MjQ2MW" +
			"ZhNWJiYzg3OTU5M2I3NzU0IiwiaHR0cHM6Ly9qaHViLmV4YW1wbGUuY29tL0Zl" +
			"ZWRzLzVkNzYwNDUxNmIxZDA4NjQxZDc2NzZlZTciXSwic3ViIjoiaHR0cHM6Ly" +
			"9zY2ltLmV4YW1wbGUuY29tL1VzZXJzLzQ0ZjYxNDJkZjk2YmQ2YWI2MWU3NTIx" +
			"ZDkiLCJldmVudHMiOnsidXJuOmlldGY6cGFyYW1zOnNjaW06ZXZlbnQ6cGFzc3" +
			"dvcmRSZXNldCI6eyJpZCI6IjQ0ZjYxNDJkZjk2YmQ2YWI2MWU3NTIxZDkifSwi" +
			"aHR0cHM6Ly9leGFtcGxlLmNvbS9zY2ltL2V2ZW50L3Bhc3N3b3JkUmVzZXRFeH" +
			"QiOnsicmVzZXRBdHRlbXB0cyI6NX19fQ.",
	},
};

/** RFC 8936 Figure 7: nothing pending. */
export const EMPTY_POLL_RESPONSE = { sets: {} };
