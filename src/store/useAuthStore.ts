import { create } from "zustand";
import type { SystemUser } from "@/types";
import { loadLS, saveLS } from "@/utils/storage";
import { mockUsers } from "@/utils/mock/data";

interface AuthState {
  users: SystemUser[];
  currentUserId: string;
  setCurrentUser: (id: string) => void;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  users: [],
  currentUserId: "u_keeper",
  setCurrentUser: (id) => {
    set({ currentUserId: id });
    saveLS("currentUser", id);
  },
  init: () => {
    if (get().users.length > 0) return;
    const users = loadLS<SystemUser[]>("users", []);
    const currentUser = loadLS<string>("currentUser", "u_keeper");
    set({ users: users.length ? users : mockUsers, currentUserId: currentUser });
    if (users.length === 0) saveLS("users", mockUsers);
  },
}));

export const useCurrentUser = () => {
  const { users, currentUserId } = useAuthStore();
  return users.find((u) => u.id === currentUserId);
};
