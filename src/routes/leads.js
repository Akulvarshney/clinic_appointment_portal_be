import express from "express";
import { loginMiddleware } from "../middleware/authMiddleware.js";
import prisma from "../prisma.js";

const router = express.Router();

router.get("/dashboard-stats", loginMiddleware, async (req, res) => {
  try {
    const organizationId = req.query.organizationId || req.headers.organizationid;
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalLeads, todayLeads, weeklyLeads, monthlyLeads, activePages] = await Promise.all([
      prisma.leads.count({ where: { organization_id: organizationId } }),
      prisma.leads.count({ where: { organization_id: organizationId, created_at: { gte: startOfToday } } }),
      prisma.leads.count({ where: { organization_id: organizationId, created_at: { gte: startOfWeek } } }),
      prisma.leads.count({ where: { organization_id: organizationId, created_at: { gte: startOfMonth } } }),
      
      prisma.facebook_pages.count({
        where: {
          is_subscribed: true,
          integration: { organization_id: organizationId },
        },
      }),
    ]);

    res.json({
      totalLeads,
      todayLeads,
      weeklyLeads,
      monthlyLeads,
      activePages,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/", loginMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", startDate, endDate, organizationId } = req.query;
    
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }

    const where = {
      organization_id: organizationId,
      OR: [
        { full_name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ],
    };

    if (startDate && endDate) {
      where.created_time = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const leads = await prisma.leads.findMany({
      where,
      include: {
        facebook_pages: {
          select: { page_name: true },
        },
      },
      orderBy: { created_time: "desc" },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    const total = await prisma.leads.count({ where });

    res.json({
      leads: leads.map(l => ({ ...l, page_name: l.facebook_pages?.page_name })),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", loginMiddleware, async (req, res) => {
  try {
    const organizationId = req.query.organizationId || req.headers.organizationid;
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }

    const lead = await prisma.leads.findFirst({
      where: {
        id: req.params.id,
        organization_id: organizationId,
      },
      include: {
        facebook_pages: true,
      },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
