import axios from 'axios';

// Use relative URL in production (same server), absolute in development
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Store token refresh callback
let tokenRefreshCallback: (() => Promise<string | null>) | null = null;

export const setTokenRefreshCallback = (callback: () => Promise<string | null>) => {
  tokenRefreshCallback = callback;
};

// Add auth token to all requests
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Add response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If we get a 401 and haven't retried yet, try to refresh the token
    if (error.response?.status === 401 && !originalRequest._retry && tokenRefreshCallback) {
      originalRequest._retry = true;
      
      try {
        const newToken = await tokenRefreshCallback();
        if (newToken) {
          setAuthToken(newToken);
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Receipt endpoints
export const receiptApi = {
  getAll: async (status?: string) => {
    try {
      const params = status ? { status } : {};
      const response = await api.get('/api/receipts', { params });
      // Ensure we always return an array
      if (!Array.isArray(response.data)) {
        console.error('API returned non-array data for getAll:', response.data);
        return [];
      }
      return response.data;
    } catch (error) {
      console.error('receiptApi.getAll error:', error);
      return []; // Return empty array on error
    }
  },

  getById: async (id: string) => {
    const response = await api.get(`/api/receipts/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/api/receipts', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/api/receipts/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/api/receipts/${id}`);
    return response.data;
  },

  getUploadUrl: async (fileName: string, fileType: string) => {
    const response = await api.get('/api/receipts/upload/url', {
      params: { fileName, fileType },
    });
    return response.data;
  },

  checkDuplicates: async (files: Array<{
    filename: string;
    transactionDetails?: {
      vendorName?: string;
      transactionDate?: string;
      subtotal?: number;
      tax?: number;
      total?: number;
    };
  }>) => {
    const response = await api.post('/api/receipts/check-duplicates', { files });
    return response.data;
  },
};

// Category cache endpoints
export const categoryApi = {
  getAll: async () => {
    try {
      const response = await api.get('/api/categories');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('categoryApi.getAll error:', error);
      return [];
    }
  },

  sync: async (): Promise<{ success: boolean; synced: number; added: number; deactivated: number }> => {
    const response = await api.post('/api/categories/sync');
    return response.data;
  },
};

// Category rules endpoints
export const categoryRulesApi = {
  getAll: async () => {
    try {
      const response = await api.get('/api/category-rules');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('categoryRulesApi.getAll error:', error);
      return [];
    }
  },

  create: async (data: { vendorPattern: string; qbCategoryId: string; matchType?: string; receiptId?: string }) => {
    const response = await api.post('/api/category-rules', data);
    return response.data;
  },

  update: async (id: string, data: { qbCategoryId?: string; matchType?: string; isActive?: boolean; vendorPattern?: string }) => {
    const response = await api.patch(`/api/category-rules/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/api/category-rules/${id}`);
    return response.data;
  },

  match: async (vendorName: string) => {
    try {
      const response = await api.post('/api/category-rules/match', { vendorName });
      return response.data.match || null;
    } catch (error) {
      console.error('categoryRulesApi.match error:', error);
      return null;
    }
  },
};

// Organization endpoints
export const orgApi = {
  getInfo: async () => {
    const response = await api.get('/api/org/info');
    return response.data;
  },

  getMembers: async () => {
    const response = await api.get('/api/org/members');
    return response.data;
  },

  getAuditLog: async (params?: { page?: number; limit?: number; action?: string }) => {
    const response = await api.get('/api/org/audit-log', { params });
    return response.data;
  },
};

export default api;

