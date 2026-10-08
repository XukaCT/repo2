import {apiClient} from '../api/client';

export function useAuth() {
  // Frappe manages the session via HTTP-only cookies, so we just provide a placeholder user object here 
  // for the React UI to consume (until we link it to Frappe's user API endpoint).
  const user = { 
    name: 'Administrator', 
    email: 'admin@example.com', 
    role: 'System Manager', 
    id: 'Administrator', 
    avatar: '' 
  };

  const logout = async () => {
    try {
      // Calls Frappe's native logout endpoint
      await apiClient.post('logout'); 
      window.location.href = '/login'; // Redirects to Frappe's native login page
    } catch (err) {
      console.warn('Logout failed', err);
    }
  };

  // ADD THIS: A temporary placeholder until we wire up Frappe's user update API
  const updateUser = (updatedData: any) => {
    console.log("User update requested:", updatedData);
  };

  // ADD updateUser to the return statement
  return { user, isAuthenticated: true, logout, updateUser };
}