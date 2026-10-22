"""Smoke-тесты каркаса (критерии HANDOFF §12)."""

from __future__ import annotations


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "САОТ" in body["app"]


def test_index_renders(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "охраны труда" in response.text


def test_runtime_dirs_created(client, settings_env):
    for d in (
        settings_env.data_dir,
        settings_env.backups_dir,
        settings_env.logs_dir,
        settings_env.attachments_dir,
    ):
        assert d.exists(), f"папка не создана: {d}"


def test_404_returns_russian_error_without_traceback(client):
    response = client.get("/net-takoy-stranicy")
    assert response.status_code == 404
    body = response.json()
    assert "не найдены" in body["error"]
    assert "Traceback" not in response.text
    assert body["request_id"]
    assert response.headers.get("X-Request-ID") == body["request_id"]


def test_correlation_id_passthrough(client):
    response = client.get("/health", headers={"X-Request-ID": "test-id-123"})
    assert response.headers["X-Request-ID"] == "test-id-123"
