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

// Helper function to generate invoice number
const generateInvoiceNumber = async (organizationId) => {
  try {
    const financialYear = getCurrentFinancialYear();

    // Use a transaction to ensure atomicity
    const newInvoiceNumber = await prisma.$transaction(async (tx) => {
      // Get organization details within the transaction
      const organization = await tx.organizations.findUnique({
        where: { id: organizationId },
        select: {
          invoice_prefix: true,
          invoice_sequence_start: true,
          name: true,
        },
      });

      if (!organization) {
        throw new Error("Organization not found");
      }

      const prefix = organization.invoice_prefix || "INV";

      const lastInvoice = await tx.bills.findFirst({
        where: {
          organization_id: organizationId,
          bill_type: "INVOICE",
          invoice_number: {
            startsWith: `${prefix}/${financialYear}/`,
          },
        },
        orderBy: {
          created_at: "desc", // This is the fix.
        },
        select: {
          invoice_number: true,
        },
      });

      let sequenceNumber = organization.invoice_sequence_start;

      if (lastInvoice) {
        // Extract and increment the sequence number from the last invoice
        const parts = lastInvoice.invoice_number.split("/");
        if (parts.length === 3) {
          const lastSequence = parseInt(parts[2]);
          if (!isNaN(lastSequence)) {
            sequenceNumber = lastSequence + 1;
          }
        }
      }

      // Return the new invoice number string
      return `${prefix}/${financialYear}/${sequenceNumber}`;
    });

    return newInvoiceNumber;
  } catch (error) {
    console.error("Error generating invoice number:", error);
    throw error;
  }
};

const generateQuotationNumber = async (organizationId) => {
  try {
    // Get organization details
    const organization = await prisma.organizations.findUnique({
      where: { id: organizationId },
      select: {
        name: true,
      },
    });

    if (!organization) {
      throw new Error("Organization not found");
    }

    const financialYear = getCurrentFinancialYear();
    const prefix = "QUOTATION";

    // Find the last quotation for this organization in current financial year
    const lastQuotation = await prisma.bills.findFirst({
      where: {
        organization_id: organizationId,
        bill_type: "QUOTATION",
        invoice_number: {
          startsWith: `${prefix}/${financialYear}/`,
        },
      },
      orderBy: {
        created_at: "desc",
      },
      select: {
        invoice_number: true,
      },
    });

    let sequenceNumber = 0; // Start from 0 for quotations

    if (lastQuotation) {
      // Extract sequence number from last quotation
      const parts = lastQuotation.invoice_number.split("/");
      if (parts.length === 3) {
        const lastSequence = parseInt(parts[2]);
        if (!isNaN(lastSequence)) {
          sequenceNumber = lastSequence + 1;
        }
      }
    }

    return `${prefix}/${financialYear}/${sequenceNumber}`;
  } catch (error) {
    console.error("Error generating quotation number:", error);
    throw error;
  }
};

