// 加入挑战时，学生昵称若与本挑战内已有队伍重名，自动加数字后缀去重。

import { prisma } from "@/lib/db";

export async function uniqueGroupName(challengeId: string, base: string): Promise<string> {
  let candidate = base;
  let suffix = 2;
  while (
    await prisma.group.findUnique({
      where: { challengeId_groupName: { challengeId, groupName: candidate } },
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix++;
  }
  return candidate;
}
