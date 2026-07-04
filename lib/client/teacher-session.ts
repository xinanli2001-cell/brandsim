// 教师端同样不做真实账号体系：本地生成一个 teacherId，用来区分"我建的挑战"。

const KEY = "brandsim.teacherId";

export function getOrCreateTeacherId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = "t_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(KEY, id);
  }
  return id;
}
