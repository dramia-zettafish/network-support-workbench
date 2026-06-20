from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


DEFAULT_OUTPUT_DIR = Path("/tmp/eusupport-logistics-test-workbooks")
DEFAULT_PREFIX = "logistics-log-test-workbook"
DEFAULT_CUSTOMER = "QA Logistics Test Customer"
OWNER_COMP = "Test Computer Technician"
OWNER_NET = "Test Network Technician"
SHEET_TITLE = "Production Ops Export"
HEADER_WORK_ORDER = "Work Order Number"
HEADER_CASE = "Case"
HEADER_CUSTOMER = "Customer (Case) (Case)"
HEADER_CUSTOMER_ASSET = "Customer Asset (Case) (Case)"
HEADER_LOCATION = "Location (Case) (Case)"
HEADER_STATUS_REASON = "Status Reason (Case) (Case)"
HEADER_SUB_STATUS = "Sub-Status"
HEADER_OWNER = "Owner (Case) (Case)"
HEADER_WORK_ORDER_SUMMARY = "Work Order Summary"
HEADER_PRIMARY_INCIDENT_DESCRIPTION = "Primary Incident Description"
HEADER_PICKUP_SCHEDULED_ATTEMPTS = "Pickup Scheduled Attempts"


def _rows() -> list[dict[str, str | int]]:
    return [
        {
            "work_order": "WO-LOGTEST-COMP-001",
            "case": "C-LOGTEST-COMP-001",
            "customer": DEFAULT_CUSTOMER,
            "asset": "QA-ASSET-COMP-001",
            "location": "QA Test Location A",
            "status_reason": "Ready For Pickup",
            "sub_status": "",
            "owner": OWNER_COMP,
            "pickup_scheduled_attempts": 1,
        },
        {
            "work_order": "WO-LOGTEST-COMP-002",
            "case": "C-LOGTEST-COMP-002",
            "customer": DEFAULT_CUSTOMER,
            "asset": "QA-ASSET-COMP-002",
            "location": "QA Test Location B",
            "status_reason": "Ready For Delivery",
            "sub_status": "",
            "owner": OWNER_COMP,
            "pickup_scheduled_attempts": "",
        },
        {
            "work_order": "WO-LOGTEST-COMP-003",
            "case": "C-LOGTEST-COMP-003",
            "customer": DEFAULT_CUSTOMER,
            "asset": "QA-ASSET-COMP-003",
            "location": "QA Test Location C",
            "status_reason": "Ready For Pickup",
            "sub_status": "",
            "owner": OWNER_COMP,
            "pickup_scheduled_attempts": 2,
        },
        {
            "work_order": "WO-LOGTEST-NET-001",
            "case": "C-LOGTEST-NET-001",
            "customer": DEFAULT_CUSTOMER,
            "asset": "QA-ASSET-NET-001",
            "location": "QA Test Location D",
            "status_reason": "Ready For Pickup",
            "sub_status": "",
            "owner": OWNER_NET,
            "pickup_scheduled_attempts": 1,
        },
        {
            "work_order": "WO-LOGTEST-NET-002",
            "case": "C-LOGTEST-NET-002",
            "customer": DEFAULT_CUSTOMER,
            "asset": "QA-ASSET-NET-002",
            "location": "QA Test Location E",
            "status_reason": "Ready For Delivery",
            "sub_status": "",
            "owner": OWNER_NET,
            "pickup_scheduled_attempts": "",
        },
        {
            "work_order": "WO-LOGTEST-NET-003",
            "case": "C-LOGTEST-NET-003",
            "customer": DEFAULT_CUSTOMER,
            "asset": "QA-ASSET-NET-003",
            "location": "QA Test Location F",
            "status_reason": "Ready For Pickup",
            "sub_status": "",
            "owner": OWNER_NET,
            "pickup_scheduled_attempts": 2,
        },
    ]


def _col_letter(col_idx: int) -> str:
    out = []
    n = int(col_idx)
    while n > 0:
        n, rem = divmod(n - 1, 26)
        out.append(chr(65 + rem))
    return "".join(reversed(out))


def _inline_string_cell(ref: str, value: str) -> str:
    return (
        f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">{escape(value)}</t></is></c>'
    )


def _numeric_cell(ref: str, value: int | float) -> str:
    return f'<c r="{ref}"><v>{value}</v></c>'


def _sheet_xml(rows: dict[int, dict[int, str | int]]) -> str:
    xml_rows: list[str] = []
    for row_idx in sorted(rows.keys()):
        cells_xml: list[str] = []
        for col_idx in sorted(rows[row_idx].keys()):
            ref = f"{_col_letter(col_idx)}{row_idx}"
            value = rows[row_idx][col_idx]
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                cells_xml.append(_numeric_cell(ref, value))
            else:
                cells_xml.append(_inline_string_cell(ref, str(value)))
        xml_rows.append(f'<row r="{row_idx}">{"".join(cells_xml)}</row>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetData>'
        + "".join(xml_rows)
        + '</sheetData>'
        '</worksheet>'
    )


def _content_types_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"""


def _root_rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"""


def _workbook_xml() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="{escape(SHEET_TITLE)}" sheetId="1" r:id="rId1"/>
    <sheet name="Read Me" sheetId="2" r:id="rId2"/>
    <sheet name="Do Not Touch" sheetId="3" state="hidden" r:id="rId3"/>
  </sheets>
</workbook>
"""


def _workbook_rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"""


def _styles_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1">
    <font>
      <sz val="11"/>
      <color theme="1"/>
      <name val="Calibri"/>
      <family val="2"/>
      <scheme val="minor"/>
    </font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>
"""


def _core_xml() -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:dcmitype="http://purl.org/dc/dcmitype/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>
"""


