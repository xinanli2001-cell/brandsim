# 交接文档：BrandSim（Requirement 1–6 全部完成，待提交）

- **日期**：2026-07-18
- **代码状态**：主分支 `main`，最新**提交**是 `d09cbcd`；但**工作区里有一整套未提交的改动**，把上一版交接文档里"剩余任务"章节的 Requirement 3/4/5/6 全部实现完了。**不需要重新设计或重新问用户需求**，下一步就是 review + 验证 + 提交。

本文档取代上一版（`d09cbcd` 提交的内容），因为那版列的"剩余任务"现在都做完了。

---

## 一、当前工作区里有什么（还没 commit）

```
 M app/play/[groupId]/compose/page.tsx
 M app/teacher/TeacherShell.tsx
 M components/BottomNav.tsx
 M lib/engine/evaluate.ts
 M lib/engine/llm.ts
 M package-lock.json
 M package.json
?? app/api/challenges/[id]/students/
?? app/api/teacher/                      (token-economy + reports 接口)
?? app/play/[groupId]/history/
?? app/teacher/reports/
?? app/teacher/students/
?? app/teacher/token-economy/
?? lib/play/                             (compose-history.ts)
?? lib/teacher/                          (insights.ts)
?? scripts/test-llm-rubric.ts
?? scripts/test-student-compose-history.ts
?? scripts/test-teacher-insights.ts
```

**这些改动实现的正是上一版文档第四节列的三块剩余任务**：

### 1.1 老师端学生管理 + 代币经济 + 报表（原 Requirement 4/5）
- `/teacher/students`：先选挑战、再看该挑战学生名单，进度分三态（未开始/进行中/已完成），接口 `GET /api/challenges/[id]/students`。
- `/teacher/token-economy`：跨该老师所有挑战汇总代币消耗，按动作类型（boost/ad/audience/influencer）拆分，接口在 `app/api/teacher/`。
- `/teacher/reports`：跨挑战汇总互动/触达/完成率，每挑战一行。
- `TeacherShell.tsx` 侧边栏三个入口从 `enabled: false` 改成了真实链接，且高亮逻辑支持子路径（`pathname.startsWith(item.href + "/")`）。
- 统计口径实现在 `lib/teacher/insights.ts`，测试脚本 `scripts/test-teacher-insights.ts`。

### 1.2 学生端预填上一轮内容 + 历史查看（原 Requirement 3）
- `lib/play/compose-history.ts` 的 `getInitialComposeDraft()`：只回填帖子内容本身（文本/话题标签/配图风格/发布时间），投放动作（boost/ad/audience/influencer）每轮强制重置为默认值——这是刻意设计，不是漏做。
- `/play/[groupId]/history`：历史轮次查看页，`toHistoryItems()` 把每轮的 post+actions+result 摊平成列表。
- compose 页和底部导航都加了到 history 页的入口。
- 测试脚本 `scripts/test-student-compose-history.ts`。

### 1.3 AI 打分 prompt 优化（原 Requirement 6）
- `lib/engine/llm.ts`：`stubJudgement`（无 key 兜底）和 `judgeWithLlm`（真实调用）**同步升级**，都引入了受众契合/CTA/时机/品牌季节契合/投放动作聚焦等多维推理，但**输出契约不变**——仍然只吐一个 `qualityCoefficient`（0.7–1.3）+ 文字反馈，UI 没有暴露任何维度小分。
- `judgeWithLlm` 现在多传了 `actions` 和 `previousResult` 两个参数用于生成更有依据的反馈（调用点在 `lib/engine/evaluate.ts`）。
- 供应商仍是 OpenAI，没有换。
- 测试脚本 `scripts/test-llm-rubric.ts`（纯单测，不需要起服务器，直接测 `stubJudgement`）。

---

## 二、验证状态（我已经跑过，全部通过）

```
npx tsc --noEmit -p tsconfig.json          # 无输出，类型检查干净
npx tsx scripts/test-llm-rubric.ts         # ✅ PASS（新增）
npx tsx scripts/test-teacher-insights.ts   # ✅ PASS（新增）
npx tsx scripts/test-student-compose-history.ts  # ✅ PASS（新增）
npx tsx scripts/test-teacher-management.ts # ✅ PASS（回归，确认没破坏老功能）
npx tsx scripts/test-student-auth.ts       # ✅ PASS（回归）
npx tsx scripts/test-flow.ts               # ✅ PASS（回归）
npx tsx scripts/test-race.ts               # ✅ PASS（回归）
npx tsx scripts/test-engine.ts             # ✅ PASS（回归）
```

