# Tokens in Simple Terms

An access token is a credential a client presents to an API. It says _who_ authorized the
request and **what** the client may do, without ever carrying the user's password.[^password]

> [!NOTE]
> Everything in this chapter applies whether the token is opaque or a JWT.

## The Parties {% #the-parties %}

| Party               | Holds                  | Trusts             |
| :------------------ | :--------------------- | -----------------: |
| Resource owner      | Their credentials      | The authorization server |
| Client              | Tokens it was issued   | Nobody             |
| Authorization server| Signing keys           | Its own records    |

Each party sees only what it needs. A client never sees the resource owner's password, and a
resource server never sees the client's secret.

## A Request, Step by Step {% #steps %}

1. The client redirects the browser to the authorization server.
2. The person signs in and approves the request.
3. The authorization server redirects back with a code.
4. The client exchanges the code for tokens.

```ts
let response = await fetch("https://auth.example.com/token", {
	method: "POST",
	body: new URLSearchParams({ grant_type: "authorization_code", code }),
});
let { access_token } = await response.json();
```

Before going further, check that you can answer each of these:

- [x] What a client is
- [x] Why the password stays with the authorization server
- [ ] What a refresh token is for

### Refresh Tokens {% #refresh-tokens %}

A refresh token lets the client ask for a new access token after the old one expires, so a
person signs in once a month instead of once an hour.[^lifetime] Treat it like a password:
store it encrypted, send it only to the token endpoint, and rotate it on every use.

![A sequence diagram of the four steps above](../images/flow.svg "The authorization code flow")

---

Next, we look at scopes, which narrow _what_ a token may do. Jump back to [the parties](#the-parties)
if the roles blur. Characters such as &copy;, &mdash; and &nbsp; arrive as text.

[^password]: That is the whole point of delegated authorization.
[^lifetime]: Lifetimes vary; thirty days is common for refresh tokens.
