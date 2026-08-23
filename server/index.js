import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createRooms } from './rooms.js';
import { createStunServer } from './stun.js';

const PORT = Number(process.env.PORT) || 8000;
const STUN_PORT = Number(process.env.STUN_PORT) || 3478;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_PATH = path.join(ROOT, 'dist');

const MIME = {
  default: 'application/octet-stream',
  html: 'text/html; charset=UTF-8',
  js: 'application/javascript; charset=UTF-8',
  css: 'text/css',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  ico: 'image/x-icon',
  webmanifest: 'application/manifest+json',
  map: 'application/json',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const rooms = createRooms();

const sendJSON = (res, status, body) => {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const parseBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();
  if (!raw) return {};
  return JSON.parse(raw);
};

const joinRoom = async (req, res) => {
  const body = await parseBody(req);
  const roomId = body.roomId || 'default';
  const clientId = body.clientId ?? '';
  if (!clientId) {
    sendJSON(res, 400, { error: 'clientId required' });
    return;
  }
  rooms.join(roomId, clientId);
  sendJSON(res, 200, { ok: true });
};

const sendSignal = async (req, res) => {
  const body = await parseBody(req);
  const roomId = body.roomId || 'default';
  const from = body.from;
  const to = body.to;
  const data = body.data;
  if (!from || !to || !data) {
    sendJSON(res, 400, { error: 'from, to, data required' });
    return;
  }
  const delivered = rooms.enqueue(roomId, from, to, data);
  for (const socket of delivered.sockets) {
    if (socket.readyState === 1) {
      socket.send(JSON.stringify({ op: 'signal', ...delivered.message }));
    }
  }
  sendJSON(res, 200, { ok: true });
};

const getSignal = (req, res, url) => {
  const roomId = url.searchParams.get('roomId') || 'default';
  const clientId = url.searchParams.get('clientId') ?? '';
  if (!clientId) {
    sendJSON(res, 400, { error: 'clientId required' });
    return;
  }
  sendJSON(res, 200, { messages: rooms.drain(roomId, clientId) });
};

const getPeers = (req, res, url) => {
  const roomId = url.searchParams.get('roomId') || 'default';
  const clientId = url.searchParams.get('clientId') ?? '';
  if (!clientId) {
    sendJSON(res, 400, { error: 'clientId required' });
    return;
  }
  sendJSON(res, 200, { peers: rooms.peers(roomId, clientId) });
};

const leaveRoom = async (req, res) => {
  const body = await parseBody(req);
  const roomId = body.roomId || 'default';
  const clientId = body.clientId ?? '';
  if (!clientId) {
    sendJSON(res, 400, { error: 'clientId required' });
    return;
  }
  rooms.leave(roomId, clientId);
  rooms.broadcastPeers(roomId);
  sendJSON(res, 200, { ok: true });
};

const routes = new Map([
  ['/join', { post: joinRoom }],
  ['/leave', { post: leaveRoom }],
  ['/signal', { post: sendSignal, get: getSignal }],
  ['/peers', { get: getPeers }],
]);

const prepareFile = async (urlPath) => {
  const relative = urlPath.endsWith('/') ? urlPath + 'index.html' : urlPath;
  const filePath = path.join(STATIC_PATH, relative);
  if (!filePath.startsWith(STATIC_PATH)) return null;
  try {
    await fs.promises.access(filePath);
    return filePath;
  } catch {
    return null;
  }
};

const handleRequest = async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  const route = routes.get(url.pathname);
  const method = (req.method ?? 'GET').toLowerCase();
  const handler = route?.[method];
  if (handler) {
    await handler(req, res, url);
    return;
  }
  const filePath = await prepareFile(url.pathname);
  if (!filePath) {
    res.writeHead(404, { ...CORS, 'Content-Type': 'text/plain' });
    res.end('Not found. Run vp build before node server/index.js');
    return;
  }
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const type = MIME[ext] ?? MIME.default;
  res.writeHead(200, { ...CORS, 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
};

const lanUrls = (port) => {
  const urls = [`http://127.0.0.1:${port}/`];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const list = nets[name] ?? [];
    for (const net of list) {
      if (net.internal) continue;
      if (net.family !== 'IPv4' && net.family !== 4) continue;
      urls.push(`http://${net.address}:${port}/`);
    }
  }
  return urls;
};

const attachSockets = (server) => {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (socket) => {
    let roomId = '';
    let clientId = '';
    socket.on('message', (raw) => {
      let body = {};
      try {
        body = JSON.parse(String(raw));
      } catch {
        socket.send(JSON.stringify({ op: 'error', message: 'bad json' }));
        return;
      }
      if (body.op === 'join') {
        roomId = body.roomId || 'default';
        clientId = body.clientId ?? '';
        if (!clientId) {
          socket.send(JSON.stringify({ op: 'error', message: 'clientId' }));
          return;
        }
        rooms.join(roomId, clientId);
        rooms.attach(roomId, clientId, socket);
        rooms.broadcastPeers(roomId);
        return;
      }
      if (body.op === 'peers' && clientId) {
        socket.send(
          JSON.stringify({ op: 'peers', peers: rooms.peers(roomId, clientId) }),
        );
        return;
      }
      if (body.op === 'signal' && clientId) {
        const delivered = rooms.enqueue(roomId, body.from, body.to, body.data);
        for (const target of delivered.sockets) {
          if (target.readyState === 1) {
            target.send(JSON.stringify({ op: 'signal', ...delivered.message }));
          }
        }
        socket.send(JSON.stringify({ op: 'ok' }));
      }
    });
    socket.on('close', () => {
      if (!clientId) return;
      rooms.detach(roomId, clientId, socket);
      // Presence + call can share the same clientId with two sockets.
      if (rooms.hasSockets(roomId, clientId)) return;
      rooms.leave(roomId, clientId);
      rooms.broadcastPeers(roomId);
    });
  });
  return wss;
};

const start = () => {
  const server = http.createServer((req, res) => {
    void handleRequest(req, res).catch(() => {
      if (!res.headersSent) sendJSON(res, 500, { error: 'server' });
    });
  });
  const stun = createStunServer();
  const wss = attachSockets(server);

  const shutdown = () => {
    wss.close();
    stun.close();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.listen(PORT, '0.0.0.0', () => {
    const urls = lanUrls(PORT);
    console.log('NoCloud signaling');
    for (const url of urls) console.log(`  ${url}`);
  });
  stun.bind(STUN_PORT, '0.0.0.0', () => {
    console.log(`STUN udp ${STUN_PORT}`);
  });
};

start();
