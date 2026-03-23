import http from "node:http";

const port = Number(process.env.PORT || 9100);
const atlasBaseUrl = process.env.ATLAS_PUBLIC_BASE_URL || "http://localhost:9000/bergamot-cdn";

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function normalizeMediaKey(pathname) {
  return pathname
    .replace(/^\/media\//, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);

  if (requestUrl.pathname === "/health") {
    sendJson(res, 200, { status: "ok", service: "bergamot-media-proxy" });
    return;
  }

  if (requestUrl.pathname.startsWith("/media/")) {
    const objectKey = normalizeMediaKey(requestUrl.pathname);
    if (!objectKey || objectKey.includes("..")) {
      sendJson(res, 400, { error: "Invalid media key" });
      return;
    }

    sendJson(res, 200, {
      service: "bergamot-media-proxy",
      objectKey,
      upstreamUrl: `${atlasBaseUrl}/${objectKey}`,
      status: "ready-for-proxying",
    });
    return;
  }

  if (requestUrl.pathname === "/preview") {
    const targetUrl = requestUrl.searchParams.get("url");
    if (!targetUrl) {
      sendJson(res, 400, { error: "Missing url query parameter" });
      return;
    }

    sendJson(res, 200, {
      service: "bergamot-media-proxy",
      requestedUrl: targetUrl,
      status: "preview-pipeline-placeholder",
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`[bergamot-media-proxy] listening on http://localhost:${port}`);
});
