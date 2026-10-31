// Server-Sent Events (SSE) Manager for Real-Time MongoDB Change Stream Broadcasts
const clients = new Set();

export const addSSEClient = (res) => {
  clients.add(res);
  
  // Send initial handshake
  res.write(`data: ${JSON.stringify({ type: 'HANDSHAKE', message: 'Connected to Memora Live Change Stream', timestamp: new Date().toISOString() })}\n\n`);

  res.on('close', () => {
    clients.delete(res);
  });
};

export const broadcastChange = (type, data) => {
  const payload = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString(),
  });

  for (const client of clients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (err) {
      clients.delete(client);
    }
  }
};

export const getConnectedClientsCount = () => clients.size;

// Periodic heartbeat to keep connections open through proxies
setInterval(() => {
  for (const client of clients) {
    try {
      client.write(`: heartbeat\n\n`);
    } catch (err) {
      clients.delete(client);
    }
  }
}, 25000);

