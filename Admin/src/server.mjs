import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const port = Number(process.env.PORT || 9101);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
]);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  res.writeHead(200, {
    "Content-Type": contentTypes.get(ext) || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=300",
  });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);

  if (requestUrl.pathname === "/health") {
    sendJson(res, 200, { status: "ok", service: "bergamot-admin" });
    return;
  }

  const candidatePath =
    requestUrl.pathname === "/" ? path.join(publicDir, "index.html") : path.join(publicDir, requestUrl.pathname);

  if (!candidatePath.startsWith(publicDir)) {
    sendJson(res, 400, { error: "Invalid path" });
    return;
  }

  if (!existsSync(candidatePath)) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const metadata = await stat(candidatePath);
  if (metadata.isDirectory()) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  sendFile(res, candidatePath);
});

server.listen(port, () => {
  console.log(`[bergamot-admin] listening on http://localhost:${port}`);
});
