/**
 * Security Event Tokens from RFC 9967's figures, as the claim sets the RFC prints, so the
 * event builders are checked against the specification's own examples.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Figure 4: a `create:full` event carrying the created User. */
export const CREATE_FULL = {
	jti: "4d3559ec67504aaba65d40b0363faad8",
	iat: 1458496404,
	iss: "https://scim.example.com",
	aud: [
		"https://scim.example.com/Feeds/98d52461fa5bbc879593b7754",
		"https://scim.example.com/Feeds/5d7604516b1d08641d7676ee7",
	],
	sub_id: { format: "scim", uri: "/Users/44f6142df96bd6ab61e7521d9", externalId: "jdoe" },
	events: {
		"urn:ietf:params:scim:event:prov:create:full": {
			data: {
				schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
				emails: [{ type: "work", value: "jdoe@example.com" }],
				userName: "jdoe",
				name: { givenName: "John", familyName: "Doe" },
			},
		},
	},
};

/** Figure 5: the same creation as a `create:notice` naming the attributes set. */
export const CREATE_NOTICE = {
	...CREATE_FULL,
	events: {
		"urn:ietf:params:scim:event:prov:create:notice": {
			attributes: ["id", "name", "userName", "password", "emails"],
		},
	},
};

/** Figure 6: a `patch:full` event carrying the applied `PatchOp`. */
export const PATCH_FULL = {
	jti: "6164f3bbf6ff41a88dc94f18cb0620e8",
	sub_id: {
		format: "scim",
		uri: "/Groups/176f397ec4c44b94b2cfcb759780b8c2",
		externalId: "crmUsers",
	},
	events: {
		"urn:ietf:params:scim:event:prov:patch:full": {
			version: "a330bc54f0671c9",
			data: {
				schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
				Operations: [
					{
						op: "add",
						path: "members",
						value: [
							{
								display: "Babs Jensen",
								$ref: "/Users/2819c223...413861904646",
								value: "2819c223-7f76-453a-919d-413861904646",
							},
						],
					},
				],
			},
		},
	},
	iat: 1458505044,
	iss: "https://scim.example.com",
	aud: ["https://scim.example.com/Feeds/98d52461fa5bbc879593b7754"],
};

/** Figure 7: the same patch as a `patch:notice`. */
export const PATCH_NOTICE = {
	...PATCH_FULL,
	events: {
		"urn:ietf:params:scim:event:prov:patch:notice": {
			attributes: ["members"],
			version: "a330bc54f0671c9",
		},
	},
};

/** Figure 10: a `delete` event, which has no payload attributes. */
export const DELETE = {
	jti: "6164f3bbf6ff41a88dc94f18cb0620e8",
	sub_id: { format: "scim", uri: "/Users/2b2f880af6674ac284bae9381673d462", externalId: "jDoe" },
	events: { "urn:ietf:params:scim:event:prov:delete": {} },
	iat: 1458505044,
	iss: "https://scim.example.com",
	aud: ["https://scim.example.com/Feeds/98d52461fa5bbc879593b7754"],
};

/** Figure 14: an `asyncresp` event completing an asynchronous `PUT`. */
export const ASYNC_RESPONSE = {
	jti: "6164f3bbf6ff41a88dc94f18cb0620e8",
	sub_id: { format: "scim", uri: "/Users/2819c223-7f76-453a-919d-413861904646" },
	txn: "734f0614e3274f288f93ac74119dcf78",
	events: {
		"urn:ietf:params:scim:event:misc:asyncresp": {
			method: "PUT",
			version: 'W/"huJj29dMNgu3WXPD"',
			status: "200",
		},
	},
	iat: 1458505044,
	iss: "https://scim.example.com",
	aud: ["https://scim.example.com/Feeds/98d52461fa5bbc879593b7754"],
};

/** Figure 15: an `asyncresp` event for a request that failed. */
export const ASYNC_ERROR = {
	...ASYNC_RESPONSE,
	events: {
		"urn:ietf:params:scim:event:misc:asyncresp": {
			method: "PUT",
			version: 'W/"huJj29dMNgu3WXPD"',
			status: "400",
			response: {
				schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
				scimType: "invalidSyntax",
				detail: "Request is unparsable",
				status: "400",
			},
		},
	},
};
