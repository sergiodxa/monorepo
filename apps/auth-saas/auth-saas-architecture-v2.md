# Auth SaaS: Architecture

This document describes the platform at an architectural level. It separates OAuth/OIDC roles from platform-level concepts and from the current Cloudflare implementation, so each term has one clear meaning.

It intentionally avoids code-level structure. The goal is to describe what each component is, what it owns, and how the pieces relate to each other.

## Terms, fixed

**Platform** is the complete SaaS product: the platform application, the Management API, the control plane, and the authorization servers operated for the platform and its customers.

**Customer** is a commercial and billing identity in the platform. A customer owns one or more tenants. A customer is not an OAuth identity and does not itself sign in.

**Tenant** is an independent identity domain operated by the platform for a customer. Each tenant has its own issuer, subjects, clients, sessions, credentials, grants, signing keys, and related identity state. A tenant is conceptually an independent OAuth 2.0 Authorization Server and OpenID Provider.

**Authorization Server** is the reusable OAuth 2.0 / OpenID Connect implementation that powers a tenant. In the current infrastructure, each tenant is backed by one Durable Object instance with its own SQLite database, but that is an implementation detail rather than the definition of a tenant.

**Platform Tenant** is the reserved tenant used by the platform itself. It runs the same Authorization Server implementation as customer tenants. Its subjects are the people who administer the platform and customer tenants. Its special behavior is limited to managed configuration and lifecycle, such as ensuring the scopes, first-party clients, roles, grants, and other settings required by the platform exist.

**Subject** is an identity that belongs to one specific tenant. Subject identity is scoped by issuer: the same identifier in two different tenants does not imply any relationship between those identities.

**Client** is an OAuth client of a tenant. When a client uses OpenID Connect to authenticate a subject, it is also an OIDC Relying Party.

**Platform App** is the platform's own application and dashboard. It is an OAuth client and OIDC Relying Party of the Platform Tenant. It authenticates administrators through the Platform Tenant and calls the Management API using access tokens.

**Management API** is the platform's OAuth Resource Server. It accepts access tokens issued by the Platform Tenant and exposes administrative operations over the platform and customer tenants.

**Control Plane** is the platform-level state and domain model behind the Management API. It contains customers, the tenant registry, tenant ownership, tenant memberships, billing state, routing information, and other global metadata. It is not an OAuth actor. In the current implementation, its authoritative relational state lives in D1, with KV used as a cache for routing lookups.

**Tenant Membership** is the platform-level relationship between a Subject of the Platform Tenant and a customer Tenant. It determines which tenants that subject may administer and at what role. It is distinct from any membership model that may exist inside a customer's own tenant.

**Organization** exists inside a customer tenant. It is that tenant's own grouping of its subjects, typically representing one of the customer's customers or teams. Organizations share the tenant's issuer, subject pool, and signing keys. A platform Customer and a tenant Organization are unrelated concepts at different architectural levels.

## The fundamental model

The platform operates a fleet of independent identity providers. Customers own tenants; tenants are independent authorization servers; platform administrators are subjects of the Platform Tenant; and administrative access to customer tenants is represented by Tenant Memberships in the Control Plane.

```text
                         PLATFORM

              +---------------------------+
              |         Customer          |
              |   commercial / billing    |
              +-------------+-------------+
                            |
                            | owns
                            v
              +---------------------------+
              |          Tenant           |
              | independent identity      |
              | domain                    |
              +-------------+-------------+
                            |
                            | powered by
                            v
              +---------------------------+
              |   Authorization Server    |
              | OAuth 2.0 + OpenID Connect|
              +---------------------------+
```

The current infrastructure deliberately makes the tenant boundary and the Durable Object boundary coincide:

```text
Tenant
  |
  +-- one issuer
  +-- one subject directory
  +-- one client registry
  +-- one session / grant domain
  +-- one set of signing keys
  |
  v
Authorization Server
  |
  v
Durable Object instance
  |
  v
SQLite database
```

The Durable Object is the current runtime and storage topology. The tenant remains the architectural identity boundary even if that implementation changes in the future.

## The platform uses the same OAuth architecture it provides to customers

The platform does not have a separate authentication model. It uses the same Authorization Server implementation that customers receive.

For the platform itself, the OAuth/OIDC roles are:

