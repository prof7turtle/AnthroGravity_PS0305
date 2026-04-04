/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { jwtDecode, type JwtPayload } from 'jwt-decode';

interface User {
  id: string;
  email: string;
  role: 'user' | 'merchant';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isMerchant: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type DecodedToken = JwtPayload & {
  exp?: number;
};

const readStoredAuth = (): { token: string | null; user: User | null } => {
  const savedToken = localStorage.getItem('algoescrow_token');
  const savedUser = localStorage.getItem('algoescrow_user');

  if (!savedToken || !savedUser) {
    return { token: null, user: null };
  }

  try {
    const decoded = jwtDecode<DecodedToken>(savedToken);
    if (!decoded.exp || decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem('algoescrow_token');
      localStorage.removeItem('algoescrow_user');
      return { token: null, user: null };
    }

    const parsedUser = JSON.parse(savedUser) as User;
    return { token: savedToken, user: parsedUser };
  } catch {
    localStorage.removeItem('algoescrow_token');
    localStorage.removeItem('algoescrow_user');
    return { token: null, user: null };
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => readStoredAuth().token);
  const [user, setUser] = useState<User | null>(() => readStoredAuth().user);

  const clearAuth = () => {
    localStorage.removeItem('algoescrow_token');
    localStorage.removeItem('algoescrow_user');
    setToken(null);
    setUser(null);
  };

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('algoescrow_token', newToken);
    localStorage.setItem('algoescrow_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    clearAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token,
        isMerchant: user?.role === 'merchant',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
