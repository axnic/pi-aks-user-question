# === Output ===
Output docs/assets/demo.gif
Output docs/assets/demo.webm

# === Runtime dependencies ===
Require node

# === Window configuration ===
Set WindowBar Colorful
Set Width 1200
Set Height 500
Set FontSize 14
Set Padding 10

Set Shell zsh

# === Demo script ===

# 1. Start pi in sandbox mode via the dedicated mise VHS task
Type "mise run vhs:pi"
Enter

Sleep 1.5s  # brief beat while pi's REPL becomes ready

# 2. User prompt — triggers the ask_user_question tool with a multi-question server config form
Type "Help me configure a new server"
Enter

# --- Question 1: Server name (text input) ---
Wait+Screen@500ms /What should the server be named?/
Sleep 900ms  # ~900ms to read the question before typing
Type "my-server-01"
Sleep 600ms  # short answer, quick review before Enter
Enter

# --- Question 2: Admin email (text input with email format validation) ---
# Type an invalid email address to demonstrate inline validation feedback
Wait+Screen@500ms /What is the administrator email?/
Sleep 1000ms  # longer question; user deliberately crafts an invalid value
Type "admin-unknown.com"
Sleep 400ms   # pause before submitting, even an intentionally wrong value
Enter
Sleep 1200ms  # error appears immediately; 1.2s is enough to read it
# Advance past the invalid field with Tab (validation warning stays visible)
Tab

# --- Question 3: Whitelist IP (text input with IP validation) ---
# Start with an incomplete address to trigger the error, then fix it
Wait+Screen@500ms /Which IP address should be whitelisted?/
Sleep 900ms  # read the question before starting
Type "192.168"
Sleep 750ms
Type ".1.1"
Sleep 600ms  # review the complete IP before pressing Enter
Enter
Sleep 1200ms  # give the form time to react, then reconsider
Backspace 11
Type "0.0.0.0"
Sleep 600ms   # short address, confident review
Enter

# --- Question 4: Port (number input with min/max range slider) ---
# Non-numeric characters are rejected immediately by the input widget;
# then use ↑/↓ arrows to step the value, and type a custom digit
Wait+Screen@500ms /Which port should the server listen on?/
Sleep 800ms  # read the question and scan the range slider
Type "abc"
Up@50ms 21
Sleep 400ms  # slight hesitation after overshooting the target
Down 1
Sleep 800ms  # look at the value and slider before deciding to edit
Left 4
Type "1"
Sleep 600ms  # short value, quick review
Enter

# --- Question 5: TLS enabled (boolean yes/no toggle) ---
# Toggle between Yes and No to demonstrate the boolean widget
Wait+Screen@500ms /Should TLS be enabled?/
Sleep 900ms  # read the yes/no question before toggling
Up@500ms
Down@500ms
Up@500ms
Sleep 600ms  # landed on "Yes", brief confirmation beat
Enter

# --- Question 6: Environment (choice — single-select) ---
# Navigate options with ↓/↑, select with Space, confirm with Enter
Wait+Screen@500ms /Which environment is this server for?/
Sleep 900ms  # read the options list before navigating
Down@200ms 2
Up@200ms
Space@500ms
Up@200ms
Space@500ms
Sleep 500ms  # just deselected, confident about the final choice
Enter

# --- Question 7: Optional features (multichoice — multi-select) ---
# Toggle several options and use the built-in "Other…" row to add a custom free-text value
Wait+Screen@500ms /Which optional features should be enabled?/
Sleep 1100ms  # most options to scan; the longest question in the form
Space@500ms
Down@200ms 2
Space@500ms
Down@200ms 3
Space@500ms
Type "Logs"
Sleep 700ms   # re-read the free-text "Other" value before Enter
Enter

# --- Question 8: API base URL (text input with URL format validation) ---
Wait+Screen@500ms /What is the upstream API base URL?/
Sleep 900ms  # read the question and recall the URL to type
Type "https://api.unknown.dev"
Sleep 600ms  # URL already composed mentally, quick check
Enter

# === Review screen ===
# The review tab shows a summary of all answers with a warning for the invalid email.
# Navigate backwards through every tab with Shift+Tab to reach it.
Wait+Screen@500ms /Review your answers:/
Sleep 3200ms  # 8 answers to scan unhurried
Shift+Tab
Sleep 150ms
Shift+Tab
Sleep 150ms
Shift+Tab
Sleep 150ms
Shift+Tab
Sleep 150ms
Shift+Tab
Sleep 150ms
Shift+Tab
Sleep 150ms
Shift+Tab
Sleep 150ms

# --- Fix email (question 2 revisited) ---
# Move the cursor left of the domain, insert '@', then correct the TLD at the end
Wait+Screen@500ms /What is the administrator email?/
Sleep 1100ms  # locate the bad email and plan the cursor moves
Left 11
Backspace
Type "@"
Right 11
Backspace 3
Type "dev"
Sleep 800ms  # re-read the corrected email before tabbing away
# Tab forward through the remaining questions back to the review screen
Tab@150ms 7

# === Final review — all answers valid, ready to submit ===
Wait+Screen@500ms /Review your answers:/
Sleep 3500ms  # all answers valid; final look before submitting
