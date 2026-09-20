import pytest
from httpx import ASGITransport, AsyncClient

from main import create_app


@pytest.mark.asyncio
async def test_finance_routes_mounted_in_real_app_and_require_auth():
    app = create_app(enable_rate_limiter=False, check_db_on_startup=False, enable_scheduler=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        schema = (await client.get("/api/openapi.json")).json()
        assert "/api/v1/demo/load" in schema["paths"]
        assert "/api/v1/dashboard" in schema["paths"]
        assert (await client.get("/api/v1/dashboard")).status_code in {401, 403}
        assert (await client.post("/api/v1/demo/load", json={})).status_code in {401, 403}