export const createInvoice = async (req, res) => {
  try {
    const {
      organization_id,
      client_id,
      invoice_date,
      due_date,
      sub_total,
      discount_amount,
      discount_percentage,
      taxable_after_discount,
      total_cgst,
      total_sgst,
      total_igst,
      total_tax,
      shipping_charges,
      round_off_amount,
      grand_total_before_rounding,
      grand_total,
      bill_to_text,
      bill_from_text,
      notes,
      terms,
      round_off_enabled,
      bill_type = "INVOICE",
      status = "SUBMITTED",
      line_items,
    } = req.body;

    // Validate required fields
    if (
      !organization_id ||
      !client_id ||
      !invoice_date ||
      !line_items ||
      line_items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: organization_id, client_id, invoice_date, or line_items",
      });
    }

    // Validate organization exists
    const organization = await prisma.organizations.findUnique({
      where: { id: organization_id },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Validate client exists
    const client = await prisma.clients.findUnique({
      where: { id: client_id },
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(organization_id);

    console.log("inoice number", invoiceNumber);

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the bill
      const bill = await tx.bills.create({
        data: {
          invoice_number: invoiceNumber,
          organization_id,
          client_id,
          invoice_date: new Date(invoice_date),
          due_date: due_date ? new Date(due_date) : null,
          sub_total: parseFloat(sub_total),
          discount_amount: parseFloat(discount_amount) || 0,
          discount_percentage: parseFloat(discount_percentage) || 0,
          taxable_after_discount: parseFloat(taxable_after_discount),
          total_cgst: parseFloat(total_cgst) || 0,
          total_sgst: parseFloat(total_sgst) || 0,
          total_igst: parseFloat(total_igst) || 0,
          total_tax: parseFloat(total_tax) || 0,
          shipping_charges: parseFloat(shipping_charges) || 0,
          round_off_amount: parseFloat(round_off_amount) || 0,
          grand_total_before_rounding: parseFloat(grand_total_before_rounding),
          grand_total: parseFloat(grand_total),
          bill_to_text,
          bill_from_text,
          notes,
          terms,
          round_off_enabled: round_off_enabled === true,
          bill_type,
          status,
          is_valid: true,
        },
      });

      // Create line items
      const lineItemsData = line_items.map((item) => ({
        bill_id: bill.id,
        service_id: item.service_id,
        service_name: item.service_name,
        description: item.description,
        quantity: parseFloat(item.quantity),
        rate: parseFloat(item.rate),
        amount: parseFloat(item.amount),
        gst_percentage: parseFloat(item.gst_percentage) || 0,
        line_discount_share: parseFloat(item.line_discount_share) || 0,
        taxable_amount: parseFloat(item.taxable_amount),
        cgst_amount: parseFloat(item.cgst_amount) || 0,
        sgst_amount: parseFloat(item.sgst_amount) || 0,
        igst_amount: parseFloat(item.igst_amount) || 0,
        total_tax_amount: parseFloat(item.total_tax_amount) || 0,
        final_amount: parseFloat(item.final_amount),
      }));

      await tx.bill_line_items.createMany({
        data: lineItemsData,
      });

      return bill;
    });

    // Return success response
    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: {
        id: result.id,
        invoice_number: result.invoice_number,
        organization_id: result.organization_id,
        client_id: result.client_id,
        invoice_date: result.invoice_date,
        due_date: result.due_date,
        grand_total: result.grand_total,
        status: result.status,
        created_at: result.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating invoice:", error);

    // Handle specific Prisma errors
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Invoice number already exists. Please try again.",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Internal server error while creating invoice",
    });
  }
};

