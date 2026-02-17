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
  completed: boolean;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

export interface AuthResponse {
  message: string;
  token_type: string;
  user?: User; // Optional user object if backend returns it
}

export interface ApiError {
  detail: string | { loc: string[]; msg: string; type: string }[];
}
