import IORedis from "ioredis";

/**
 * Redis connections for BullMQ.
 *
 * Managed providers (Render Key Value, Upstash, etc.) hand out a single
 * connection URL, so REDIS_URL wins when present and the host/port pair stays
 * as the local-dev fallback. `rediss://` URLs get TLS from ioredis automatically.
 *
 * BullMQ needs a dedicated connection per Queue and per Worker: workers issue
 * blocking commands that would stall anything else sharing the socket.
 */
export function createRedisConnection(label) {
  const url = process.env.REDIS_URL?.trim();

  // BullMQ requires maxRetriesPerRequest to be null
  const connection = url
    ? new IORedis(url, { maxRetriesPerRequest: null })
    : new IORedis({
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        maxRetriesPerRequest: null,
      });

  connection.on("connect", () => {
    console.log(`✅ Redis connected (${label})`);
  });

  connection.on("error", (error) => {
    console.error(`❌ Redis error (${label}):`, error.message);
  });

  return connection;
}