export const createQuotation = async (req, res) => {
  try {
    const {
      organization_id,
      client_id,
      invoice_date,
      due_date,
      sub_total,
      discount_amount,
      discount_percentage,
      taxable_after_discount,
      total_cgst,
      total_sgst,
      total_igst,
      total_tax,
      shipping_charges,
      round_off_amount,
      grand_total_before_rounding,
      grand_total,
      bill_to_text,
      bill_from_text,
      notes,
      terms,
      round_off_enabled,
      bill_type = "QUOTATION",
      status = "SUBMITTED",
      line_items,
    } = req.body;

    if (
      !organization_id ||
      !client_id ||
      !invoice_date ||
      !line_items ||
      line_items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: organization_id, client_id, invoice_date, or line_items",
      });
    }

    // Validate organization exists
    const organization = await prisma.organizations.findUnique({
      where: { id: organization_id },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Validate client exists
    const client = await prisma.clients.findUnique({
      where: { id: client_id },
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const invoiceNumber = await generateQuotationNumber(organization_id);

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the bill
      const bill = await tx.bills.create({
        data: {
          invoice_number: invoiceNumber,
          organization_id,
          client_id,
          invoice_date: new Date(invoice_date),
          due_date: due_date ? new Date(due_date) : null,
          sub_total: parseFloat(sub_total),
          discount_amount: parseFloat(discount_amount) || 0,
          discount_percentage: parseFloat(discount_percentage) || 0,
          taxable_after_discount: parseFloat(taxable_after_discount),
          total_cgst: parseFloat(total_cgst) || 0,
          total_sgst: parseFloat(total_sgst) || 0,
          total_igst: parseFloat(total_igst) || 0,
          total_tax: parseFloat(total_tax) || 0,
          shipping_charges: parseFloat(shipping_charges) || 0,
          round_off_amount: parseFloat(round_off_amount) || 0,
          grand_total_before_rounding: parseFloat(grand_total_before_rounding),
          grand_total: parseFloat(grand_total),
          bill_to_text,
          bill_from_text,
          notes,
          terms,
          round_off_enabled: round_off_enabled === true,
          bill_type,
          status,
          is_valid: true,
        },
      });

      // Create line items
      const lineItemsData = line_items.map((item) => ({
        bill_id: bill.id,
        service_id: item.service_id,
        service_name: item.service_name,
        description: item.description,
        quantity: parseFloat(item.quantity),
        rate: parseFloat(item.rate),
        amount: parseFloat(item.amount),
        gst_percentage: parseFloat(item.gst_percentage) || 0,
        line_discount_share: parseFloat(item.line_discount_share) || 0,
        taxable_amount: parseFloat(item.taxable_amount),
        cgst_amount: parseFloat(item.cgst_amount) || 0,
        sgst_amount: parseFloat(item.sgst_amount) || 0,
        igst_amount: parseFloat(item.igst_amount) || 0,
        total_tax_amount: parseFloat(item.total_tax_amount) || 0,
        final_amount: parseFloat(item.final_amount),
      }));

      await tx.bill_line_items.createMany({
        data: lineItemsData,
      });

      return bill;
    });

    // Return success response
    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: {
        id: result.id,
        invoice_number: result.invoice_number,
        organization_id: result.organization_id,
        client_id: result.client_id,
        invoice_date: result.invoice_date,
        due_date: result.due_date,
        grand_total: result.grand_total,
        status: result.status,
        created_at: result.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating invoice:", error);

    // Handle specific Prisma errors
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Invoice number already exists. Please try again.",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Internal server error while creating invoice",
    });
  }
};

export const getInvoices = async (req, res) => {
  try {
    const {
      organization_id,
      client_id,
      status,
      bill_type,
      page = 1,
      limit = 10,
    } = req.query;

    // Validation
    if (!organization_id) {
      return res.status(400).json({
        error: "organization_id is required",
      });
    }

    // Build where clause
    const whereClause = {
      organization_id: organization_id,
      is_valid: true,
    };

    if (client_id) {
      whereClause.client_id = client_id;
    }

    if (status) {
      whereClause.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Fetch bills with related data
    const bills = await prisma.bills.findMany({
      where: whereClause,
      select: {
        id: true,
        invoice_number: true,
        invoice_date: true,
        grand_total: true,
        status: true,
        bill_to_text: true,
        bill_type: true,
        clients: {
          select: {
            id: true,
            first_name: true,
            email: true,
          },
        },
        bill_line_items: {
          select: {
            id: true,
            final_amount: true,
          },
        },
      },
      orderBy: {
        invoice_date: "desc",
      },
      skip: skip,
      take: take,
    });

    // Get total count for pagination
    const totalCount = await prisma.bills.count({
      where: whereClause,
    });

    // Transform data to match requirements
    console.log("bills sid", bills);
    const transformedBills = bills.map((bill) => ({
      invoice_id: bill.id,
      invoice_number: bill.invoice_number,
      invoice_date: bill.invoice_date,
      client_name: bill.clients.first_name,
      bill_to: bill.bill_to_text,
      bill_type: bill.bill_type,
      client_email: bill.clients.email,
      number_of_services: bill.bill_line_items.length,
      final_amount: bill.grand_total,
      status: bill.status,
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / take);
    const hasNextPage = parseInt(page) < totalPages;
    const hasPreviousPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: transformedBills,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_records: totalCount,
        records_per_page: take,
        has_next_page: hasNextPage,
        has_previous_page: hasPreviousPage,
      },
    });
  } catch (error) {
    console.error("Error fetching bills:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};
