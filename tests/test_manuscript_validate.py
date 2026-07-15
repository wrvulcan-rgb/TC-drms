from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "manuscript_validate", ROOT / "scripts" / "manuscript_validate.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ManuscriptValidatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.sample = json.loads(
            (ROOT / "manuscript" / "examples" / "volunteer-report.sample.json").read_text(
                encoding="utf-8"
            )
        )

    def validate(self, mutation):
        report = copy.deepcopy(self.sample)
        mutation(report)
        return MODULE.validate_report(report)

    def test_valid_sample_is_ready_for_draft(self) -> None:
        errors, _warnings = MODULE.validate_report(copy.deepcopy(self.sample))
        self.assertEqual([], errors)

    def test_rejects_unverified_direct_quote(self) -> None:
        errors, _ = self.validate(
            lambda report: report["quotations"][0].__setitem__("transcript_verified", False)
        )
        self.assertTrue(any("direct quote must be verified" in item for item in errors))

    def test_rejects_quote_without_publication_consent(self) -> None:
        errors, _ = self.validate(
            lambda report: report["quotations"][0].__setitem__("publication_consent", False)
        )
        self.assertTrue(any("direct quote requires consent" in item for item in errors))

    def test_rejects_real_name_without_name_consent(self) -> None:
        errors, _ = self.validate(
            lambda report: report["people"][0].__setitem__("display_name", "王小明")
        )
        self.assertTrue(any("real-looking name used without name consent" in item for item in errors))

    def test_rejects_sensitive_publishable_fact(self) -> None:
        def mutate(report):
            report["verified_facts"][0]["privacy_level"] = "sensitive"
            report["verified_facts"][0]["publishable"] = True
            report["consent"]["privacy_review_required"] = True

        errors, _ = self.validate(mutate)
        self.assertTrue(any("sensitive fact cannot be publishable" in item for item in errors))

    def test_rejects_numeric_fact_without_unit(self) -> None:
        errors, _ = self.validate(
            lambda report: report["verified_facts"][0].__setitem__("unit", None)
        )
        self.assertTrue(any("numeric fact requires unit" in item for item in errors))

    def test_rejects_numeric_fact_without_time_window(self) -> None:
        errors, _ = self.validate(
            lambda report: report["verified_facts"][0].__setitem__("time_window", None)
        )
        self.assertTrue(any("numeric fact requires time window" in item for item in errors))

    def test_requires_privacy_review_for_case_fact(self) -> None:
        def mutate(report):
            report["verified_facts"][0]["source_entity"] = "Case"
            report["consent"]["privacy_review_required"] = False

        errors, _ = self.validate(mutate)
        self.assertTrue(any("must be true for Case/Fund/sensitive data" in item for item in errors))


if __name__ == "__main__":
    unittest.main()
