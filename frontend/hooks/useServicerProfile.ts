"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export function useServicerProfile(initialProfile: any) {
  const [profile, setProfile] = useState(initialProfile);
  const [isLoading, setIsLoading] = useState(false);

  const updateStatus = useCallback(async (newStatus: string) => {
    setIsLoading(true);
    try {
      await apiFetch("/services/providers/availability", {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setProfile((prev: any) => ({ ...prev, availability_status: newStatus }));
      return true;
    } catch (err) {
      console.error("Failed to update status", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (data: any) => {
    setIsLoading(true);
    try {
      const updated = await apiFetch("/services/providers/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      setProfile(updated);
      return { success: true, data: updated };
    } catch (err) {
      console.error("Failed to update profile", err);
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestVerification = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await apiFetch("/services/providers/verify", {
        method: "POST",
      });
      if (result.verified) {
        setProfile((prev: any) => ({ ...prev, is_verified: true }));
      }
      return result;
    } catch (err) {
      console.error("Verification request failed", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    profile,
    setProfile,
    isLoading,
    updateStatus,
    updateProfile,
    requestVerification,
  };
}
