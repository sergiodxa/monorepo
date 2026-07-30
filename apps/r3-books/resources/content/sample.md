# OAuth2 in Simple Terms

Before implementing OAuth2, it's important to understand the core ideas behind it. This guide won’t go into every technical detail, but it will give you the foundation you need to follow along and understand the code.

You’ll learn how the Authorization Code Flow with PKCE works by building it step by step.

## Why OAuth2?

OAuth2 was created to solve a common problem: how can applications securely access a user's data stored in another service?

Imagine you're building a task management app that integrates with Google Calendar to create events. In the past, you'd have to ask users for their Google credentials. That approach had serious problems:

- **Security risks**: Your app had full access to the user's account.
- **Storing passwords**: You had to store and protect user credentials.
- **Bad UX**: Users needed to re-enter credentials every time they changed their password.

OAuth2 solves all of this by introducing a secure, standardized flow. Instead of asking for passwords, your app requests authorization. If the user approves, the app receives an **access token** that grants limited access to their data.

OAuth2 improves security and user experience by:

1. **Protecting credentials**: Your app never sees the user's password.
2. **Providing limited access**: Apps get permission for specific actions only.
3. **Giving users control**: They can revoke access at any time.

## How OAuth2 Works

OAuth2 allows a **Client Application** to access a **Resource Server** on behalf of a **Resource Owner**, using a token issued by an **Authorization Server**. The protocol defines a flow that ensures secure access without exposing sensitive credentials.

Let’s walk through a simplified version of this process:

1. The user (Resource Owner) authorizes the application.
2. The Authorization Server issues an Access Token.
3. The Client Application uses this token to access the Resource Server.
4. The Access Token eventually expires.
5. If a Refresh Token was provided, the application can use it to get a new Access Token without asking the user to log in again.
6. Permissions are defined using scopes, which control what the application can do with the token.

Imagine your app is like a personal assistant that needs temporary access to a user's calendar. Instead of giving it full control (like a password would), the user grants specific, limited access through OAuth2.

The Authorization Server issues a key (Access Token) that only works for certain tasks (like reading events), and for a limited time. Once it expires, the app can ask for a new one using the Refresh Token—if the user initially allowed it.

This way, OAuth2 provides access **without sharing passwords**, **limits what the app can do**, and **lets users revoke access at any time**.

## OpenID Connect

OAuth2 was designed for authorization—it lets applications act on behalf of a user. But it doesn’t define how to identify who the user is. That’s where **OpenID Connect (OIDC)** comes in.

OIDC is an authentication layer built on top of OAuth2. It introduces a new type of token called the **ID Token**, which contains identity information about the user, such as their name, email, and unique ID.

This ID Token is usually returned alongside the Access Token when the user logs in. It’s formatted as a JWT and includes claims that let the Client Application know who the user is—without needing to make another request.

For example, when someone clicks “Sign in with Google,” the app receives an ID Token from Google. Even if it never accesses the user’s calendar or contacts, the ID Token confirms who the user is.

If you’re building an app that needs both authentication (who the user is) and authorization (what the app can access), OpenID Connect lets you do both in a single flow.

## Actors in OAuth2

OAuth2 introduces four main actors that interact during the flow. Understanding each of their roles helps clarify how the protocol works.

- **Resource Owner** – The person or entity that owns the data.
- **Client Application** – The app that wants access to that data.
- **Resource Server** – The API or service that holds the data.
- **Authorization Server** – The system that verifies users and issues tokens.

These roles are always the same, no matter what kind of app you're building.

### Resource Owner

The Resource Owner is the entity that owns the protected data. In most cases, it’s an individual user. But it could also be an organization—for example, a company account that owns documents, calendars, or customer records.

When the Resource Owner grants your app access to their data (like allowing you to read their calendar), they authorize it through the Authorization Server. The app never sees their credentials—only the tokens granted by that authorization.

### Resource Server

The Resource Server is the system that stores and manages the Resource Owner’s data. It could be a REST or GraphQL API, a storage service, or any backend that requires authentication before returning protected data.

When a Client Application sends a request with an Access Token, the Resource Server validates that token—performing multiple validations. If everything is valid, it allows access to the requested resource.

Sometimes the Resource Server and the Authorization Server are the same application. In that case, verifying the token can be as simple as querying the database directly. When they’re separate systems, you’ll often need to verify the token using a JWKS endpoint or introspection (more on this later).

### Client Application

The Client Application is the software requesting access to the Resource Server on behalf of the Resource Owner. It could be a web app, a mobile app, a desktop client, or even a server-side process.

This application doesn’t store the user’s password or credentials. Instead, it follows an OAuth2 flow to obtain an Access Token and, optionally, a Refresh Token. These tokens are then used to securely access the user's data.

