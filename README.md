# Network Ticket Tracker v1

Local FastAPI/PostgreSQL/Caddy app for tracking network tickets.

## Run Locally

```powershell
docker compose up --build
```

Open the app at:

```text
http://localhost:8080
```

## Notes

- New tickets default to `Open`.
- Ticket # is stored as `external_ticket_number` and is limited to 8 characters.
- TEA code is limited to 3 digits.
- Ticket edits are limited to `note` and `status`.
