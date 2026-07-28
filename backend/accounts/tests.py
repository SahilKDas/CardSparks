from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase


User = get_user_model()


class AuthenticationTests(APITestCase):
    def test_signup_normalizes_email_and_returns_token(self):
        response = self.client.post("/api/auth/signup/", {
            "name": "Ada",
            "email": "  ADA@Example.COM ",
            "password": "correct-horse-battery-staple",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["token"])
        self.assertEqual(response.data["user"]["email"], "ada@example.com")
        self.assertTrue(User.objects.get(email="ada@example.com").check_password("correct-horse-battery-staple"))

    def test_login_ignores_a_stale_authorization_header(self):
        User.objects.create_user(name="Ada", email="ada@example.com", password="safe-password-123")
        self.client.credentials(HTTP_AUTHORIZATION="Token stale-token")

        response = self.client.post("/api/auth/login/", {
            "email": "ADA@example.com",
            "password": "safe-password-123",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["token"])

    def test_duplicate_email_is_rejected_case_insensitively(self):
        User.objects.create_user(name="Ada", email="ada@example.com", password="safe-password-123")

        response = self.client.post("/api/auth/signup/", {
            "name": "Ada Two",
            "email": "ADA@EXAMPLE.COM",
            "password": "another-safe-password",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_superuser_flags_cannot_be_disabled(self):
        with self.assertRaisesMessage(ValueError, "is_staff=True"):
            User.objects.create_superuser(
                name="Admin",
                email="admin@example.com",
                password="safe-password-123",
                is_staff=False,
            )
