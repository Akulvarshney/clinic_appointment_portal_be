import express from "express";
import { loginMiddleware } from "../middleware/authMiddleware.js";
import FacebookProvider from "../services/leadProviders/FacebookProvider.js";
import prisma from "../prisma.js";

const router = express.Router();
const facebookProvider = new FacebookProvider();

router.get("/connect", loginMiddleware, (req, res) => {
  const { organizationId } = req.query;
  const redirectUri = `${process.env.FRONTEND_URL}/facebook-callback`;
  const url = `https://www.facebook.com/${facebookProvider.graphApiVersion}/dialog/oauth?client_id=${facebookProvider.appId}&redirect_uri=${redirectUri}&scope=pages_show_list,pages_read_engagement,leads_retrieval,pages_manage_metadata&state=${organizationId || req.userId}`;
  res.json({ url });
});

router.post("/callback", loginMiddleware, async (req, res) => {
  try {
    const { code, redirectUri, organizationId } = req.body;
    
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }

    const { accessToken, expiresIn } = await facebookProvider.authenticate({ code, redirectUri });

    const expiryDate = new Date();
    if (expiresIn) {
      expiryDate.setSeconds(expiryDate.getSeconds() + expiresIn);
    }

    // Get Facebook User ID (assuming basic access token gives us /me)
    const { data: fbUser } = await facebookProvider.fetchPages({ userAccessToken: accessToken }).catch(() => ({ data: { id: "unknown" } }));

    await prisma.facebook_integrations.upsert({
      where: { organization_id: organizationId },
      create: {
        organization_id: organizationId,
        facebook_user_id: fbUser?.id || "unknown", // Ideal is to fetch from /me but not strictly required if we just save token
        access_token: accessToken,
        token_expiry: expiresIn ? expiryDate : null,
      },
      update: {
        access_token: accessToken,
        token_expiry: expiresIn ? expiryDate : null,
        connection_status: "ACTIVE",
      },
    });

    res.json({ success: true, message: "Facebook connected successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/pages", loginMiddleware, async (req, res) => {
  try {
    const organizationId = req.query.organizationId || req.headers.organizationid;
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }

    const integration = await prisma.facebook_integrations.findUnique({
      where: { organization_id: organizationId },
    });

    if (!integration) {
      return res.status(404).json({ error: "Facebook integration not found" });
    }

    const pages = await facebookProvider.fetchPages({ userAccessToken: integration.access_token });
    
    // Check which pages are already saved
    const savedPages = await prisma.facebook_pages.findMany({
      where: { integration_id: integration.id },
    });
    const savedPageIds = new Set(savedPages.map(p => p.page_id));

    const enrichedPages = pages.map(p => ({
      ...p,
      isSubscribed: savedPageIds.has(p.id),
    }));

    res.json(enrichedPages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/save-pages", loginMiddleware, async (req, res) => {
  try {
    const { pages, organizationId } = req.body; // Array of page objects with id, name, accessToken, category, profileImage
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }

    const integration = await prisma.facebook_integrations.findUnique({
      where: { organization_id: organizationId },
    });

    if (!integration) {
      return res.status(404).json({ error: "Facebook integration not found" });
    }

    for (const page of pages) {
      // Subscribe page to webhooks
      await facebookProvider.subscribePage(page.id, page.accessToken);

      await prisma.facebook_pages.upsert({
        where: { page_id: page.id },
        create: {
          integration_id: integration.id,
          page_id: page.id,
          page_name: page.name,
          page_access_token: page.accessToken,
          page_profile_image: page.profileImage,
          page_category: page.category,
          is_subscribed: true,
        },
        update: {
          page_access_token: page.accessToken,
          is_subscribed: true,
        },
      });
    }

    res.json({ success: true, message: "Pages saved and subscribed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/status", loginMiddleware, async (req, res) => {
  try {
    const organizationId = req.query.organizationId || req.headers.organizationid;
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }

    const integration = await prisma.facebook_integrations.findUnique({
      where: { organization_id: organizationId },
    });

    if (!integration) {
      return res.json({ connected: false });
    }

    res.json({ connected: true, status: integration.connection_status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
