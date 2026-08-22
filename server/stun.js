import dgram from 'node:dgram';

const STUN_COOKIE = 0x2112a442;
const STUN_REQ = 0x0001;
const STUN_RESP = 0x0101;
const STUN_ATTR_XOR_ADDR = 0x0020;
const STUN_HDR_SIZE = 20;
const STUN_ATTR_XOR_SIZE = 8;
const STUN_FAMILY_IPV4 = 0x01;
const STUN_COOKIE_BYTE1 = (STUN_COOKIE >>> 24) & 0xff;
const STUN_COOKIE_WORD1 = (STUN_COOKIE >>> 16) & 0xffff;

export const createStunBinding = (msg, rinfo) => {
  if (msg.length < STUN_HDR_SIZE) return null;
  const messageType = msg.readUInt16BE(0);
  const messageLength = msg.readUInt16BE(2);
  const magicCookie = msg.readUInt32BE(4);
  if (magicCookie !== STUN_COOKIE) return null;
  if (messageType !== STUN_REQ) return null;
  if (msg.length < STUN_HDR_SIZE + messageLength) return null;

  const transactionId = msg.subarray(8, STUN_HDR_SIZE);
  const response = Buffer.alloc(STUN_HDR_SIZE + 4 + STUN_ATTR_XOR_SIZE);
  response.writeUInt16BE(STUN_RESP, 0);
  response.writeUInt16BE(4 + STUN_ATTR_XOR_SIZE, 2);
  response.writeUInt32BE(STUN_COOKIE, 4);
  transactionId.copy(response, 8);
  response.writeUInt16BE(STUN_ATTR_XOR_ADDR, STUN_HDR_SIZE);
  response.writeUInt16BE(STUN_ATTR_XOR_SIZE, STUN_HDR_SIZE + 2);
  response.writeUInt8(0x00, STUN_HDR_SIZE + 4);
  response.writeUInt8(STUN_FAMILY_IPV4 ^ STUN_COOKIE_BYTE1, STUN_HDR_SIZE + 5);
  response.writeUInt16BE(rinfo.port ^ STUN_COOKIE_WORD1, STUN_HDR_SIZE + 6);

  const parts = rinfo.address.split('.');
  let ip = 0;
  const shifts = [24, 16, 8, 0];
  for (let index = 0; index < 4; index += 1) {
    ip = (ip | ((Number(parts[index]) || 0) << shifts[index])) >>> 0;
  }
  response.writeUInt32BE((ip ^ STUN_COOKIE) >>> 0, STUN_HDR_SIZE + 8);
  return response;
};

export const createStunServer = () => {
  const socket = dgram.createSocket('udp4');
  socket.on('message', (msg, rinfo) => {
    const response = createStunBinding(msg, rinfo);
    if (!response) return;
    socket.send(response, rinfo.port, rinfo.address);
  });
  return socket;
};
