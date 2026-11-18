import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Hermetic tests: CSV repository, no network, no LLM.
os.environ["FX_OFFLINE"] = "1"
for var in ("DATABASE_URL", "LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"):
    os.environ[var] = ""  # empty (not popped) so backend/.env can't fill them in

import pytest  # noqa: E402


@pytest.fixture()
def chat_dir():
    """Private scratch dir per test (plain tempfile: pytest's own tmp_path base can be unwritable on Windows)."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as d:
        yield Path(d)


@pytest.fixture(autouse=True)
def _fresh_state(chat_dir, monkeypatch):
    from app.services import agent, chat_store, fx
    from app.repo import reset_repo

    # every test gets its own chat DB file (never touches backend/var/chat.db)
    monkeypatch.setenv("CHAT_DB_PATH", str(chat_dir / "var" / "chat.db"))
    chat_store.reset_store()
    agent.reset_sessions()
    fx.reset()
    reset_repo(None)
    yield
    chat_store.reset_store()


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)
