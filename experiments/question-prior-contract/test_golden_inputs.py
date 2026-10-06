"""Reject stale completion goldens without rewriting the published fixtures."""
from contextlib import redirect_stdout
from copy import deepcopy
import io
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent


class CompletionGoldenInputsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix="pr118-golden-inputs-")
        directory = Path(cls.temporary.name).resolve()
        assert directory.parent == Path(tempfile.gettempdir()).resolve()
        for name in ("build-fixtures.py", "completion-goldens.json"):
            shutil.copyfile(ROOT / name, directory / name)
        with redirect_stdout(io.StringIO()):
            cls.builder = runpy.run_path(str(directory / "build-fixtures.py"))
        cls.fixtures = json.loads((ROOT / "common-fixtures.json").read_text(encoding="utf-8"))

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def setUp(self):
        self.fixture = deepcopy(next(case for case in self.fixtures["calculationExamples"]
                                     if case["id"] == "F06"))

    def reject(self, field):
        with self.assertRaisesRegex(ValueError, re.escape(f"golden key mismatch ({field})")):
            self.builder["evaluate"](self.fixture)

    def test_published_eighteen_examples_are_unchanged(self):
        for case in self.fixtures["calculationExamples"]:
            with self.subTest(case=case["id"]):
                self.assertEqual(self.builder["evaluate"](case), case["expected"])

    def test_changed_posterior_is_rejected(self):
        self.fixture["answers"]["a"] = "MID"
        self.reject("posterior")

    def test_changed_future_count_is_rejected(self):
        self.fixture["input"]["goal"]["totalRequired"] += 15
        self.reject("requiredFutureDone")

    def test_f06_skipped_start_with_same_posterior_and_count_is_rejected(self):
        self.fixture["input"]["goal"]["initialProgress"] = 75
        self.fixture["input"]["logs"] = [{"localDate": self.fixture["input"]["today"],
                                           "status": "SKIPPED", "amount": None}]
        self.reject("initialState")

    def test_changed_samples_are_rejected(self):
        self.fixture["config"]["samples"] += 1
        self.reject("samples")

    def test_changed_seed_is_rejected(self):
        self.fixture["config"]["seed"] += 1
        self.reject("seed")

    def test_changed_horizon_is_rejected(self):
        self.fixture["config"]["horizonDays"] -= 1
        self.reject("horizonDays")


if __name__ == "__main__":
    unittest.main()
