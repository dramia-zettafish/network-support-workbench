# Network Vcode - V3 Snapshot

V3 is a working reference branch for the UPS workflow implementation before the next UI/UX redesign pass.

## Run Locally

```powershell
docker compose up --build
```

Open the app at:

```text
http://localhost:8080
```

## V3 Focus

- UPS ticket workflow pipeline
- NOC schedule table generation
- Warehouse table generation
- Outlook-friendly table clipboard support
- Explicit in-progress and completed workflow states

## UPS Workflow

1. Create a ticket with device type `UPS`.
2. Enter ticket-level `MDF/IDF`; UPS records inherit this into the IDF field.
3. Use the Pending UPS table to review:
   - Ticket #
   - School
   - TEA Code
   - MDF/IDF
   - Defective UPS Serial
   - Defective BP Serial
   - Hostname
   - Status
4. Select pending records and choose `Generate NOC Schedule`.
5. Edit proposed install dates as needed.
6. Choose `Move to In Progress`.
   - Records move to the In Progress table.
   - A NOC schedule table is copied to the clipboard for Outlook.
7. From In Progress, select records and choose `Generate Warehouse Email`.
8. Choose `Send Warehouse Email`.
   - A warehouse table is copied to the clipboard for Outlook.
9. Open Phase 3 fulfillment from an In Progress row and save:
   - Asset Tag #
   - UPS SN
   - SNMPWEBCARD SN
   - SNMP IP
   - BP SN
   - BP Asset Tag #
10. Select in-progress records and choose `Move to Completed` when ready.

## Database Notes

Current V3 migration head:

```text
012_add_ticket_mdf_idf
```

UPS statuses:

```text
intake
servicing
scheduled
fulfilled
```

The UI labels `scheduled` records as `In Progress`.

## Clipboard / Outlook Notes

The browser does not reliably open Outlook 2016 with a pre-filled HTML table. Instead, V3 copies tables using `text/html` plus a plain-text fallback. Paste the copied output into an Outlook 2016 message body.

## Existing App Areas

- Tickets default to `Open`.
- Ticket # is stored as `external_ticket_number` and is limited to 8 characters.
- TEA code is limited to 3 digits.
- Ticket edits are limited to `note` and `status`.
- RMA records can optionally link to an existing open ticket.
- RMA creation copies an email-ready prompt to the clipboard for the RMA admin.

## Known Next Step

The next planned iteration is UI/UX cleanup. This branch is intended as the reference point before that design pass.
