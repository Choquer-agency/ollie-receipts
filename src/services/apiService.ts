import axios from 'axios';

// Use relative URL in production (same server), absolute in development
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to all requests
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

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
};

export default api;

