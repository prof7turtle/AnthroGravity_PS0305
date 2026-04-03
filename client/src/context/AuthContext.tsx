import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Check localStorage for token on mount
    const savedToken = localStorage.getItem('algoescrow_token');
    const savedUser = localStorage.getItem('algoescrow_user');
    
    if (savedToken && savedUser) {
      try {
        const decoded: any = jwtDecode(savedToken);
        // Check if token expired
        if (decoded.exp * 1000 < Date.now()) {
          logout();
        } else {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch (err) {
        logout();
      }
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('algoescrow_token', newToken);
    localStorage.setItem('algoescrow_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('algoescrow_token');
    localStorage.removeItem('algoescrow_user');
    setToken(null);
    setUser(null);
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