跑测试脚本前需要 `npm run dev` 起着服务器（本机 3000 端口当时已经有一个在跑）。

**⚠️ 一个需要你去核实的疑点**：`package.json`/`package-lock.json` 的未提交改动里新增了 `vitest` 依赖和 `"test": "vitest run"` 脚本，但项目里（排除两个无关的 worktree）**没有任何 `*.test.ts` 文件**，跟项目里"测试用 `scripts/test-*.ts` 脚本、不用 vitest"的既定约定矛盾。我没找到这个改动是谁加的、为什么加（怀疑是合并 `merge-onto-new-demo` worktree 时带过来的残留，那个 worktree 里确实有 vitest 测试）。**建议先问一下用户这个改动是否有意为之，没用的话就从 `package.json`/`package-lock.json` 里去掉**，不要直接默认删除。

---

## 三、下一步建议

1. `git diff` 过一遍上面列的改动，确认没有你不认可的地方。
2. 核实第二节末尾提到的 vitest 疑点。
3. `git add` + commit（提交信息按文件/功能拆成几个小提交，照这个仓库一贯的粒度习惯，不要一个大 commit 全塞进去）。
4. 提交后建议再完整跑一遍上面第二节的 8 个脚本做最终回归确认。

---

## 四、必须遵守的项目约定（不变，照抄自上一版）

1. **API 校验用 Zod**，错误响应统一是 `{ error: string }` 加合适的 HTTP 状态码。
2. **鉴权模式固定**：`getCurrentTeacher()` / `getCurrentStudent()` / `getCurrentUser()`（`lib/auth/session.ts`）——永远从服务端 session 拿身份。接口里检查顺序固定：鉴权（401）→ 资源存在性（404）→ 归属权限（403）。
3. **测试约定是 `scripts/test-*.ts` 脚本，不是 vitest**（正因如此，第二节的 vitest 疑点需要处理）。新脚本用 `Math.random()` 生成邮箱后缀避免和其他脚本数据撞车。
4. **前端风格**：Tailwind 工具类，设计 token 命名走 `font-title-md`、`text-on-surface-variant`、`bg-primary`、`bg-white rounded-2xl border border-[#E2E8F0] ambient-shadow` 这一套，照抄现有页面，不引入新设计语言。
5. **Schema 改动**：直接改 `prisma/schema.prisma`，跑 `npx prisma migrate dev --name xxx`。

---

## 五、已知环境坑

1. **`npm run lint` 会扫描进无关的嵌套 worktree 目录，冒出几千条不相关报错**（`eslint.config.mjs` 缺 `.claude/worktrees/**` 忽略规则）。跑 lint 用 `npx eslint app lib components scripts prisma`（限定目录）。
2. **`prisma/seed.ts` 是幂等但不完全的**：已存在 `joinCode: "GREEN1"` 的挑战就直接 return，本地缺种子学生账号（`student@example.com`/`password123`）时需要手动补建。
3. **仓库里有两个跟本项目完全无关的 worktree，都不要碰**：
   - `.claude/worktrees/foundation-user-auth-postgres`
   - `.claude/worktrees/merge-onto-new-demo`（比上一版文档写的时候多了这一个，是"foundation + content plaza + search/eval 平台"的合并实验分支，同样跟老师/学生课堂系统无关）
4. 迁移历史的坏文件问题（`20260703133640_teacher_auth`）已经修好，不会再出现。

---

## 六、快速自查清单（开工前）

- [ ] 读一遍 `docs/superpowers/specs/2026-07-17-brandsim-features-plan.md`（完整需求，最终决策来源）
- [ ] `git diff` 看一遍第一节列的未提交改动
- [ ] 处理第二节末尾的 vitest 疑点
- [ ] 确认种子账号存在：`teacher@example.com`/`password123`、`student@example.com`/`password123`
- [ ] 提交前再跑一遍第二节列的全部回归脚本
