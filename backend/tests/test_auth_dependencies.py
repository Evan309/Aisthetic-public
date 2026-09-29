import unittest
from unittest.mock import patch

from fastapi import HTTPException

from auth.dependencies import ensure_auth0_configured, get_or_create_user
from db.models import User


class FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._result


class FakeSession:
    def __init__(self, *, by_auth0=None, by_email=None):
        self.by_auth0 = by_auth0 or {}
        self.by_email = by_email or {}
        self.added = []
        self.commits = 0
        self.refreshed = []

    def query(self, model):
        return self

    def filter(self, expr):
        expr_str = str(expr)
        if "auth0_id" in expr_str:
            value = expr.right.value
            return FakeQuery(self.by_auth0.get(value))
        if "email" in expr_str:
            value = expr.right.value
            return FakeQuery(self.by_email.get(value))
        raise AssertionError(f"Unexpected filter expression: {expr_str}")

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, User):
            self.by_auth0[obj.auth0_id] = obj
            if obj.email:
                self.by_email[obj.email] = obj

    def commit(self):
        self.commits += 1

    def refresh(self, obj):
        self.refreshed.append(obj)

    def rollback(self):
        pass


class AuthDependenciesTests(unittest.TestCase):
    def test_links_existing_user_by_verified_email_and_updates_auth0_id(self):
        existing = User(
            id=1,
            auth0_id="auth0|old-user",
            email="person@example.com",
            name="Old Name",
            profile_picture_url="https://old.example/avatar.png",
        )
        db = FakeSession(
            by_auth0={"auth0|old-user": existing},
            by_email={"person@example.com": existing},
        )
        payload = {
            "sub": "google-oauth2|new-user",
            "email": "person@example.com",
            "email_verified": True,
            "name": "New Name",
            "picture": "https://new.example/avatar.png",
        }

        with patch("auth.dependencies.run_with_db_retry", side_effect=lambda _db, fn, retries=1: fn()):
            user = get_or_create_user(db, payload, token="token")

        self.assertIs(user, existing)
        self.assertEqual(user.auth0_id, "google-oauth2|new-user")
        self.assertEqual(user.name, "New Name")
        self.assertEqual(user.profile_picture_url, "https://new.example/avatar.png")
        self.assertGreaterEqual(db.commits, 1)

    def test_missing_auth0_config_returns_service_unavailable(self):
        with patch("auth.dependencies.AUTH0_DOMAIN", ""), patch("auth.dependencies.AUTH0_AUDIENCE", ""):
            with self.assertRaises(HTTPException) as ctx:
                ensure_auth0_configured()

        self.assertEqual(ctx.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
