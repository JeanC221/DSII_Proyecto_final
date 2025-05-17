import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

api.interceptors.request.use(request => {
  console.log('Request:', request.method, request.baseURL + request.url);
  return request;
}, error => {
  console.error('Request Error:', error);
  return Promise.reject(error);
});

api.interceptors.response.use(response => {
  console.log('Response Status:', response.status);
  return response;
}, error => {
  if (error.response) {
    console.error('Response Error:', error.response.status, error.response.data);
  } else if (error.request) {
    console.error('No response received:', error.request);
  } else {
    console.error('Request Error:', error.message);
  }
  return Promise.reject(error);
});

export default api;