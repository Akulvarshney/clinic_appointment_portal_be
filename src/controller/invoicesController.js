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

const generateInvoiceNumber = async (organizationId) => {
  try {
    const financialYear = getCurrentFinancialYear();
    console.log("organization Id", organizationId);
    // Use a transaction to ensure atomicity
    const newInvoiceNumber = await prisma.$transaction(async (tx) => {
      // Get organization details within the transaction
      const organization = await prisma.organization_billing_details.findUnique(
        {
          where: { organization_id: organizationId },
        }
      );

      if (!organization) {
        throw new Error("Organization not found");
      }

      const prefix = organization.billing_invoice_prefix || "INV";

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

      let sequenceNumber = organization.billing_invoice_sequence_start;

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
    const organizationBillDetails =
      await prisma.organization_billing_details.findUnique({
        where: { organization_id: organization_id },
      });

    console.log("siddhant bill details 1", organizationBillDetails);

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
          brand_name_text: organizationBillDetails.billing_brand_name,
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
      id, // Add id to destructure
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

    // Check if this is an update operation
    const isUpdate = !!id;

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

    const organizationBillDetails =
      await prisma.organization_billing_details.findUnique({
        where: { organization_id: organization_id },
      });

    console.log("siddhant bill details 2", organizationBillDetails);

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

    // If updating, validate that the bill exists
    if (isUpdate) {
      const existingBill = await prisma.bills.findUnique({
        where: { id },
      });

      if (!existingBill) {
        return res.status(404).json({
          success: false,
          message: "Bill not found",
        });
      }
    }

    // Generate invoice number only for new bills
    const invoiceNumber = isUpdate
      ? undefined
      : await generateQuotationNumber(organization_id);

    // Prepare bill data
    const billData = {
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
      //company_name_text: organization.company_name,
      is_valid: true,
    };

    // Add invoice_number only for create operation
    if (!isUpdate) {
      billData.invoice_number = invoiceNumber;
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      let bill;

      if (isUpdate) {
        // Update existing bill
        bill = await tx.bills.update({
          where: { id },
          data: billData,
        });

        // Delete existing line items
        await tx.bill_line_items.deleteMany({
          where: { bill_id: id },
        });
      } else {
        // Create new bill
        billData.brand_name_text = organizationBillDetails.billing_brand_name; // add the company name only when creating the existing bill

        bill = await tx.bills.create({
          data: billData,
        });
      }

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
    res.status(isUpdate ? 200 : 201).json({
      success: true,
      message: isUpdate
        ? "Invoice updated successfully"
        : "Invoice created successfully",
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
        updated_at: result.updated_at,
      },
    });
  } catch (error) {
    console.error("Error creating/updating invoice:", error);

    // Handle specific Prisma errors
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Invoice number already exists. Please try again.",
      });
    }

    res.status(500).json({
      success: false,
      message:
        error.message ||
        "Internal server error while creating/updating invoice",
    });
  }
};
export const getInvoiceReference = async (id) => {
  if (!id) return null;

  const bill = await prisma.bills.findUnique({
    where: { id }, // must specify the model
    select: { invoice_number: true },
  });

  return bill?.invoice_number ?? null;
};

