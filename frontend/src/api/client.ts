import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/', 
  withCredentials: true, 
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
});