```text
Administrator
     |
     v
+-------------------+
|   Platform App    |
| OAuth Client / RP |
+---------+---------+
          |
          | authorization / authentication
          v
+-----------------------------+
|       Platform Tenant       |
| Authorization Server / OP   |
+-------------+---------------+
              |
              | issues access token
              v
+-------------------+
|   Platform App    |
+---------+---------+
          |
          | bearer access token
          v
+-----------------------------+
|       Management API        |
|   OAuth Resource Server     |
+-------------+---------------+
              |
              v
+-----------------------------+
|        Control Plane        |
| customers, tenants,         |
| memberships, billing,       |
| routing                     |
+-----------------------------+
```

A customer's product follows the same shape with a different tenant and a different resource server:

```text
End User
   |
   v
+-----------------------+
| Customer Application  |
| OAuth Client / RP     |
+-----------+-----------+
            |
            | authorization / authentication
            v
+-----------------------------+
|       Customer Tenant       |
| Authorization Server / OP   |
+-------------+---------------+
              |
              | issues access token
              v
+-----------------------+
| Customer Application  |
+-----------+-----------+
            |
            | bearer access token
            v
+-----------------------------+
|      Customer's API         |
|   OAuth Resource Server     |
+-----------------------------+
```

The Platform Tenant is therefore not a different kind of identity system. It is a reserved, platform-managed instance of the same identity system offered to customers.

## Authentication and authorization responsibilities

The Authorization Server and Resource Server both participate in authorization, but at different layers.

The Platform Tenant decides whether a client may receive a token for a subject, resource, and set of scopes. It owns authentication methods, credentials, sessions, consent, grants, client registration, token issuance, signing keys, and identity-related audit history.

The Management API decides whether a concrete platform operation is allowed. It validates the access token, then combines the token's identity and scopes with current Control Plane state such as Tenant Memberships, roles, tenant status, and other platform rules.

```text
                    Platform Tenant
                 Authorization Server
                         |
                         | authorizes token grant
                         | subject + client + audience + scopes
                         v
                    Access Token
                         |
                         v
                    Management API
                    Resource Server
                         |
                         | authorizes concrete operation
                         | using token + current Control Plane state
                         v
                    Control Plane
```

This keeps access tokens relatively stable and generic while leaving fine-grained, tenant-specific authorization in the Resource Server, where current membership state can be evaluated at request time.

## The Control Plane

The Control Plane is the global administrative domain of the SaaS. It knows that tenants exist and how the platform relates them to customers and administrators. It does not own the identity state inside those tenants.

```text
+------------------------------------------------------+
|                    CONTROL PLANE                     |
|                                                      |
|  Customers                                           |
|      |                                               |
|      +---- owns ----> Tenants                        |
|                                                      |
|  Platform Subjects                                   |
|      |                                               |
|      +---- Tenant Memberships ----> Tenants          |
|                                                      |
|  Billing                                             |
|  Tenant status                                       |
|  Hostname / routing registry                         |
|  Platform-level metadata                             |
+------------------------------------------------------+

              current storage

        +--------------------+
        |         D1         |
        | authoritative data |
        +---------+----------+
                  |
                  | routing cache
                  v
        +--------------------+
        |         KV         |
        +--------------------+
```

The Control Plane does not contain a customer tenant's subjects, relying parties, sessions, signing keys, organizations, or other authorization-server state.

## Tenant Memberships

A person who administers the platform is a Subject of the Platform Tenant. Being a Platform Tenant Subject does not itself grant access to any customer tenant.

Administrative access is represented separately in the Control Plane through Tenant Memberships.

```text
+-------------------------+
| Platform Tenant Subject |
+------------+------------+
             |
             | Tenant Membership
             | role: owner / admin / member / ...
             v
+-------------------------+
|    Customer Tenant      |
+-------------------------+
```

This separates identity from platform authorization. The Platform Tenant establishes who the caller is; the Tenant Membership establishes the caller's relationship to a tenant.

A single Platform Tenant Subject may have memberships in several tenants, potentially owned by different customers. A tenant may likewise have several administrators with different roles.

## Customer and Organization are different levels

A Customer exists outside and above tenants as part of the platform's commercial model. An Organization exists inside one tenant as part of that tenant's identity model.

```text
PLATFORM LEVEL

Customer
   |
   +---- owns ----> Tenant


TENANT LEVEL

Tenant
   |
   +---- contains ----> Organization
                           |
                           +---- groups ----> Subjects
```

