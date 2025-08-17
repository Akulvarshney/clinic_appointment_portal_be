import prisma from "../prisma.js";
import { sendErrorResponse, sendResponse } from "../util/response.js";

function getRandomLightMidHex() {
  // HSL: Hue [0–360], Saturation [40–80%], Lightness [40–70%]
  const h = Math.floor(Math.random() * 360);      // any hue
  const s = Math.floor(Math.random() * 40) + 40;  // 40–80% saturation
  const l = Math.floor(Math.random() * 30) + 40;  // 40–70% lightness

  // Convert HSL → RGB
  function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [
      Math.round(255 * f(0)),
      Math.round(255 * f(8)),
      Math.round(255 * f(4)),
    ];
  }

  // Convert RGB → HEX
  function rgbToHex(r, g, b) {
    return (
      "#" +
      [r, g, b]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    );
  }

  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}





export const createCategory = async (req, res) => {
  try {
    const { category_name, organization_id, is_valid } = req.body;

    if (!category_name || !organization_id) {
      return sendErrorResponse(
        res,
        "category_name and organization_id are required",
        400
      );
    }

    console.log("Creating category:", {
      category_name,
      organization_id,
      is_valid,
    });

    // Enforce uniqueness by checking first
    const existing = await prisma.categories.findFirst({
      where: {
        organization_id,
        category_name,
      },
    });

    if (existing) {
      return sendErrorResponse(
        res,
        "Category with the same name already exists for this organization",
        409
      );
    }

    const colorHex = getRandomLightMidHex();

    const category = await prisma.categories.create({
      data: {
        category_name,
        organization_id,
        is_valid: is_valid ?? true,
        categories_color:colorHex,
      },
    });

    return sendResponse(res, { category }, 201);
  } catch (err) {
    // Map Prisma unique constraint error to 409 when applicable
    if (err && err.code === "P2002") {
      return sendErrorResponse(
        res,
        "Category with the same name already exists for this organization",
        409
      );
    }
    return sendErrorResponse(res, err);
  }
};

export const getCategories = async (req, res) => {
  try {
    const { organization_id, is_valid } = req.query;

    const categories = await prisma.categories.findMany({
      where: {
        is_valid: is_valid ? is_valid === "true" : undefined,
        ...(organization_id ? { organization_id } : {}),
      },
      orderBy: { created_at: "desc" },
    });

    return sendResponse(res, { categories }, 200);
  } catch (err) {
    return sendErrorResponse(res, err);
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.categories.findUnique({
      where: { id },
    });

    if (!category) {
      return sendErrorResponse(res, "Category not found", 404);
    }

    return sendResponse(res, { category }, 200);
  } catch (err) {
    return sendErrorResponse(res, err);
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name, is_valid } = req.body;

    const category = await prisma.categories.update({
      where: { id },
      data: {
        category_name,
        is_valid,
        updated_at: new Date(),
      },
    });

    return sendResponse(res, { category }, 200);
  } catch (err) {
    return sendErrorResponse(res, err);
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.categories.delete({
      where: { id },
    });

    return sendResponse(res, { message: "Category deleted successfully" }, 200);
  } catch (err) {
    return sendErrorResponse(res, err);
  }
};
