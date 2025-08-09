import Prisma from "../prisma.js";
export const isTokenValid = async (token) => {
  const record = await prisma.token.findFirst({
    where: { token },
  });

  return record !== null;
};

export const saveToken = async (userId, token) => {
  await Prisma.token.create({
    data: {
      userId,
      token,
    },
  });
};
