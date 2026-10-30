"""Demo mode: the operator lives on loopback; LAN phones only submit scoped GPS."""
from starlette.datastructures import Headers, URL
from starlette.responses import JSONResponse

LOOPBACK = {"127.0.0.1", "::1"}
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
DEV_ORIGINS = {"http://localhost:5173", "http://127.0.0.1:5173"}
PHONE_COMMANDS = {("POST", "/api/location"), ("GET", "/api/location/context")}


def operator_allowed(scope):
    client = scope.get("client")
    headers = Headers(scope=scope)
    url = URL(scope=scope)
    if not client or client[0] not in LOOPBACK or url.hostname not in LOCAL_HOSTS:
        return False
    if headers.get("sec-fetch-site") == "cross-site":
        return False
    origin = headers.get("origin")
    scheme = "https" if url.scheme in {"https", "wss"} else "http"
    return not origin or origin in {f"{scheme}://{url.netloc}", *DEV_ORIGINS}


class OperatorBoundary:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        kind, path = scope["type"], scope.get("path", "")
        if kind not in {"http", "websocket"}:
            return await self.app(scope, receive, send)
        protected = kind == "websocket" or path == "/" or path.startswith(("/api/", "/acceso", "/docs", "/redoc", "/openapi.json"))
        phone = kind == "http" and (scope.get("method"), path) in PHONE_COMMANDS
        if protected and not phone and not operator_allowed(scope):
            if kind == "websocket":
                return await send({"type": "websocket.close", "code": 1008})
            response = JSONResponse({"detail": {"code": "local_operator_required",
                "message": "Abre el panel desde localhost en la PC. Para cuidar por internet, utiliza el portal con tu cuenta."}},
                status_code=403, headers={"Cache-Control": "no-store"})
            return await response(scope, receive, send)
        return await self.app(scope, receive, send)