A customer may own several tenants. Each of those tenants may independently contain organizations. Organizations never own tenants and are never billed by the platform directly.

## Management architecture

The Management API is the single protected administrative surface over customer tenants. It is not an identity issuer and is not itself a tenant.

```text
                         Platform App
                              |
                              | access token
                              v
                    +--------------------+
                    |   Management API   |
                    |  Resource Server   |
                    +---------+----------+
                              |
               +--------------+--------------+
               |                             |
               v                             v
       +---------------+            +-------------------+
       | Control Plane |            | Customer Tenant   |
       | D1 + KV       |            | Authorization     |
       +---------------+            | Server            |
                                    +-------------------+
```

The Management API uses Control Plane state to identify and authorize access to the tenant being managed, then performs administrative operations against that tenant's Authorization Server.

## Platform Tenant lifecycle

The Platform Tenant uses the same Authorization Server implementation as customer tenants, but its configuration is controlled by the platform itself.

Its managed lifecycle ensures the platform-required identity configuration remains present as the product evolves.

```text
Generic Authorization Server
            |
            | same protocol implementation
            v
      Platform Tenant
            |
            +-- platform-required scopes
            +-- first-party clients
            +-- required roles / grants
            +-- platform settings
            +-- managed configuration migrations
```

The specialization is about configuration and lifecycle, not a different OAuth/OIDC protocol implementation.

## Client SDK and dogfooding

The platform's client library exposes reusable client-side abstractions for consuming an Authorization Server and the Management API. The Platform App uses those same public abstractions rather than relying on a private authentication or management path.

```text
                         @sdxc/auth

             +-----------------------------+
             | Issuer / Relying Party      |
             |                             |
             | Management API client       |
             +-------------+---------------+
                           |
                    used by Platform App
                           |
             +-------------+---------------+
             |                             |
             v                             v
     Platform Tenant                Management API
   Authorization Server            Resource Server
```

This makes the Platform App a first-party consumer of the same integration surface available to other applications. Changes to the public Relying Party or Management API client are exercised continuously by the platform itself.

## Complete architecture

```text
                                      AUTH PLATFORM

                         +-----------------------------+
                         |        Platform App         |
                         | OAuth Client / OIDC RP      |
                         +-----------+-----------------+
                                     |
                    +----------------+----------------+
                    |                                 |
                    | OIDC                            | Management API client
                    v                                 v
       +-----------------------------+      +-----------------------------+
       |       Platform Tenant       |      |       Management API        |
       | Authorization Server / OP   |      |    OAuth Resource Server    |
       |                             |      +-------------+---------------+
       | Subjects = administrators   |                    |
       +-----------------------------+                    |
                                                        v
                                          +-----------------------------+
                                          |        Control Plane        |
                                          |                             |
                                          | Customers                   |
                                          | Tenant registry             |
                                          | Tenant Memberships          |
                                          | Billing                     |
                                          | Routing                     |
                                          |                             |
                                          | D1 + KV cache               |
                                          +-------------+---------------+
                                                        |
                                      administers       |
                              +-------------------------+-------------------------+
                              |                                                   |
                              v                                                   v
              +-------------------------------+                 +-------------------------------+
              | Customer Tenant: production   |                 | Customer Tenant: development  |
              | Authorization Server / OP     |                 | Authorization Server / OP     |
              |                               |                 |                               |
              | own issuer                    |                 | own issuer                    |
              | own signing keys              |                 | own signing keys              |
              | own subjects                  |                 | own subjects                  |
              | own clients                   |                 | own clients                   |
              | own sessions / grants         |                 | own sessions / grants         |
              | own organizations             |                 | own organizations             |
              +-------------------------------+                 +-------------------------------+
```

The architecture can therefore be summarized as follows:

The platform operates a fleet of independent Authorization Servers. Customers own Tenants. Each Tenant is an independent identity domain powered by the generic Authorization Server implementation. The Platform Tenant is a reserved instance used to authenticate platform administrators. The Platform App is its OAuth Client and OIDC Relying Party. The Management API is the platform's OAuth Resource Server. The Control Plane stores global platform relationships and state, including Tenant Memberships that determine which Platform Tenant Subjects may administer which customer Tenants. Customer applications use their own tenants in the same OAuth/OIDC architecture that the platform itself uses.
