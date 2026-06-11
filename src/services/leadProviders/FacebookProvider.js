import LeadProvider from "./LeadProvider.js";
import axios from "axios";

export default class FacebookProvider extends LeadProvider {
  constructor() {
    super();
    this.appId = process.env.FACEBOOK_APP_ID;
    this.appSecret = process.env.FACEBOOK_APP_SECRET;
    this.graphApiVersion = "v21.0";
    this.baseUrl = `https://graph.facebook.com/${this.graphApiVersion}`;
  }

  async authenticate({ code, redirectUri }) {
    try {
      // Exchange code for short-lived access token
      const tokenRes = await axios.get(`${this.baseUrl}/oauth/access_token`, {
        params: {
          client_id: this.appId,
          client_secret: this.appSecret,
          redirect_uri: redirectUri,
          code,
        },
      });

      const shortLivedToken = tokenRes.data.access_token;

      // Exchange short-lived token for long-lived token
      const longLivedRes = await axios.get(`${this.baseUrl}/oauth/access_token`, {
        params: {
          grant_type: "fb_exchange_token",
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: shortLivedToken,
        },
      });

      return {
        accessToken: longLivedRes.data.access_token,
        expiresIn: longLivedRes.data.expires_in,
      };
    } catch (error) {
      console.error("Facebook Auth Error:", error.response?.data || error.message);
      throw new Error("Failed to authenticate with Facebook");
    }
  }

  async fetchPages({ userAccessToken }) {
    try {
      const res = await axios.get(`${this.baseUrl}/me/accounts`, {
        params: {
          access_token: userAccessToken,
          fields: "id,name,access_token,category,picture",
        },
      });

      return res.data.data.map((page) => ({
        id: page.id,
        name: page.name,
        accessToken: page.access_token,
        category: page.category,
        profileImage: page.picture?.data?.url,
      }));
    } catch (error) {
      console.error("Facebook Fetch Pages Error:", error.response?.data || error.message);
      throw new Error("Failed to fetch Facebook pages");
    }
  }

  async subscribePage(pageId, pageAccessToken) {
    try {
      const res = await axios.post(
        `${this.baseUrl}/${pageId}/subscribed_apps`,
        {},
        {
          params: {
            subscribed_fields: "leadgen",
            access_token: pageAccessToken,
          },
        }
      );
      return res.data.success;
    } catch (error) {
      console.error("Facebook Subscribe Page Error:", error.response?.data || error.message);
      throw new Error("Failed to subscribe Facebook page");
    }
  }

  async fetchLeadDetails(leadId, pageAccessToken) {
    try {
      const res = await axios.get(`${this.baseUrl}/${leadId}`, {
        params: {
          access_token: pageAccessToken,
          fields: "id,created_time,field_data,form_id,campaign_name,adset_name,ad_name",
        },
      });

      const fieldData = res.data.field_data || [];
      const getField = (name) => fieldData.find((f) => f.name === name)?.values[0] || null;

      return {
        leadId: res.data.id,
        createdTime: new Date(res.data.created_time),
        formId: res.data.form_id,
        campaignName: res.data.campaign_name,
        adsetName: res.data.adset_name,
        adName: res.data.ad_name,
        fullName: getField("full_name") || getField("name"),
        email: getField("email"),
        phone: getField("phone_number"),
        rawPayload: res.data,
      };
    } catch (error) {
      console.error("Facebook Fetch Lead Error:", error.response?.data || error.message);
      throw new Error("Failed to fetch Facebook lead details");
    }
  }
}
