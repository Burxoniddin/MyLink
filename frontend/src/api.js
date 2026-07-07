import axios from 'axios';

// Auto-detect API URL based on environment:
//   localhost        → local dev backend
//   dev.mylink.asia  → staging backend (client testing; NEVER the prod API)
//   anything else    → production backend
const HOST = window.location.hostname;
const API_BASE_URL =
    HOST === 'localhost' || HOST === '127.0.0.1'
        ? 'http://127.0.0.1:8000/api/'
        : HOST === 'dev.mylink.asia'
            ? 'https://api-dev.mylink.asia/api/'
            : 'https://api.mylink.asia/api/';

const api = axios.create({
    baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Token ${token}`;
    }
    return config;
});

export default api;
