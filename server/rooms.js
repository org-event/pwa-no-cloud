export const createRooms = () => {
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

  return {
    join(roomId, clientId) {
      getClient(roomId, clientId);
    },
    attach(roomId, clientId, socket) {
      const client = getClient(roomId, clientId);
      client.sockets.add(socket);
    },
    detach(roomId, clientId, socket) {
      const room = rooms.get(roomId || 'default');
      const client = room?.get(clientId);
      if (!client) return;
      client.sockets.delete(socket);
    },
    leave(roomId, clientId) {
      const key = roomId || 'default';
      const room = rooms.get(key);
      if (!room) return;
      room.delete(clientId);
      if (room.size === 0) rooms.delete(key);
    },
    enqueue(roomId, from, to, data) {
      const client = getClient(roomId, to);
      const message = { from, to, data, ts: Date.now() };
      if (client.sockets.size > 0) {
        return { message, sockets: [...client.sockets] };
      }
      client.inbox.push(message);
      return { message, sockets: [] };
    },
    drain(roomId, clientId) {
      const room = rooms.get(roomId || 'default');
      const client = room?.get(clientId);
      if (!client) return [];
      const messages = client.inbox.splice(0, client.inbox.length);
      return messages;
    },
    peers(roomId, clientId) {
      const room = rooms.get(roomId || 'default');
      if (!room) return [];
      const ids = [];
      for (const id of room.keys()) {
        if (id !== clientId) ids.push(id);
      }
      return ids;
    },
  };
};
