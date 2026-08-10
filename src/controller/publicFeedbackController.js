import prisma from "../prisma.js";
import { sendErrorResponse, sendResponse } from "../util/response.js";

export const getPublicFeedbackController = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
      include: {
        organizations: { select: { name: true } },
        appointments: { 
          select: { 
            date_time: true, 
            start_time: true,
            doctors: { select: { first_name: true, last_name: true } },
            employees: { select: { first_name: true, last_name: true } },
            clients: { select: { first_name: true, last_name: true } },
            services: { select: { name: true } }
          } 
        },
      }
    });

    if (!feedback) {
      return sendErrorResponse(res, "Feedback record not found", 404);
    }

    if (feedback.status === "Completed") {
      return sendResponse(res, {
        message: "This feedback has already been submitted.",
        data: {
          feedback,
          isCompleted: true
        },
        status: 200
      }, 200);
    }

    // Fetch active feedback form for the organization
    const activeForm = await prisma.feedback_forms.findFirst({
      where: { organization_id: feedback.organization_id, is_active: true },
      include: {
        feedback_questions: {
          where: { is_active: true },
          orderBy: { display_order: 'asc' }
        }
      }
    });

    return sendResponse(res, {
      message: "Feedback details fetched successfully",
      data: {
        feedback,
        activeForm
      },
      status: 200
    }, 200);

  } catch (error) {
    console.error("Error fetching public feedback:", error);
    return sendErrorResponse(res, error.message, 500);
  }
};

export const submitPublicFeedbackController = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { formId, answers } = req.body; 

    if (!formId || !answers || !Array.isArray(answers)) {
      return sendErrorResponse(res, "Invalid submission data", 400);
    }

    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId }
    });

    if (!feedback) {
      return sendErrorResponse(res, "Feedback record not found", 404);
    }
    if (feedback.status === "Completed") {
      return sendErrorResponse(res, "This feedback has already been submitted.", 400);
    }

    // Validate form exists
    const form = await prisma.feedback_forms.findUnique({
      where: { id: formId },
      include: {
        feedback_questions: {
          where: { is_active: true }
        }
      }
    });

    if (!form) {
      return sendErrorResponse(res, "Feedback form not found", 404);
    }

    // Check required questions
    const requiredQuestions = form.feedback_questions.filter(q => q.is_required);
    for (const reqQ of requiredQuestions) {
      const answered = answers.find(a => a.questionId === reqQ.id);
      if (!answered || (!answered.answerText && !answered.answerJson)) {
         return sendErrorResponse(res, `Missing required question: ${reqQ.label}`, 400);
      }
    }

    // Start Transaction
    await prisma.$transaction(async (tx) => {
      const answerData = answers.map(ans => ({
        feedback_id: feedbackId,
        question_id: ans.questionId,
        answer_text: ans.answerText || null,
        answer_json: ans.answerJson ? JSON.stringify(ans.answerJson) : null
      }));

      if (answerData.length > 0) {
        await tx.feedback_answers.createMany({
          data: answerData
        });
      }

      await tx.feedback.update({
        where: { id: feedbackId },
        data: { 
          status: "Completed",
          form_id: formId
        }
      });
    });

    return sendResponse(res, {
      message: "Feedback submitted successfully",
      status: 200
    }, 200);

  } catch (error) {
    console.error("Error submitting public feedback:", error);
    return sendErrorResponse(res, error.message, 500);
  }
};
