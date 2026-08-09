# The admin area, proven end to end against the live server. Where admin.spec asserts
# only the anonymous guard, these tests sign in as an admin and assert the content
# and a real create action behind it. The admin subject is the fixed
# `spec-admin@spec.test` account, registered by `login` and then promoted with one
# SQL flip (`seed_admin`) because in-app registration only ever grants `user`;
# `requireSubject` re-reads the row per request, so the flip takes effect on the next
# navigation within the same signed-in session.

# GET /admin — the dashboard renders for an admin.
test "GET /admin loads the dashboard for an admin subject" {
	given {
		login "spec-admin@spec.test" "correct horse battery"
		seed_admin
	}
	when {
		browser.navigate "http://localhost:3002/admin"
	}
	then {
		eventually {
			expect browser.heading "Dashboard"
			expect browser.text "Total Users"
		}
	}
}

# GET /admin/subjects — the user list renders and includes the seeded admin account.
test "GET /admin/subjects lists subjects including the seeded admin" {
	given {
		login "spec-admin@spec.test" "correct horse battery"
		seed_admin
	}
	when {
		browser.navigate "http://localhost:3002/admin/subjects"
	}
	then {
		eventually {
			expect browser.heading "Users"
			expect browser.text "spec-admin@spec.test"
		}
	}
}

# POST /admin/clients/new — creating a client through the form succeeds and the
# success page names the new client. The redirect URI is deleted first (cascading to
# any grants and sessions) so the unique constraint never rejects a re-run; the URI
# is on this origin but need not be a real route, since it is only stored and
# exact-matched at authorize time.
test "POST /admin/clients/new creates a client through the form" {
	given {
		login "spec-admin@spec.test" "correct horse battery"
		seed_admin
		db.query "DELETE FROM clients WHERE redirect_uri = 'http://localhost:3002/spec-created-client'"
	}
	when {
		browser.navigate "http://localhost:3002/admin/clients/new"
		browser.fill textbox "Name" with "Spec Created Client"
		browser.fill textbox "Redirect URI" with "http://localhost:3002/spec-created-client"
		browser.fill textbox "Logout URI" with "http://localhost:3002/spec-created-client"
		browser.click button "Save"
	}
	then {
		eventually {
			expect browser.text "Client created successfully"
			expect browser.text "Spec Created Client"
		}
	}
}
