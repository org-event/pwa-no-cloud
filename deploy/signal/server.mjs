import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 8443;
const TLS_CERT = process.env.TLS_CERT ?? '';
const TLS_KEY = process.env.TLS_KEY ?? '';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const rooms = new Map();

const getRoom = (roomId) => {
  const key = roomId || 'default';
  let room = rooms.get(key);
  if (!room) {
    room = new Map();
    rooms.set(key, room);
  }
  return room;
};

const getClient = (roomId, clientId) => {
  const room = getRoom(roomId);
  let client = room.get(clientId);
  if (!client) {
    client = { inbox: [], sockets: new Set() };
    room.set(clientId, client);
  }
  return client;
};

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
  getClient(roomId, clientId);
  sendJSON(res, 200, { ok: true });
};

const sendSignal = async (req, res) => {
  const body = await parseBody(req);
  const roomId = body.roomId || 'default';
  if (!body.from || !body.to || !body.data) {
    sendJSON(res, 400, { error: 'from, to, data required' });
    return;
  }
  const client = getClient(roomId, body.to);
  const message = {
    from: body.from,
    to: body.to,
    data: body.data,
    ts: Date.now(),
  };
  if (client.sockets.size > 0) {
    for (const socket of client.sockets) {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify({ op: 'signal', ...message }));
      }
    }
  } else {
    client.inbox.push(message);
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
  const client = getClient(roomId, clientId);
  const messages = client.inbox.splice(0, client.inbox.length);
  sendJSON(res, 200, { messages });
};

const listPeers = (roomId, clientId) => {
  const room = rooms.get(roomId || 'default');
  const peers = [];
  if (!room) return peers;
  for (const id of room.keys()) {
    if (id !== clientId) peers.push(id);
  }
  return peers;
};

const broadcastPeers = (roomId) => {
  const room = rooms.get(roomId || 'default');
  if (!room) return;
  for (const [id, client] of room) {
    const payload = JSON.stringify({
      op: 'peers',
      peers: listPeers(roomId, id),
    });
    for (const socket of client.sockets) {
      if (socket.readyState === 1) socket.send(payload);
    }
  }
};

const getPeers = (req, res, url) => {
  const roomId = url.searchParams.get('roomId') || 'default';
  const clientId = url.searchParams.get('clientId') ?? '';
  sendJSON(res, 200, { peers: listPeers(roomId, clientId) });
};

const handleRequest = async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (url.pathname === '/' && req.method === 'GET') {
    sendJSON(res, 200, { ok: true, service: 'nocloud-signal' });
    return;
  }
  if (url.pathname === '/join' && req.method === 'POST') {
    await joinRoom(req, res);
    return;
  }
  if (url.pathname === '/signal' && req.method === 'POST') {
    await sendSignal(req, res);
    return;
  }
  if (url.pathname === '/signal' && req.method === 'GET') {
    getSignal(req, res, url);
    return;
  }
  if (url.pathname === '/peers' && req.method === 'GET') {
    getPeers(req, res, url);
    return;
  }
  sendJSON(res, 404, { error: 'not found' });
};

const onRequest = (req, res) => {
  void handleRequest(req, res).catch(() => {
    if (!res.headersSent) sendJSON(res, 500, { error: 'server' });
  });
};

const createServer = () => {
  if (TLS_CERT || TLS_KEY) {
    if (!TLS_CERT || !TLS_KEY) {
      console.error('TLS_CERT and TLS_KEY must both be set');
      process.exit(1);
    }
    return https.createServer(
      {
        cert: fs.readFileSync(TLS_CERT),
        key: fs.readFileSync(TLS_KEY),
      },
      onRequest,
    );
  }
  return http.createServer(onRequest);
};

const server = createServer();
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
      const client = getClient(roomId, clientId);
      client.sockets.add(socket);
      // Tell everyone — the first joiner must learn when the second arrives.
      broadcastPeers(roomId);
      return;
    }
    if (body.op === 'peers' && clientId) {
      socket.send(
        JSON.stringify({ op: 'peers', peers: listPeers(roomId, clientId) }),
      );
      return;
    }
    if (body.op === 'signal' && clientId) {
      const client = getClient(roomId, body.to);
      const message = {
        from: body.from,
        to: body.to,
        data: body.data,
        ts: Date.now(),
      };
      if (client.sockets.size > 0) {
        for (const target of client.sockets) {
          if (target.readyState === 1) {
            target.send(JSON.stringify({ op: 'signal', ...message }));
          }
        }
      } else {
        client.inbox.push(message);
      }
      socket.send(JSON.stringify({ op: 'ok' }));
    }
  });
  socket.on('close', () => {
    if (!clientId) return;
    const room = rooms.get(roomId || 'default');
    const client = room?.get(clientId);
    client?.sockets.delete(socket);
    room?.delete(clientId);
    if (room && room.size === 0) rooms.delete(roomId || 'default');
    broadcastPeers(roomId);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const kind = TLS_CERT ? 'https' : 'http';
  console.log(`NoCloud signaling ${kind} 0.0.0.0:${PORT}`);
});
