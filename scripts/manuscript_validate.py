#!/usr/bin/env python3
"""Validate TC-DRMS volunteer manuscript intake data.

This validator covers the blocking semantic rules that JSON Schema alone cannot
express. It uses only the Python standard library so it can run offline.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from typing import Any

MODES = {
    "breaking-news",
    "disaster-relief",
    "community-record",
    "medical-outreach",
    "person-profile",
    "ceremony-dharma",
    "photo-caption",
}
SOURCE_ENTITIES = {
    "Event",
    "Case",
    "Task",
    "Person",
    "Squad",
    "Vehicle",
    "Inventory",
    "Fund",
    "Feedback",
    "Interview",
    "ExternalOfficialSource",
}
NUMERIC_KINDS = {"person_count", "household_count", "item_quantity", "service_count"}
SENSITIVE_ENTITIES = {"Case", "Fund"}
MEDICAL_HINTS = ("病", "醫療", "診斷", "手術", "用藥", "病歷", "健康")
REQUIRED_TOP = {
    "report_id",
    "mode",
    "event",
    "actions",
    "verified_facts",
    "consent",
    "submitted_by",
    "submitted_at",
}


def parse_time(value: Any, path: str, errors: list[str], nullable: bool = False) -> None:
    if nullable and value is None:
        return
    if not isinstance(value, str) or not value:
        errors.append(f"{path}: must be a non-empty ISO-8601 datetime")
        return
    try:
        dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        errors.append(f"{path}: invalid ISO-8601 datetime: {value!r}")


def require_string(obj: dict[str, Any], key: str, path: str, errors: list[str]) -> str:
    value = obj.get(key)
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{path}.{key}: required non-empty string")
        return ""
    return value.strip()


def validate_fact(fact: Any, index: int, errors: list[str], warnings: list[str]) -> None:
    path = f"verified_facts[{index}]"
    if not isinstance(fact, dict):
        errors.append(f"{path}: must be an object")
        return

    for key in (
        "fact_id",
        "kind",
        "value",
        "source_entity",
        "source_id",
        "verified_by",
        "verified_at",
        "privacy_level",
        "publishable",
    ):
        if key not in fact:
            errors.append(f"{path}.{key}: required")

    require_string(fact, "fact_id", path, errors)
    kind = require_string(fact, "kind", path, errors)
    entity = require_string(fact, "source_entity", path, errors)
    require_string(fact, "source_id", path, errors)
    require_string(fact, "verified_by", path, errors)
    parse_time(fact.get("verified_at"), f"{path}.verified_at", errors)

    if entity and entity not in SOURCE_ENTITIES:
        errors.append(f"{path}.source_entity: unsupported source {entity!r}")

    privacy = fact.get("privacy_level")
    publishable = fact.get("publishable")
    if privacy not in {"public", "internal", "sensitive"}:
        errors.append(f"{path}.privacy_level: invalid value {privacy!r}")
    if not isinstance(publishable, bool):
        errors.append(f"{path}.publishable: must be boolean")
    if publishable is True and privacy != "public":
        errors.append(f"{path}: internal or sensitive fact cannot be publishable")

    value = fact.get("value")
    if value is None or isinstance(value, (list, dict)):
        errors.append(f"{path}.value: must be scalar")

    if kind in NUMERIC_KINDS:
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            errors.append(f"{path}.value: numeric kind requires number")
        if not isinstance(fact.get("unit"), str) or not fact.get("unit", "").strip():
            errors.append(f"{path}.unit: numeric fact requires unit")
        if not isinstance(fact.get("time_window"), str) or not fact.get("time_window", "").strip():
            errors.append(f"{path}.time_window: numeric fact requires time window")

    if entity in SENSITIVE_ENTITIES and publishable is True:
        warnings.append(f"{path}: {entity} fact is public; privacy reviewer must confirm minimum disclosure")

    text = str(value)
    if any(hint in text for hint in MEDICAL_HINTS) and publishable is True:
        warnings.append(f"{path}: possible medical content requires privacy and qualified review")


def validate_people(data: dict[str, Any], errors: list[str]) -> set[str]:
    refs: set[str] = set()
    for index, person in enumerate(data.get("people", [])):
        path = f"people[{index}]"
        if not isinstance(person, dict):
            errors.append(f"{path}: must be an object")
            continue
        ref = require_string(person, "person_ref", path, errors)
        name = require_string(person, "display_name", path, errors)
        require_string(person, "role", path, errors)
        if ref in refs:
            errors.append(f"{path}.person_ref: duplicate {ref!r}")
        refs.add(ref)
        if not isinstance(person.get("name_consent"), bool):
            errors.append(f"{path}.name_consent: must be boolean")
        if person.get("name_consent") is not True and name and not re.fullmatch(r"[A-Z甲乙丙丁戊己庚辛壬癸]先生|[A-Z甲乙丙丁戊己庚辛壬癸]女士|受訪者[A-Z0-9]+|匿名", name):
            errors.append(f"{path}.display_name: real-looking name used without name consent")
        if person.get("privacy_level") not in {"public", "internal", "sensitive"}:
            errors.append(f"{path}.privacy_level: invalid")
    return refs


def validate_quotes(data: dict[str, Any], people_refs: set[str], errors: list[str]) -> None:
    for index, quote in enumerate(data.get("quotations", [])):
        path = f"quotations[{index}]"
        if not isinstance(quote, dict):
            errors.append(f"{path}: must be an object")
            continue
        speaker = require_string(quote, "speaker_person_ref", path, errors)
        require_string(quote, "exact_text", path, errors)
        require_string(quote, "source_reference", path, errors)
        if speaker not in people_refs:
            errors.append(f"{path}.speaker_person_ref: missing matching person record")
        if quote.get("source_type") not in {"audio", "video", "transcript", "field_notes"}:
            errors.append(f"{path}.source_type: invalid")
        if quote.get("transcript_verified") is not True:
            errors.append(f"{path}.transcript_verified: direct quote must be verified")
        if quote.get("publication_consent") is not True:
            errors.append(f"{path}.publication_consent: direct quote requires consent")


def validate_media(data: dict[str, Any], people_refs: set[str], errors: list[str]) -> None:
    for index, media in enumerate(data.get("media", [])):
        path = f"media[{index}]"
        if not isinstance(media, dict):
            errors.append(f"{path}: must be an object")
            continue
        require_string(media, "media_id", path, errors)
        require_string(media, "objective_caption", path, errors)
        require_string(media, "credit", path, errors)
        if media.get("publication_consent") is not True:
            errors.append(f"{path}.publication_consent: media cannot be published")
        for ref in media.get("depicted_person_refs", []):
            if ref not in people_refs:
                errors.append(f"{path}.depicted_person_refs: unknown person {ref!r}")


def validate_report(data: Any) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(data, dict):
        return ["root: must be an object"], warnings

    missing = sorted(REQUIRED_TOP - data.keys())
    for key in missing:
        errors.append(f"root.{key}: required")

    report_id = data.get("report_id")
    if not isinstance(report_id, str) or not re.fullmatch(r"MR-[A-Z0-9-]{6,40}", report_id):
        errors.append("root.report_id: must match MR-[A-Z0-9-]{6,40}")

    if data.get("mode") not in MODES:
        errors.append(f"root.mode: invalid value {data.get('mode')!r}")

    event = data.get("event")
    if not isinstance(event, dict):
        errors.append("root.event: must be an object")
    else:
        for key in ("event_id", "name", "purpose"):
            require_string(event, key, "event", errors)
        parse_time(event.get("start_at"), "event.start_at", errors)
        parse_time(event.get("end_at"), "event.end_at", errors, nullable=True)
        location = event.get("location")
        if not isinstance(location, dict):
            errors.append("event.location: must be an object")
        else:
            require_string(location, "display_name", "event.location", errors)
            if location.get("privacy_level") != "public":
                errors.append("event.location: manuscript display location must be public-level")

    actions = data.get("actions")
    if not isinstance(actions, list) or not actions:
        errors.append("root.actions: at least one verified action is required")
    else:
        for index, action in enumerate(actions):
            path = f"actions[{index}]"
            if not isinstance(action, dict):
                errors.append(f"{path}: must be an object")
                continue
            for key in ("task_id", "actor", "action", "verified_by"):
                require_string(action, key, path, errors)
            if action.get("status") not in {"completed", "verified"}:
                errors.append(f"{path}.status: must be completed or verified")

    facts = data.get("verified_facts")
    if not isinstance(facts, list) or not facts:
        errors.append("root.verified_facts: at least one fact is required")
    else:
        fact_ids: set[str] = set()
        for index, fact in enumerate(facts):
            validate_fact(fact, index, errors, warnings)
            if isinstance(fact, dict) and isinstance(fact.get("fact_id"), str):
                if fact["fact_id"] in fact_ids:
                    errors.append(f"verified_facts[{index}].fact_id: duplicate {fact['fact_id']!r}")
                fact_ids.add(fact["fact_id"])

    people_refs = validate_people(data, errors)
    validate_quotes(data, people_refs, errors)
    validate_media(data, people_refs, errors)

    consent = data.get("consent")
    if not isinstance(consent, dict):
        errors.append("root.consent: must be an object")
    else:
        require_string(consent, "checked_by", "consent", errors)
        parse_time(consent.get("checked_at"), "consent.checked_at", errors)
        for key in ("contains_case_data", "privacy_review_required"):
            if not isinstance(consent.get(key), bool):
                errors.append(f"consent.{key}: must be boolean")
        has_sensitive = any(
            isinstance(fact, dict)
            and (fact.get("source_entity") in SENSITIVE_ENTITIES or fact.get("privacy_level") == "sensitive")
            for fact in data.get("verified_facts", [])
        )
        if has_sensitive and consent.get("privacy_review_required") is not True:
            errors.append("consent.privacy_review_required: must be true for Case/Fund/sensitive data")

    require_string(data, "submitted_by", "root", errors)
    parse_time(data.get("submitted_at"), "root.submitted_at", errors)

    if not data.get("unresolved_questions"):
        warnings.append("root.unresolved_questions: empty; confirm there are genuinely no missing facts")

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("--json", action="store_true", dest="json_output")
    args = parser.parse_args()

    try:
        data = json.loads(args.report.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read report: {exc}", file=sys.stderr)
        return 2

    errors, warnings = validate_report(data)
    result = {
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "status": "ready_for_draft" if not errors else "collecting",
    }
    if args.json_output:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        for message in errors:
            print(f"ERROR {message}")
        for message in warnings:
            print(f"WARN  {message}")
        print(f"RESULT {result['status']} errors={len(errors)} warnings={len(warnings)}")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