In this book, you’ll see examples built using React Router. But everything covered here can be applied to any web application—regardless of the frontend framework or language. React Router is just the example used to make the implementation concrete.

### Authorization Server

The Authorization Server is responsible for authenticating users and issuing tokens. It verifies that the Resource Owner has granted permission and ensures the Client Application is authorized to make that request.

This server handles the login flow, asks the user for consent, and returns tokens if the request is valid. It also exposes endpoints for token issuance, token revocation, introspection, and public key discovery (JWKS).

Popular Authorization Servers include Auth0, Okta, Keycloak, and cloud providers like Google or Microsoft. You can also build your own, but it requires a deep understanding of the protocol and a strong security focus.

Sometimes the Authorization Server is the same as the Resource Server. When that happens, token verification and data access can be handled together in a simpler way.

## Scopes

**Scopes** define the level of access a Client Application has to the user's resources. They ensure the app only requests permissions necessary for its functionality, following the principle of least privilege.

For example, when using an application that integrates with Google Calendar, you might see permissions like:

- **`calendar.read`**: View your calendar events.
- **`calendar.write`**: Create and edit your calendar events.

When the user authorizes an application, the requested scopes are presented explicitly, allowing the user to make an informed decision before granting access.

By limiting applications to the minimum permissions required, OAuth2 significantly reduces security risks and enhances user trust.

In practice, scopes typically appear as a list of permissions granted in a token, for instance:

```js
{
  "scope": "contacts.read contacts.write profile.read"
}
```

The Resource Server then enforces these scopes, ensuring the Client Application only performs authorized operations on behalf of the user.

## Well-Known Endpoints

OAuth2 and OpenID Connect providers expose standardized configuration endpoints under the `.well-known` path. These endpoints allow applications to discover the necessary URLs and capabilities of the Authorization Server without hardcoding them.

This discovery mechanism simplifies client configuration and ensures compatibility with different providers.

In the following sections, you'll learn about the three most important well-known endpoints:

- The OAuth2 Authorization Server Endpoint
- The OpenID Configuration Endpoint
- The JWKS Endpoint

Each of these plays a key role in enabling dynamic and secure communication between your application and the Authorization Server.

### OAuth2 Authorization Server Metadata Endpoint

OAuth2 defines a standard way for Authorization Servers to expose their configuration via a metadata document. This document is served at the `.well-known/oauth-authorization-server` endpoint.

The full URL typically looks like this:

```txt
https://auth.example.com/.well-known/oauth-authorization-server
```

This metadata includes key information such as:

- `issuer`: A unique identifier for the Authorization Server
- `authorization_endpoint`: URL where the client sends users to log in and authorize access
- `token_endpoint`: URL where the client exchanges authorization codes or credentials for tokens
- `revocation_endpoint`: URL to revoke tokens
- `introspection_endpoint`: URL to validate opaque tokens
- `jwks_uri`: URL to fetch the public keys used to verify JWTs
- Supported scopes, grant types, response types, and more

By fetching this metadata dynamically, Client Applications can avoid hardcoding URLs and rely on a single source of truth for server configuration.

This endpoint is especially useful in multi-tenant systems or when supporting multiple OAuth2 providers.

### OpenID Configuration Endpoint

OpenID Connect (OIDC) defines a discovery mechanism similar to OAuth2's metadata. It allows Client Applications to retrieve the server's configuration dynamically by requesting a JSON document from a standardized endpoint.

This document is served at the `.well-known/openid-configuration` path.

The full URL typically looks like this:

```txt
https://auth.example.com/.well-known/openid-configuration
```

The discovery document includes most of the same information as the OAuth2 metadata endpoint, but adds a few OIDC-specific fields such as:

- `userinfo_endpoint`: URL to retrieve user profile information
- `id_token_signing_alg_values_supported`: Supported algorithms for signing ID tokens
- `claims_supported`: Supported claims that may appear in ID tokens
- `subject_types_supported`: How subject identifiers are generated

Just like with OAuth2, this endpoint simplifies client configuration and ensures your application uses the correct settings for the server it’s interacting with.

### JWKS Endpoint

The JWKS (JSON Web Key Set) endpoint provides the public keys used to verify the signature of JSON Web Tokens (JWTs) issued by the Authorization Server.

These keys are exposed as a JSON document at a well-known URL, typically indicated by the `jwks_uri` field in the OAuth2 or OIDC metadata.

A typical URL looks like this:

```txt
https://auth.example.com/.well-known/jwks.json
```

Each key in the JWKS includes metadata such as:

- `kid`: Key ID used to match the key with the JWT
- `alg`: The signing algorithm (e.g., RS256, ES256)
- `kty`: The key type (e.g., RSA, EC)
- `use`: Intended usage (usually `sig` for signature)
- Public key material (`n`, `e`, `x`, `y`, etc.)

