export interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'analyst' | 'viewer';
    avatar?: string;
  }
  
  export interface JWTPayload {
    sub: string;
    email: string;
    role: string;
    exp: number;
  }
  
  export interface LoginRequest {
    email: string;
    password: string;
  }
  
  export interface LoginResponse {
    access_token: string;
    token_type: string;
    user: User;
  }
  
  export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
  }