def _app_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
            xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Excel</Application>
</Properties>
"""


def _primary_sheet_rows() -> dict[int, dict[int, str | int]]:
    rows: dict[int, dict[int, str | int]] = {
        1: {1: "DEV/TEST ONLY - QA Logistics test workbook"},
        2: {1: "Upload through Route Coordination to create a fresh Logistics test cycle."},
        3: {
            2: HEADER_WORK_ORDER,
            3: HEADER_CASE,
            4: HEADER_CUSTOMER,
            5: HEADER_CUSTOMER_ASSET,
            7: HEADER_LOCATION,
            8: HEADER_STATUS_REASON,
            9: HEADER_SUB_STATUS,
            10: HEADER_OWNER,
            11: HEADER_WORK_ORDER_SUMMARY,
            12: HEADER_PRIMARY_INCIDENT_DESCRIPTION,
            13: HEADER_PICKUP_SCHEDULED_ATTEMPTS,
        },
    }
    for row_idx, row in enumerate(_rows(), start=4):
        rows[row_idx] = {
            2: str(row["work_order"]),
            3: str(row["case"]),
            4: str(row["customer"]),
            5: str(row["asset"]),
            7: str(row["location"]),
            8: str(row["status_reason"]),
            9: str(row["sub_status"]),
            10: str(row["owner"]),
            11: "",
            12: "",
        }
        attempts = row["pickup_scheduled_attempts"]
        if attempts != "":
            rows[row_idx][13] = int(attempts)
    return rows


def _readme_sheet_rows() -> dict[int, dict[int, str | int]]:
    return {
        1: {1: "DEV/TEST ONLY - Logistics Log workbook generator"},
        2: {1: "Uploading this workbook changes the active Logistics cycle."},
        3: {1: "Rows are clearly marked with WO-LOGTEST-* and C-LOGTEST-* identifiers."},
        4: {1: "Owners are set to the exact display names requested for test visibility."},
    }


def _hidden_sheet_rows() -> dict[int, dict[int, str | int]]:
    return {1: {1: "preserve me"}}


def _write_xlsx(output_path: Path) -> None:
    with ZipFile(output_path, "w", compression=ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", _content_types_xml())
        zf.writestr("_rels/.rels", _root_rels_xml())
        zf.writestr("docProps/core.xml", _core_xml())
        zf.writestr("docProps/app.xml", _app_xml())
        zf.writestr("xl/workbook.xml", _workbook_xml())
        zf.writestr("xl/_rels/workbook.xml.rels", _workbook_rels_xml())
        zf.writestr("xl/styles.xml", _styles_xml())
        zf.writestr("xl/worksheets/sheet1.xml", _sheet_xml(_primary_sheet_rows()))
        zf.writestr("xl/worksheets/sheet2.xml", _sheet_xml(_readme_sheet_rows()))
        zf.writestr("xl/worksheets/sheet3.xml", _sheet_xml(_hidden_sheet_rows()))


def _default_output_path(output_dir: Path) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return output_dir / f"{DEFAULT_PREFIX}-{stamp}.xlsx"


def _cleanup_generated_files(output_dir: Path) -> int:
    removed = 0
    for path in output_dir.glob(f"{DEFAULT_PREFIX}-*.xlsx"):
        path.unlink(missing_ok=True)
        removed += 1
    return removed


def _print_checklist(path: Path) -> None:
    print(f"Generated workbook: {path}")
    print()
    print("Short testing checklist:")
    print("1. Confirm the accounts with display names 'Test Computer Technician' and 'Test Network Technician' can access the Logistics tab.")
    print("2. Log in as a Route Coordinator and upload this workbook in Route Coordination > Upload Workbook.")
    print("3. Log in as Test Computer Technician and confirm only the C-LOGTEST-COMP-* rows are visible in Logistics.")
    print("4. Log in as Test Network Technician and confirm only the C-LOGTEST-NET-* rows are visible in Logistics.")
    print("5. Use normal Logistics actions to create log records naturally: Update, Escalate, and Notify RC.")
    print("6. Log in as a Supervisor or Manager and confirm the Logistics Log shows both users' records.")
    print()
    print("Cleanup note:")
    print("- The workbook file can be deleted locally after upload.")
    print("- Uploading a different Route Coordination workbook will replace the active Logistics cycle.")
    print("- Logistics Log records are append-only by design; the generated records are easy to identify later by WO-LOGTEST-* / C-LOGTEST-* / QA Logistics Test Customer.")
    print()
    print("Safety note:")
    print("- This tool only writes a local .xlsx file. No app data changes until someone uploads it through the normal UI.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate a dev/test Logistics workbook for exercising the Logistics and Logistics Log flows."
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Exact output path for the generated .xlsx file. Defaults to /tmp/eusupport-logistics-test-workbooks/<timestamp>.xlsx",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory used when --output is not provided.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow overwriting an existing --output file.",
    )
    parser.add_argument(
        "--cleanup-generated",
        action="store_true",
        help="Delete previously generated local workbook files matching the default prefix in the output directory, then exit.",
    )
    args = parser.parse_args(argv)

    output_dir = args.output_dir.expanduser().resolve()
    if args.cleanup_generated:
        output_dir.mkdir(parents=True, exist_ok=True)
        removed = _cleanup_generated_files(output_dir)
        print(f"Removed {removed} generated workbook file(s) from {output_dir}")
        return 0

    output_path = args.output.expanduser().resolve() if args.output else _default_output_path(output_dir)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists() and not args.overwrite:
        print(f"Refusing to overwrite existing file: {output_path}", file=sys.stderr)
        print("Re-run with --overwrite or choose a different --output path.", file=sys.stderr)
        return 2

    _write_xlsx(output_path)
    _print_checklist(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
