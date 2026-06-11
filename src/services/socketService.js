let io;

export const initSocket = (socketIoInstance) => {
  io = socketIoInstance;
  io.on("connection", (socket) => {
    console.log("🟢 Client connected to Socket.IO:", socket.id);

    socket.on("disconnect", () => {
      console.log("🔴 Client disconnected:", socket.id);
    });
  });
};

export const emitNewLead = (lead) => {
  if (io) {
    io.emit("new_lead", lead);
  } else {
    console.warn("Socket.io is not initialized, cannot emit new_lead");
  }
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
