import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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
    const params = status ? { status } : {};
    const response = await api.get('/api/receipts', { params });
    return response.data;
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