The Resource Server uses these public keys to verify that a JWT was issued by a trusted Authorization Server and has not been tampered with.

Since keys may rotate over time, fetching them dynamically ensures clients always use the latest valid keys.

## OAuth2 Flows

OAuth2 defines multiple authorization flows designed to accommodate different types of applications and use cases. Each flow outlines how a Client Application can obtain an access token from the Authorization Server.

Choosing the right flow depends on your application’s architecture, level of trust, and ability to keep secrets securely.

The most common OAuth2 flows are:

- Authorization Code Flow
- Authorization Code Flow with PKCE
- Implicit Flow
- Client Credentials Flow
- Resource Owner Password Credentials (ROPC)
- Device Authorization Flow

This section focuses on the most secure and widely recommended flow for web applications: Authorization Code Flow with PKCE. If you're interested in the other flows, you'll find more details in the Appendix.

### Authorization Code Flow with PKCE

The Authorization Code Flow with PKCE (Proof Key for Code Exchange) is the recommended OAuth2 flow for public clients—apps that cannot store a client secret securely—like mobile apps, SPAs, and even server-rendered web apps.

PKCE adds an additional layer of security to the standard Authorization Code Flow by ensuring that the client exchanging the code for an access token is the same client that initiated the flow.

Here's how the flow works:

1. The Client Application generates a random `code_verifier` and derives a `code_challenge` from it.
2. The user is redirected to the Authorization Server along with the `code_challenge`.
3. The user authenticates and grants access.
4. The Authorization Server redirects back to the Client Application with an authorization code.
5. The Client Application exchanges the code and the original `code_verifier` for an access token.

If the `code_verifier` doesn't match the `code_challenge`, the request is rejected.

This prevents malicious actors from intercepting the authorization code and exchanging it for tokens, since they wouldn’t have access to the original `code_verifier`.

Even if your application runs on the server and _can_ store secrets, using PKCE adds a layer of protection and is now considered a best practice for all OAuth2 applications.

### PKCE (Proof Key for Code Exchange)

PKCE (pronounced "pixy") enhances the Authorization Code Flow by protecting against authorization code interception attacks.

It works by requiring the Client Application to generate a random string called the `code_verifier`. This string is hashed using SHA-256 to produce the `code_challenge`, which is sent to the Authorization Server during the initial request.

Later, when exchanging the authorization code for tokens, the Client Application must send the original `code_verifier`. The Authorization Server hashes this value and compares it to the original `code_challenge`. If they don’t match, the request is denied.

Here’s a simplified version of how the PKCE exchange looks in code:

```ts
let codeVerifier = crypto.randomUUID().replace(/-/g, "");
let codeChallenge = await sha256Base64Url(codeVerifier);

let authorizeUrl = new URL("https://auth.example.com/authorize");
authorizeUrl.searchParams.set("client_id", env.clientId);
authorizeUrl.searchParams.set("response_type", "code");
authorizeUrl.searchParams.set("redirect_uri", env.redirectURI);
authorizeUrl.searchParams.set("code_challenge", codeChallenge);
authorizeUrl.searchParams.set("code_challenge_method", "S256");
```

When the app later exchanges the authorization code for tokens:

```ts
let response = await fetch("https://auth.example.com/token", {
	method: "POST",
	headers: { "Content-Type": "application/x-www-form-urlencoded" },
	body: new URLSearchParams({
		client_id: env.clientId,
		client_secret: env.clientSecret,
		grant_type: "authorization_code",
		code: authorizationCode,
		redirect_uri: env.redirectURI,
		code_verifier: codeVerifier,
	}),
});
```

Since only the original client has access to the `code_verifier`, this ensures a secure exchange—even if someone intercepts the authorization code.

PKCE was originally designed for SPAs and mobile apps, but it's now widely used in server-rendered and hybrid applications for extra protection. Use it by default in any OAuth2 setup.

### Other Flows

OAuth2 defines several flows, or "grant types", to support different types of applications and use cases. Each one handles authentication and token exchange slightly differently depending on where the client runs and how much it can be trusted.

This handbook focuses on the Authorization Code Flow with PKCE, which is the most appropriate for web applications. However, it's worth knowing that other flows exist, especially when working with other types of clients or APIs.

You'll find detailed explanations of these flows—including when to use each, and their tradeoffs—in the appendix.

Here's a quick overview of what's covered there:

- **Implicit Flow**: Designed for public clients like SPAs, but now deprecated due to security concerns.
- **Client Credentials Flow**: For machine-to-machine communication where no user is involved.
- **Resource Owner Password Credentials (ROPC)**: Only used in trusted environments. Avoid in most cases.
- **Device Authorization Flow**: Used for devices with limited input (like Smart TVs or game consoles).

Each of these flows serves a purpose—but unless you're building something very specific, Authorization Code with PKCE is the recommended default.
