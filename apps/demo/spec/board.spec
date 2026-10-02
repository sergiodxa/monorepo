# The board end to end: a visitor publishes a position through the dialog, reads it
# back, and the poster is mailed.

use browser
use cli
use db
use http
use html

# Empties the board and starts a dev server of its own, which the run stops once it ends.
setup {
	db.query "delete from postings" on "local"
	let server = cli.start "bun" "run" "dev" in "."
	eventually within 30s {
		expect cli.output server contains "localhost:3008"
	}
}

# Fills the "post a job" dialog and submits it, waiting for the board to list the position.
command publish(position) {
	browser.click button "Post a job" first
	browser.fill textbox "Job title" with position.title
	browser.fill textbox "Company" with position.company
	browser.fill textbox "Location" with position.location
	browser.fill textbox "Salary range" with position.salary
	browser.fill textbox "Contact email" with position.email
	browser.fill textbox "Description (Markdown)" with position.description
	browser.fill textbox "Type remix to prove you are human" with "remix"
	browser.click button "Publish"
	eventually within 5s {
		expect browser.link "View position"
	}
}

test "a published position is listed, opens in full, and mails its contact" {
	given {
		browser.open "/"
		expect browser.heading "No open positions"
	}
	when {
		publish {
			title: "Senior Remix Engineer"
			company: "Acme"
			location: "Remote"
			salary: "$150k – $180k"
			email: "hiring@acme.test"
			description: "We build **things** with Remix v3."
		}
		browser.click link "View position"
		let outbox = http.get "/outbox"
	}
	then {
		expect not browser.element dialog "Post a position"
		expect browser.element dialog "Senior Remix Engineer"
		eventually within 5s {
			expect browser.text "We build things with Remix v3."
		}
		expect browser.link "Apply by email" attribute "href" "mailto:hiring@acme.test"
		expect html.text outbox.text "Senior Remix Engineer is live on the Remix Job Board"
	}
}
