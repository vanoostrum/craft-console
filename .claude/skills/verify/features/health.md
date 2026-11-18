# Health (`/api/health`)

Answers `GET` with 200, `text/plain`, and `ok`. `$V launch` waits for it. To save its output: `curl -si http://127.0.0.1:$(cat .verify/$CONSOLE_VERIFY_RUN/port)/api/health`.
