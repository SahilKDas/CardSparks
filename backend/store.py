"""SQLite persistence for profiles, briefings, planned actions, and outcomes."""

from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SidekickStore:
    def __init__(self, path: Path):
        self.path = path

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def init(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS profiles (
                    name TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS briefings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    profile_name TEXT NOT NULL,
                    generated_at TEXT NOT NULL,
                    advisor_mode TEXT NOT NULL,
                    recommendations TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS actions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    profile_name TEXT NOT NULL,
                    recommendation_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    action_text TEXT NOT NULL,
                    why_text TEXT NOT NULL,
                    signals TEXT NOT NULL,
                    evidence TEXT NOT NULL,
                    confidence TEXT NOT NULL,
                    success_metric TEXT NOT NULL,
                    scheduled_for TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'planned',
                    is_demo INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS outcomes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action_id INTEGER NOT NULL UNIQUE,
                    observed_sales REAL NOT NULL,
                    baseline_sales REAL NOT NULL,
                    lift_amount REAL NOT NULL,
                    lift_percent REAL NOT NULL,
                    helped TEXT NOT NULL,
                    note TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(action_id) REFERENCES actions(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_actions_profile ON actions(profile_name, id DESC);
                CREATE INDEX IF NOT EXISTS idx_briefings_profile ON briefings(profile_name, id DESC);
                """
            )

    def save_profile(self, profile: dict[str, Any], generated_at: str | None = None) -> None:
        timestamp = generated_at or now_iso()
        with self.connect() as connection:
            connection.execute(
                "INSERT OR REPLACE INTO profiles(name, payload, updated_at) VALUES (?, ?, ?)",
                (profile["name"], json.dumps(profile), timestamp),
            )

    def save_briefing(self, profile_name: str, advisor_mode: str, recommendations: list[dict[str, Any]], generated_at: str) -> None:
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO briefings(profile_name, generated_at, advisor_mode, recommendations) VALUES (?, ?, ?, ?)",
                (profile_name, generated_at, advisor_mode, json.dumps(recommendations)),
            )

    def history(self, profile_name: str) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT generated_at, advisor_mode, recommendations FROM briefings WHERE profile_name = ? ORDER BY id DESC LIMIT 20",
                (profile_name,),
            ).fetchall()
        return [{"generated_at": row["generated_at"], "advisor_mode": row["advisor_mode"], "recommendations": json.loads(row["recommendations"])} for row in rows]

    def create_action(self, payload: dict[str, Any]) -> dict[str, Any]:
        profile_name = str(payload.get("profile_name", "")).strip()[:120]
        recommendation = payload.get("recommendation") or {}
        if not profile_name or not recommendation.get("title") or not recommendation.get("action"):
            raise ValueError("Business and recommendation details are required.")
        scheduled_for = str(payload.get("scheduled_for") or date.today().isoformat())[:10]
        try:
            date.fromisoformat(scheduled_for)
        except ValueError as exc:
            raise ValueError("scheduled_for must use YYYY-MM-DD.") from exc
        timestamp = now_iso()
        with self.connect() as connection:
            existing = connection.execute(
                "SELECT id FROM actions WHERE profile_name = ? AND recommendation_id = ? AND status = 'planned'",
                (profile_name, str(recommendation.get("id", "recommendation"))),
            ).fetchone()
            if existing:
                return self.get_action(existing["id"], connection)
            cursor = connection.execute(
                """INSERT INTO actions(
                    profile_name, recommendation_id, title, action_text, why_text,
                    signals, evidence, confidence, success_metric, scheduled_for,
                    status, is_demo, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?, ?)""",
                (
                    profile_name, str(recommendation.get("id", "recommendation"))[:120],
                    str(recommendation["title"])[:240], str(recommendation["action"])[:1200],
                    str(recommendation.get("why", ""))[:600], json.dumps(recommendation.get("signals", [])),
                    json.dumps(recommendation.get("evidence", [])), str(recommendation.get("confidence", "medium"))[:20],
                    str(recommendation.get("success_metric", "Track daily sales"))[:300], scheduled_for,
                    1 if payload.get("is_demo") else 0, timestamp, timestamp,
                ),
            )
            return self.get_action(cursor.lastrowid, connection)

    def get_action(self, action_id: int, connection: sqlite3.Connection | None = None) -> dict[str, Any]:
        owns_connection = connection is None
        connection = connection or self.connect()
        try:
            row = connection.execute(
                """SELECT a.*, o.observed_sales, o.baseline_sales, o.lift_amount,
                          o.lift_percent, o.helped, o.note, o.created_at AS outcome_at
                   FROM actions a LEFT JOIN outcomes o ON o.action_id = a.id
                   WHERE a.id = ?""",
                (action_id,),
            ).fetchone()
            if not row:
                raise ValueError("Action not found.")
            return self._action_dict(row)
        finally:
            if owns_connection:
                connection.close()

    def list_actions(self, profile_name: str) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                """SELECT a.*, o.observed_sales, o.baseline_sales, o.lift_amount,
                          o.lift_percent, o.helped, o.note, o.created_at AS outcome_at
                   FROM actions a LEFT JOIN outcomes o ON o.action_id = a.id
                   WHERE a.profile_name = ? ORDER BY a.id DESC LIMIT 50""",
                (profile_name,),
            ).fetchall()
        return [self._action_dict(row) for row in rows]

    def update_action(self, action_id: int, status: str) -> dict[str, Any]:
        if status not in {"planned", "completed", "dismissed"}:
            raise ValueError("Status must be planned, completed, or dismissed.")
        with self.connect() as connection:
            cursor = connection.execute(
                "UPDATE actions SET status = ?, updated_at = ? WHERE id = ?",
                (status, now_iso(), action_id),
            )
            if not cursor.rowcount:
                raise ValueError("Action not found.")
            return self.get_action(action_id, connection)

    def record_outcome(self, action_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            observed = round(float(payload.get("observed_sales")), 2)
        except (TypeError, ValueError) as exc:
            raise ValueError("Observed sales must be a number.") from exc
        if observed < 0 or observed > 10_000_000:
            raise ValueError("Observed sales is outside the supported range.")
        helped = str(payload.get("helped", "unsure")).lower()
        if helped not in {"yes", "no", "unsure"}:
            raise ValueError("helped must be yes, no, or unsure.")
        with self.connect() as connection:
            action = connection.execute("SELECT * FROM actions WHERE id = ?", (action_id,)).fetchone()
            if not action:
                raise ValueError("Action not found.")
            baseline = self._baseline_for(connection, action["profile_name"], action["scheduled_for"])
            lift = round(observed - baseline, 2)
            lift_percent = round((lift / baseline * 100) if baseline else 0, 1)
            timestamp = now_iso()
            connection.execute(
                """INSERT OR REPLACE INTO outcomes(
                    action_id, observed_sales, baseline_sales, lift_amount,
                    lift_percent, helped, note, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (action_id, observed, baseline, lift, lift_percent, helped, str(payload.get("note", ""))[:600], timestamp),
            )
            connection.execute("UPDATE actions SET status = 'completed', updated_at = ? WHERE id = ?", (timestamp, action_id))
            return self.get_action(action_id, connection)

    def recent_outcomes(self, profile_name: str, limit: int = 5) -> list[dict[str, Any]]:
        return [action for action in self.list_actions(profile_name) if action.get("outcome")][:limit]

    def reset_business(self, profile_name: str) -> None:
        with self.connect() as connection:
            connection.execute("DELETE FROM actions WHERE profile_name = ?", (profile_name,))
            connection.execute("DELETE FROM briefings WHERE profile_name = ?", (profile_name,))
            connection.execute("DELETE FROM profiles WHERE name = ?", (profile_name,))

    def baseline_for(self, profile_name: str, scheduled_for: str) -> float:
        with self.connect() as connection:
            return self._baseline_for(connection, profile_name, scheduled_for)

    def _baseline_for(self, connection: sqlite3.Connection, profile_name: str, scheduled_for: str) -> float:
        row = connection.execute("SELECT payload FROM profiles WHERE name = ?", (profile_name,)).fetchone()
        if not row:
            return 0.0
        sales = json.loads(row["payload"]).get("sales", [])
        weekday = date.fromisoformat(scheduled_for).weekday()
        comparable = [float(item["amount"]) for item in sales if date.fromisoformat(item["date"]).weekday() == weekday]
        values = comparable or [float(item["amount"]) for item in sales]
        return round(mean(values), 2) if values else 0.0

    @staticmethod
    def _action_dict(row: sqlite3.Row) -> dict[str, Any]:
        outcome = None
        if row["observed_sales"] is not None:
            outcome = {
                "observed_sales": row["observed_sales"], "baseline_sales": row["baseline_sales"],
                "lift_amount": row["lift_amount"], "lift_percent": row["lift_percent"],
                "helped": row["helped"], "note": row["note"], "created_at": row["outcome_at"],
            }
        return {
            "id": row["id"], "profile_name": row["profile_name"], "recommendation_id": row["recommendation_id"],
            "title": row["title"], "action": row["action_text"], "why": row["why_text"],
            "signals": json.loads(row["signals"]), "evidence": json.loads(row["evidence"]),
            "confidence": row["confidence"], "success_metric": row["success_metric"],
            "scheduled_for": row["scheduled_for"], "status": row["status"], "is_demo": bool(row["is_demo"]),
            "created_at": row["created_at"], "updated_at": row["updated_at"], "outcome": outcome,
        }
