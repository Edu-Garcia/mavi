import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const port = Number(process.env.PORT ?? 3000);

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "mavi-api" }));
    return;
  }

  res.writeHead(404).end();
});

server.listen(port, "0.0.0.0", () => {
  console.log(`MAVI API (dev) em http://0.0.0.0:${port}`);
});
