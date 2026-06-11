export default class LeadProvider {
  /**
   * Initializes or authenticates the provider connection.
   */
  async authenticate(data) {
    throw new Error("Method 'authenticate()' must be implemented.");
  }

  /**
   * Fetches the lists of pages or accounts the user manages.
   */
  async fetchPages(data) {
    throw new Error("Method 'fetchPages()' must be implemented.");
  }

  /**
   * Subscribes a page or account to webhooks.
   */
  async subscribePage(pageId, pageAccessToken) {
    throw new Error("Method 'subscribePage()' must be implemented.");
  }

  /**
   * Unsubscribes a page or account from webhooks.
   */
  async unsubscribePage(pageId, pageAccessToken) {
    throw new Error("Method 'unsubscribePage()' must be implemented.");
  }

  /**
   * Fetches full lead details from the provider using a lead ID.
   */
  async fetchLeadDetails(leadId, pageAccessToken) {
    throw new Error("Method 'fetchLeadDetails()' must be implemented.");
  }
}