export const getInvoices = async (req, res) => {
  try {
    const {
      organization_id,
      client_id,
      status,
      search,
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
      bill_type: bill_type,
    };

    if (client_id) {
      whereClause.client_id = client_id;
    }

    if (status) {
      whereClause.status = status;
    }
    if (search && search.trim() !== "") {
      whereClause.OR = [
        {
          invoice_number: {
            contains: search,
            mode: "insensitive", // case-insensitive search
          },
        },
        {
          bill_to_text: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }
    console.log();

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    console.log("limit ", page, limit);
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
        invoice_reference: true,
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
        created_at: "desc",
      },
      skip: skip,
      take: take,
    });
    console.log("bills", bills);
    const totalCount = await prisma.bills.count({
      where: whereClause,
    });
    console.log("totalCount", totalCount);

    const transformedBills = await Promise.all(
      bills.map(async (bill) => ({
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
        invoice_reference: bill.invoice_reference
          ? await getInvoiceReference(bill.invoice_reference)
          : null,
      }))
    );

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / take);
    const hasNextPage = parseInt(page) < totalPages;
    const hasPreviousPage = parseInt(page) > 1;
    //console.log("prerit4>> ", transformedBills);
    res.json({
      success: true,
      //data: transformedBills,
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
export const saveAsInvoices = async (req, res) => {
  const { id, orgId } = req.query; // quotation id
  //console.log("SIddhant ", id, orgId);
  try {
    const invoiceNumber = await generateInvoiceNumber(orgId);
    const orgBillingDetails =
      await prisma.organization_billing_details.findUnique({
        where: { organization_id: orgId },
      });
    console.log("orgBillingDetails ", orgBillingDetails);

    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.bills.findUnique({
        where: { id },
        include: { bill_line_items: true },
      });

      if (!quotation) {
        throw new Error("Quotation not found");
      }
      console.log(
        "quotation.bill_from_text + orgBillingDetails.gst_number ",
        quotation.bill_from_text + "\n" + orgBillingDetails.gst_number
      );
      const newInvoice = await tx.bills.create({
        data: {
          invoice_number: invoiceNumber,
          organization_id: quotation.organization_id,
          client_id: quotation.client_id,
          discount_percentage: quotation.discount_percentage,
          is_valid: true,
          bill_type: "INVOICE",
          bill_from_text:
            quotation.bill_from_text + "\n" + orgBillingDetails.gst_number,
          bill_to_text: quotation.bill_to_text,
          discount_amount: quotation.discount_amount,
          due_date: quotation.due_date,
          grand_total: quotation.grand_total,
          grand_total_before_rounding: quotation.grand_total_before_rounding,
          invoice_date: new Date(), // 👈 or quotation.invoice_date
          notes: quotation.notes,
          round_off_amount: quotation.round_off_amount,
          round_off_enabled: quotation.round_off_enabled,
          shipping_charges: quotation.shipping_charges,
          status: "SUBMITTED", // 👈 or "issued"
          sub_total: quotation.sub_total,
          taxable_after_discount: quotation.taxable_after_discount,
          terms: quotation.terms,
          total_cgst: quotation.total_cgst,
          total_igst: quotation.total_igst,
          total_sgst: quotation.total_sgst,
          total_tax: quotation.total_tax,
          brand_name_text: quotation.brand_name_text,
        },
      });

      if (quotation.bill_line_items.length > 0) {
        const newLineItems = quotation.bill_line_items.map((item) => ({
          bill_id: newInvoice.id,
          service_id: item.service_id,
          quantity: item.quantity,
          amount: item.amount,
          cgst_amount: item.cgst_amount,
          description: item.description,
          final_amount: item.final_amount,
          gst_percentage: item.gst_percentage,
          igst_amount: item.igst_amount,
          line_discount_share: item.line_discount_share,
          rate: item.rate,
          service_name: item.service_name,
          sgst_amount: item.sgst_amount,
          taxable_amount: item.taxable_amount,
          total_tax_amount: item.total_tax_amount,
        }));

        await tx.bill_line_items.createMany({
          data: newLineItems,
        });
      }

      await tx.bills.update({
        where: { id: quotation.id },
        data: {
          invoice_reference: newInvoice.id,
        },
      });

      return newInvoice;
    });

    res.status(201).json({
      success: true,
      invoice: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message || "Error converting quotation",
    });
  }
};

export const getBillById = async (req, res) => {
  const { id } = req.params;

  try {
    if (
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id
      )
    ) {
      return res.status(400).json({ error: "Invalid bill ID format" });
    }

    const bill = await prisma.bills.findUnique({
      where: { id },
      include: {
        bill_line_items: true,
        clients: true,
        organizations: true,
      },
    });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    return res.status(200).json({
      success: true,
      data: bill,
    });
  } catch (error) {
    console.error("Error fetching bill:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch bill details",
    });
  }
};
