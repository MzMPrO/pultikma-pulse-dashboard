import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Hermetic tests: CSV repository, no network, no LLM.
os.environ["FX_OFFLINE"] = "1"
for var in ("DATABASE_URL", "LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"):
    os.environ.pop(var, None)

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_state():
    from app import agent, fx
    from app.repo import reset_repo

    agent.reset_sessions()
    fx.reset()
    reset_repo(None)
    yield


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)
