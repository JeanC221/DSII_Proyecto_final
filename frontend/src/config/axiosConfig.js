import axios from 'axios';

const api = axios.create({
  baseURL: 'http://backend:5000/api',
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
  console.error('Response Error:', error.message);
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Data:', error.response.data);
  }
  return Promise.reject(error);
});

export default api;