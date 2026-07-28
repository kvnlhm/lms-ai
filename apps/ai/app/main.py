from fastapi import FastAPI

app = FastAPI(
    title="LMS AI Service",
    version="0.1.0",
    description="Optional AI workload boundary. It has no authority over LMS state.",
)


@app.get("/health/live", tags=["health"])
async def live() -> dict[str, str]:
    return {"status": "ok", "service": "ai"}


@app.get("/health/ready", tags=["health"])
async def ready() -> dict[str, str]:
    # Provider readiness will be added only when an approved AI feature exists.
    return {"status": "ok", "service": "ai"}
