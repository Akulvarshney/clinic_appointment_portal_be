import prisma from "../prisma.js";

const getCurrentFinancialYear = () => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
  const currentYear = now.getFullYear();

  // Financial year starts from April (month 4)
  if (currentMonth >= 4) {
    return `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
  } else {
    return `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
  }
};

// Function to generate the next receipt_id inside a transaction
const generateReceiptId = async (tx, organization_id) => {
  // Find the latest receipt for this organization
  const lastReceipt = await tx.receipts.findFirst({
    where: { organization_id },
    orderBy: { created_at: "desc" },
    select: { receipt_id: true },
  });

  let nextNumber = 1;
  if (lastReceipt && lastReceipt.receipt_id) {
    // Extract numeric part from receipt_id (assuming format REC_<number>)
    const parts = lastReceipt.receipt_id.split("_");
    const lastNumber = parseInt(parts[1], 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `REC_${nextNumber}`;
};

export const saveReceipt = async (req, res) => {
  try {
    const { organization_id, client_id, amount, line_items } = req.body;

    if (!organization_id || !client_id || !amount) {
      return res.status(400).json({
        error: "organization_id, client_id and amount are required",
      });
    }
    const organization = await prisma.organizations.findUnique({
      where: { id: organization_id },
    });

    const organizationBillDetails =
      await prisma.organization_billing_details.findUnique({
        where: { organization_id: organization_id },
      });

    const newReceipt = await prisma.$transaction(async (tx) => {
      const receipt_id = await generateReceiptId(tx, organization_id);
      const company_text =
        organizationBillDetails.billing_company_name +
        "\n" +
        organizationBillDetails.billing_phone +
        "\n" +
        organizationBillDetails.state;
      console.log("company_text", company_text);
      return tx.receipts.create({
        data: {
          receipt_id,
          organization_id,
          client_id,
          amount,
          company_name_text: company_text,
          brand_name_text: organizationBillDetails.billing_brand_name,
          is_valid: true,
          // created_at: new Date(),
          //updated_at: new Date(),
          receipt_bill_line_items: {
            create:
              line_items?.map((item) => ({
                service_id: item.service_id,
                service_name: item.service_name,
                quantity: item.quantity || 1,
              })) || [],
          },
        },
        include: {
          receipt_bill_line_items: true,
        },
      });
    });

    res.status(201).json({
      success: true,
      financialYear: getCurrentFinancialYear(),
      data: newReceipt,
    });
  } catch (error) {
    console.error("Error saving receipt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const getReceipt = async (req, res) => {
  try {
    const { orgId, search = "", page = 1, limit = 10, receiptId } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: "organization_id is required" });
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    const skip = (pageNumber - 1) * pageSize;

    const where = {
      organization_id: orgId,
      id: receiptId,
      OR: [
        { receipt_id: { contains: search, mode: "insensitive" } },
        { clients: { first_name: { contains: search, mode: "insensitive" } } },
      ],
    };

    const [total, receipts] = await prisma.$transaction([
      prisma.receipts.count({ where }),
      prisma.receipts.findMany({
        where,
        include: {
          receipt_bill_line_items: true,
          clients: true,
        },
        orderBy: { created_at: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    res.json({
      success: true,
      data: receipts,
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching receipts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
