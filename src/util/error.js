import { Prisma } from "@prisma/client";

const getErrorMessage = (error) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return "A unique constraint violation occurred. Please ensure that all fields are unique.";
      case "P2003":
        return "A foreign key constraint violation occurred. Please check related records.";
      case "P2025":
        return "The record was not found in the database.";
      default:
        return "A database error occurred. Please try again later.";
    }
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return "An unknown database error occurred. Please try again later.";
  } else {
    return (
      error.message || "An unexpected error occurred. Please try again later."
    );
  }
};

export default getErrorMessage;
