from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from sgs_api import __version__
from sgs_api.db import init_db
from sgs_api.routers import organization, patients, platform, production, territory


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="SGS API",
    version=__version__,
    lifespan=lifespan,
    description=(
        "Reescrita APS (backend-first). UI de produto adiada (Claude Design). "
        "Rastreio RF Obrigatório/Desejável + ganchos de produção/faturamento. "
        "Ver docs/planejamento/estrategia-reescrita-fase1.md"
    ),
)

app.include_router(platform.router)
app.include_router(organization.router)
app.include_router(patients.router)
app.include_router(territory.router)
app.include_router(production.router)
