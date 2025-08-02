const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      console.log('🌐 API Request:', url, options.method || 'GET');
      
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        console.log('✅ API Response:', result);
        return result;
      }
      
      return await response.text();
    } catch (error) {
      console.error('❌ API request failed:', error);
      throw error;
    }
  }

  // Ticket endpoints - FIXED: Remove duplicate /api
  async createTicket(ticketData) {
    return this.request('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
  }

  async getTicket(ticketId) {
    return this.request(`/api/tickets/${ticketId}`);
  }

  async getUserTickets(userId) {
    return this.request(`/api/tickets/user/${userId}`);
  }

  async checkInTicket(ticketId) {
    return this.request(`/api/tickets/${ticketId}/checkin`, {
      method: 'PATCH',
      body: JSON.stringify({ ticketId }),
    });
  }

  // Health check - for testing connection
  async healthCheck() {
    return this.request('/health');
  }

  // User endpoints
  async getUserProfile() {
    return this.request('/api/users/profile');
  }

  async updateUserProfile(profileData) {
    return this.request('/api/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
  }

  // Admin endpoints
  async getAllTickets() {
    return this.request('/api/admin/tickets');
  }

  async getAnalytics() {
    return this.request('/api/admin/analytics');
  }

  async exportTickets() {
    return this.request('/api/admin/export/tickets');
  }
}

export const api = new ApiClient();
export default api;