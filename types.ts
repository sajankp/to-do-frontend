export interface User {
  id?: number;
  username: string;
  email?: string;
}

export interface Todo {
  id: string;
  title: string;
  description: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface ApiError {
  detail: string | { loc: string[]; msg: string; type: string }[];
}
