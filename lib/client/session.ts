// 学生端会话:不做账号体系,加入后把 groupId 存本地,像 Kahoot 一样"进了就是进了"。

const KEY = "brandsim.session";

export interface ClientSession {
  groupId: string;
  challengeId: string;
  groupName: string;
}

export function saveSession(session: ClientSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadSession(): ClientSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClientSession;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
