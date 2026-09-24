/**
 * Resources modeled on RFC 7643's §8.2 full User, §8.3 Enterprise User and §8.4 Group
 * examples, for tests to filter, patch and project. The IETF Trust publishes RFC code
 * components under the Simplified BSD License.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** After RFC 7643 §8.2, "Full User Representation". */
export const FULL_USER = {
	schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
	id: "2819c223-7f76-453a-919d-413861904646",
	externalId: "701984",
	userName: "bjensen@example.com",
	name: {
		formatted: "Ms. Barbara J Jensen, III",
		familyName: "Jensen",
		givenName: "Barbara",
		middleName: "Jane",
		honorificPrefix: "Ms.",
		honorificSuffix: "III",
	},
	displayName: "Babs Jensen",
	nickName: "Babs",
	profileUrl: "https://login.example.com/bjensen",
	emails: [
		{ value: "bjensen@example.com", type: "work", primary: true },
		{ value: "babs@jensen.org", type: "home" },
	],
	addresses: [
		{
			type: "work",
			streetAddress: "100 Universal City Plaza",
			locality: "Hollywood",
			region: "CA",
			postalCode: "91608",
			country: "USA",
			formatted: "100 Universal City Plaza\nHollywood, CA 91608 USA",
			primary: true,
		},
		{
			type: "home",
			streetAddress: "456 Hollywood Blvd",
			locality: "Hollywood",
			region: "CA",
			postalCode: "91608",
			country: "USA",
			formatted: "456 Hollywood Blvd\nHollywood, CA 91608 USA",
		},
	],
	phoneNumbers: [
		{ value: "555-555-5555", type: "work" },
		{ value: "555-555-4444", type: "mobile" },
	],
	ims: [{ value: "someaimhandle", type: "aim" }],
	photos: [
		{ value: "https://photos.example.com/profilephoto/72930000000Ccne/F", type: "photo" },
		{ value: "https://photos.example.com/profilephoto/72930000000Ccne/T", type: "thumbnail" },
	],
	userType: "Employee",
	title: "Tour Guide",
	preferredLanguage: "en-US",
	locale: "en-US",
	timezone: "America/Los_Angeles",
	active: true,
	password: "t1meMa$heen",
	groups: [
		{
			value: "e9e30dba-f08f-4109-8486-d5c6a331660a",
			$ref: "https://example.com/v2/Groups/e9e30dba-f08f-4109-8486-d5c6a331660a",
			display: "Tour Guides",
		},
		{
			value: "fc348aa8-3835-40eb-a20b-c726e15c55b5",
			$ref: "https://example.com/v2/Groups/fc348aa8-3835-40eb-a20b-c726e15c55b5",
			display: "Employees",
		},
		{
			value: "71ddacd2-a8e7-49b8-a5db-ae50d0a5bfd7",
			$ref: "https://example.com/v2/Groups/71ddacd2-a8e7-49b8-a5db-ae50d0a5bfd7",
			display: "US Employees",
		},
	],
	x509Certificates: [{ value: "MIIDQzCCAqygAwIBAgICEAAwDQYJKoZIhvcNAQEFBQAwTjELMAkGA1UEBhMCVVMx" }],
	meta: {
		resourceType: "User",
		created: "2010-01-23T04:56:22Z",
		lastModified: "2011-05-13T04:42:34Z",
		version: 'W/"a330bc54f0671c9"',
		location: "https://example.com/v2/Users/2819c223-7f76-453a-919d-413861904646",
	},
};

/** After RFC 7643 §8.3, "Enterprise User Extension Representation", trimmed to fewer core members. */
export const ENTERPRISE_USER = {
	schemas: [
		"urn:ietf:params:scim:schemas:core:2.0:User",
		"urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
	],
	id: "2819c223-7f76-453a-919d-413861904646",
	externalId: "701984",
	userName: "bjensen@example.com",
	userType: "Employee",
	active: true,
	emails: [{ value: "bjensen@example.com", type: "work", primary: true }],
	"urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {
		employeeNumber: "701984",
		costCenter: "4130",
		organization: "Universal Studios",
		division: "Theme Park",
		department: "Tour Operations",
		manager: {
			value: "26118915-6090-4610-87e4-49d8ca9f808d",
			$ref: "../Users/26118915-6090-4610-87e4-49d8ca9f808d",
			displayName: "John Smith",
		},
	},
	meta: {
		resourceType: "User",
		created: "2010-01-23T04:56:22Z",
		lastModified: "2011-05-13T04:42:34Z",
		version: 'W/"3694e05e9dff591"',
		location: "https://example.com/v2/Users/2819c223-7f76-453a-919d-413861904646",
	},
};

/** After RFC 7643 §8.4, "Group Representation". */
export const GROUP = {
	schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
	id: "e9e30dba-f08f-4109-8486-d5c6a331660a",
	displayName: "Tour Guides",
	members: [
		{
			value: "2819c223-7f76-453a-919d-413861904646",
			$ref: "https://example.com/v2/Users/2819c223-7f76-453a-919d-413861904646",
			display: "Babs Jensen",
		},
		{
			value: "902c246b-6245-4190-8e05-00816be7344a",
			$ref: "https://example.com/v2/Users/902c246b-6245-4190-8e05-00816be7344a",
			display: "Mandy Pepperidge",
		},
	],
	meta: {
		resourceType: "Group",
		created: "2010-01-23T04:56:22Z",
		lastModified: "2011-05-13T04:42:34Z",
		version: 'W/"3694e05e9dff592"',
		location: "https://example.com/v2/Groups/e9e30dba-f08f-4109-8486-d5c6a331660a",
	},
};
