"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCurrentStudent, getMe, logoutUser } from "@/lib/api";
import { StudentDetail, User } from "@/types/student";

interface AuthContextType {
  user: User | null;
  student: StudentDetail | null;
  loading: boolean;
  initials: string;
  displayName: string;
  displayEmail: string;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true);
      const [userData, studentData] = await Promise.allSettled([getMe(), getCurrentStudent()]);

      if (userData.status === "fulfilled") {
        setUser(userData.value);
      } else {
        setUser(null);
      }

      if (studentData.status === "fulfilled") {
        setStudent(studentData.value);
      } else {
        setStudent(null);
      }
    } catch {
      setUser(null);
      setStudent(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUserData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchUserData]);

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      // Ignored
    } finally {
      setUser(null);
      setStudent(null);
      router.push("/login");
    }
  };

  // Derive display name, email, and initials
  const displayName = student?.name || user?.student_name || "Student Scholar";
  const displayEmail = student?.email || user?.email || "";

  const initials = (() => {
    if (!displayName || displayName === "Student Scholar") return "SC";
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  })();

  return (
    <AuthContext.Provider
      value={{
        user,
        student,
        loading,
        initials,
        displayName,
        displayEmail,
        refreshUser: fetchUserData,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
