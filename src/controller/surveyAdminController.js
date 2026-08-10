import prisma from "../prisma.js";
import { normalizeOrgId } from "../util/orgId.js";
import { sendErrorResponse, sendResponse } from "../util/response.js";

// Client Admin APIs for Organization Survey Form

export const getFormController = async (req, res) => {
  try {
    const { orgId } = req.query;
    const { ok, orgId: orgUuid } = normalizeOrgId(orgId);
    if (!ok) {
      return sendErrorResponse(res, "Valid orgId is required", 400);
    }

    const form = await prisma.feedback_forms.findFirst({
      where: { organization_id: orgUuid, is_active: true },
      include: {
        feedback_questions: {
          orderBy: { display_order: 'asc' }
        }
      }
    });

    return sendResponse(res, {
      message: "Form fetched successfully",
      data: form,
      status: 200
    }, 200);

  } catch (error) {
    console.error("Error fetching form:", error);
    return sendErrorResponse(res, error.message, 500);
  }
};

export const saveFormController = async (req, res) => {
  try {
    const { orgId, title, description, questions } = req.body;
    
    const { ok, orgId: orgUuid } = normalizeOrgId(orgId);
    if (!ok) {
      return sendErrorResponse(res, "Valid orgId is required", 400);
    }

    // Deactivate existing forms to ensure only one active form per org
    await prisma.feedback_forms.updateMany({
      where: { organization_id: orgUuid, is_active: true },
      data: { is_active: false }
    });

    const newForm = await prisma.$transaction(async (tx) => {
      const form = await tx.feedback_forms.create({
        data: {
          organization_id: orgUuid,
          title: title || "Feedback Form",
          description: description || "",
          is_active: true,
        }
      });

      if (questions && Array.isArray(questions) && questions.length > 0) {
        const questionsData = questions.map((q, index) => ({
          form_id: form.id,
          type: q.type,
          label: q.label,
          placeholder: q.placeholder || null,
          is_required: Boolean(q.is_required),
          options: q.options ? JSON.stringify(q.options) : null,
          validation_rules: q.validation_rules ? JSON.stringify(q.validation_rules) : null,
          display_order: typeof q.display_order === 'number' ? q.display_order : index,
          is_active: true
        }));
        await tx.feedback_questions.createMany({
          data: questionsData
        });
      }

      return await tx.feedback_forms.findUnique({
        where: { id: form.id },
        include: {
          feedback_questions: {
            orderBy: { display_order: 'asc' }
          }
        }
      });
    });

    return sendResponse(res, {
      message: "Form saved successfully",
      data: newForm,
      status: 200
    }, 200);

  } catch (error) {
    console.error("Error saving form:", error);
    return sendErrorResponse(res, error.message, 500);
  }
};
