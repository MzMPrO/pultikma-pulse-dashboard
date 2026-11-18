"""FastAPI app: wiring only (lifespan, CORS, routers). Endpoints live in app/api/."""
from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import analyze, chat, chats, misc
from .repo import get_repo
from .services import chat_store, fx

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_repo()  # pick PostGIS or CSV once at startup
    chat_store.get_store()  # create/open the chat memory file (logs and degrades to memory-only on failure)
    threading.Thread(target=fx.get_rate_info, daemon=True).start()  # warm the USD/UZS cache
    yield


app = FastAPI(title="PulTikma AI backend", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

for module in (misc, analyze, chat, chats):
    app.include_router(module.router)
