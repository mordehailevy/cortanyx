"""Pure ASGI middleware: request size limit and security headers.

Pure ASGI (not BaseHTTPMiddleware) so streaming responses and client
disconnects ("Stop" button) pass through untouched.
"""

import json

SECURITY_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"no-referrer"),
    (b"x-frame-options", b"DENY"),
]


class SecurityMiddleware:
    def __init__(self, app, max_body_bytes: int):
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        length = dict(scope["headers"]).get(b"content-length", b"")
        if length.isdigit() and int(length) > self.max_body_bytes:
            body = json.dumps({"detail": "Request body too large"}).encode()
            await send({"type": "http.response.start", "status": 413,
                        "headers": [(b"content-type", b"application/json"), *SECURITY_HEADERS]})
            await send({"type": "http.response.body", "body": body})
            return

        # Bodies sent without Content-Length ("chunked") are counted while they arrive.
        received = 0
        too_large = False

        async def limited_receive():
            nonlocal received, too_large
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_body_bytes:
                    too_large = True
                    raise BodyTooLarge
            return message

        started = False

        rejected = False

        async def send_with_headers(message):
            nonlocal started, rejected
            if too_large:
                # FastAPI turns our exception into a 400 "error parsing the body": answer 413 instead
                if not rejected:
                    rejected = started = True
                    await self._reject(send)
                return
            if message["type"] == "http.response.start":
                started = True
                message["headers"] = [*message.get("headers", []), *SECURITY_HEADERS]
            await send(message)

        try:
            await self.app(scope, limited_receive, send_with_headers)
        except BodyTooLarge:
            if not started:
                await self._reject(send)
        except Exception:
            # the app may wrap our exception: still answer 413 when the body was too large
            if too_large and not started:
                await self._reject(send)
            else:
                raise

    async def _reject(self, send):
        body = json.dumps({"detail": "Request body too large"}).encode()
        await send({"type": "http.response.start", "status": 413,
                    "headers": [(b"content-type", b"application/json"), *SECURITY_HEADERS]})
        await send({"type": "http.response.body", "body": body})


class BodyTooLarge(Exception):
    pass
