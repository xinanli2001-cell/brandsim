# 交接文档：BrandSim 剩余功能（给 Codex）

- **日期**：2026-07-18
- **交接方**：Claude（本次会话完成了地基 + 学生账号体系 + 老师端编辑/删除）
- **接手方**：Codex
- **代码状态**：主分支 `main`，最新提交 `e2a079a`，已合并、已验证、可直接在此基础上继续开发

本文档目的：让你不需要重新和用户对齐需求、不需要重新摸索本项目的代码约定，直接开工。

---

## 一、已经做完的部分（不需要你碰，但要理解）

### 1.1 学生账号体系（Requirement 1）
- 学生现在有真实账号（邮箱+密码），和老师共用一套 `Session` 表（一行会话属于老师或学生二选一）
- 统一登录页在 `/`，带角色切换（Student/Teacher）+ 模式切换（登录/注册）
- 学生个人页在 `/student`：加入挑战、查看已加入挑战、退出（软删除，成绩保留）、登出
- 游玩路由从 `/play/brief` 改成了 `/play/[groupId]/brief`（不再依赖 localStorage，刷新页面不丢状态）
- 所有涉及学生数据的接口都做了归属校验（`GET /api/game/[groupId]`、`POST /api/rounds`、`GET /api/leaderboard/[challengeId]` 等）

详细设计和实现记录：`docs/superpowers/plans/2026-07-17-student-account-foundation.md`

### 1.2 老师端挑战编辑/归档/删除（Requirement 2）
- `PUT /api/challenges/[id]`：编辑挑战。**关键规则**——一旦有学生加入（`Group` 记录非空），`totalRounds`/`startingTokens`/`difficulty`/`availableActions`/`leaderboardEnabled` 这五个"结构性"字段服务端强制锁死（不管前端传什么都保留原值），只有 `brandName`/`brandBackground`/`goal`/`targetAudience`/`seasonalContext`/`followerBase` 这些"叙事性"字段可以改。这个锁定逻辑包在 Prisma `$transaction` 里，事务内重新统计学生数，避免"编辑请求发出的瞬间正好有学生加入"这种竞态。
- `PATCH /api/challenges/[id]`：现在同时支持 `{status}` 和 `{archived: boolean}`。归档只是从老师默认列表隐藏，**不冻结挑战本身**——学生仍能正常玩、仍能用加入码加入（这是有意设计，不是 bug）。
- `DELETE /api/challenges/[id]`：永久删除，级联清空该挑战下所有 `Group`/`Round`（schema 里已经设了 `onDelete: Cascade`，删除逻辑本身很简单，不需要手写级联）。
- 老师仪表盘 `/teacher`：Active/Archived 标签切换，每张卡片有 Edit/Archive/Delete 三个按钮。
- 编辑页 `/teacher/[id]/edit`：复用创建挑战的表单布局，预填现有数据，锁定字段在 UI 上体现为置灰+不可点击（不只是视觉禁用，自定义 toggle 的 onClick 里也真的挡住了点击）。

详细设计和实现记录：`docs/superpowers/plans/2026-07-18-teacher-challenge-management.md`

---

## 二、必须遵守的项目约定

这些不是建议，是这个代码库已经统一贯彻的风格，续写时要保持一致：

1. **API 校验用 Zod**，错误响应统一是 `{ error: string }` 加合适的 HTTP 状态码，不要发明新的错误格式。
2. **鉴权模式固定**：
   - `getCurrentTeacher()` / `getCurrentStudent()` / `getCurrentUser()`（在 `lib/auth/session.ts`）—— 永远从服务端 session 拿身份，不信任客户端传的任何 id。
   - 接口里检查顺序固定：先鉴权（401）→ 资源存在性（404）→ 归属权限（403）。
3. **测试约定是 `scripts/test-*.ts` 脚本，不是 vitest。** 虽然 `package.json` 里有 `vitest` 依赖，但项目里一个 vitest 测试都没有——实际做法是写一个独立脚本，用 `npx tsx scripts/xxx.ts` 跑，直接对着 `npm run dev` 起的真实服务器发请求验证。已有的例子：`scripts/test-flow.ts`、`scripts/test-race.ts`、`scripts/test-student-auth.ts`、`scripts/test-teacher-management.ts`。续写新功能时，照着这个模式加新脚本，脚本要用 `Math.random()` 生成的邮箱后缀避免和其他脚本的数据撞车。
4. **前端风格**：Tailwind 工具类，设计 token 命名走 `font-title-md`、`text-on-surface-variant`、`bg-primary`、`bg-white rounded-2xl border border-[#E2E8F0] ambient-shadow` 这一套，照抄现有页面（`app/teacher/page.tsx`、`app/teacher/[id]/edit/page.tsx`）里的 class 组合，不要引入新的设计语言。
5. **Schema 改动**：如果要加字段，直接改 `prisma/schema.prisma`，跑 `npx prisma migrate dev --name xxx`。**不需要**再迁移一次学生账号相关表——`Student`、`Group.studentId`、`Group.leftAt`、`Challenge.archivedAt` 都已经在库里了。

---

## 三、已知环境坑（省得你重新踩一遍）

1. **`npm run lint` 会扫描进无关的嵌套 worktree 目录，冒出几千条不相关报错。** 这是 `eslint.config.mjs` 缺了 `.claude/worktrees/**` 忽略规则的预先存在问题，我已经用 `spawn_task` 单独开了一个任务（task_id: `task_8f68c8d2`）交给用户决定要不要修，你不用管，但**跑 lint 时用 `npx eslint app lib components scripts prisma`（限定目录）而不是裸的 `npm run lint`**，不然报错列表没法看。
2. **`prisma/seed.ts` 是幂等但不完全的**：它先检查 `joinCode: "GREEN1"` 的挑战是否存在，存在就直接 `return`，导致种子老师/学生账号如果之前没建过也不会被补建。如果本地库里缺种子学生账号（`student@example.com`/`password123`），需要手动跑一次性脚本插入（参考我在合并 main 时用过的临时脚本模式：新建 `scripts/tmp-xxx.ts`，跑完立刻删除，不要提交到仓库）。
3. **仓库里有个完全无关的 worktree `.claude/worktrees/foundation-user-auth-postgres`**（搜索/eval/社交动态相关的另一套实验代码），跟本项目的老师/学生课堂系统没有关系，**不要碰它**。
4. 迁移历史之前有个坏文件（`20260703133640_teacher_auth`）导致全新数据库无法迁移，**已经修好了**，不会再出现，提一下只是让你知道如果偶然发现 git log 里有个"修复迁移历史"的提交是干什么的。

---

## 四、剩余任务（设计文档 Requirement 3/4/5/6）

**完整设计文档**（所有决策的最终来源）：`docs/superpowers/specs/2026-07-17-brandsim-features-plan.md`——这份文档写在最开始，覆盖全部 6 个需求，请通读一遍。下面是这份文档里**还没实现**的部分，以及和用户对齐过程中额外锁定的界面细节（原文档没写这么细）。

### 4.1 老师端学生管理 + 代币统计 + 数据汇总（Requirement 4/5）

三个入口都在 `app/teacher/TeacherShell.tsx` 的侧边栏导航里，现在还是灰的（`enabled: false`）：

```ts
{ href: "#", icon: "group", label: "Student Progress", enabled: false },
{ href: "#", icon: "database", label: "Token Economy", enabled: false },
{ href: "#", icon: "description", label: "Reports", enabled: false },
```

**已确认的界面归属决策**（不要重新问用户，这些已经定了）：
- **Student Progress**：独立全局页面（如 `/teacher/students`）。页面逻辑是"先选择挑战，再看该挑战的学生名单"——不是嵌在 monitor 页里。
- **Token Economy**：全局页面，跨该老师所有挑战汇总代币消耗（不是按单个挑战拆开看）。
- **Reports**：全局页面，跨该老师所有挑战汇总表现数据（同上，全局不按挑战拆分）。

**学生名单页的数据口径**（这是我在设计阶段自己推导出的，供参考，实现时可以直接用）：
- 谁参加了：某挑战下 `Group.studentId != null` 的记录，关联 `Student.displayName`/`email`。
- "谁发帖谁没发"：不要用"本轮是否已交"这个框架去做（我推导过，这个字段在当前数据模型下几乎恒等于 `status === "finished"`，没有实际区分度）。改用清晰的三态：
  - 未开始：`rounds.length === 0`
  - 进行中：`0 < rounds.length < totalRounds` 且 `status !== "finished"`
  - 已完成：`status === "finished"`
- 总进度显示成"已发 X / 共 Y 轮"（X = `rounds.length`，Y = `challenge.totalRounds`）。
- 新增接口建议：`GET /api/challenges/[id]/students`，返回该挑战下所有未软退出学生的名单+进度。

**Token Economy 的统计口径建议**：按投放动作类型（boost/ad/audience/influencer，即 `Round.actions` JSON 里的字段）聚合消耗量，可以按挑战拆一个明细表，也可以只给总量——这部分设计文档没细定，你可以自己合理设计，但要覆盖"这个老师一共花了多少代币""哪种动作用得最多"这两个基本问题。

**Reports 的统计口径建议**：跨挑战的平均互动、平均触达、完成率、每个挑战一行的汇总表。同样没有细定，合理设计即可。

**架构提醒（来自老师端编辑功能的最终审查建议，供参考）**：老师端编辑功能里，"哪些字段锁定"这个规则目前在服务端（`app/api/challenges/[id]/route.ts`）和前端编辑页（`app/teacher/[id]/edit/page.tsx`）各写了一份——一份是允许列表、一份是禁止列表，两处如果以后要改都得同步改。如果学生管理这块也需要类似的"分权限展示字段"逻辑，建议先抽一个共享的字段清单常量放在 `lib/` 里，两边一起用，不要重复这个模式。这不是强制要求，是最终代码审查时留的一条建议。

### 4.2 学生端预填上一轮内容 + 历史查看（Requirement 3）

**已确认的决策**：
- 下一轮进入 compose 页时，**只预填帖子内容本身**（正文/话题标签/配图风格/发布时间），**不预填投放动作**（boost/广告/受众定向/达人合作——这些每轮都要学生重新选，避免学生没注意到又花了一遍代币）。
- 需要一个"历史轮次查看"功能，让学生能翻看自己之前每一轮发布过的内容。

**实现要点**：这块**纯前端改动，不需要动数据库和 API**——`GameState.history`（`GET /api/game/[groupId]` 已经返回）里已经完整包含每一轮的 `post`（帖子内容）和 `actions`（投放动作）和 `result`（评估结果），数据都在，只是现在没在界面上暴露出来。
- `app/play/[groupId]/compose/page.tsx`：进入页面时如果 `gameState.history` 非空，取最后一条的 `post` 字段回填表单状态（`text`/`hashtags`/`imageStyle`/`scheduledDay`/`scheduledHour`），投放动作相关的 state 保持默认值，不回填。
- 新增一个历史查看入口（新页面或者弹窗都可以，设计文档没有细定这块 UI 形式，自行决定），展示 `gameState.history` 里每一轮的 `post` + `result`。

### 4.3 AI 打分 prompt 优化（Requirement 6）

**已确认的决策**：
- 多维度打分（受众契合、文案质量、CTA、话题策略、发布时机、品牌调性、季节契合、创意度等）只用于让模型**内部推理更有逻辑**，最终仍然只输出一个 `qualityCoefficient`（0.7-1.3）+ 文字反馈——**UI 完全不变**，不要在界面上暴露维度小分。
- 保持 OpenAI 供应商不变（不要换成别的 LLM 服务商）。
- 相关文件：`lib/engine/llm.ts`（`judgeWithLlm` 函数是真实调用逻辑，`stubJudgement` 函数是无 API key 时的确定性兜底——**两边都要同步升级**，兜底桩不能落后于真实 prompt 的逻辑复杂度，否则本地开发和演示环境的评分质量会和线上不一致）。
- 建议：给模型的上下文里补全难度（`difficulty`）、投放动作汇总、发布时机、上一轮表现——现在的 prompt 已经带了这些，可以在此基础上把"逐维度打分再汇总"的推理步骤写进 system prompt，而不是让模型直接吐一个数。
- 环境变量层面可以顺带建议用户把 `OPENAI_MODEL` 从默认的 `gpt-4o-mini` 换成 `gpt-4o`（复杂度上去了效果会更好），但这只是建议，不需要在代码里改默认值。

---

## 五、建议的实施顺序

参考设计文档原本的分期，剩余部分建议：

1. **老师端学生管理 + Token Economy + Reports**（4.1）——三个页面逻辑上关联度高（都是老师端全局统计类页面），可以放一起做。
2. **学生端预填 + 历史查看**（4.2）——纯前端，独立，随时可以插入。
3. **AI prompt 优化**（4.3）——独立，不依赖前两项，也可以提前做。

每一块建议照着已完成部分的模式：先理解现有代码 → 和用户过一遍界面/数据口径的开放问题（如果有）→ 写清楚的实现计划 → 分步实现 → 每一步都用 `scripts/test-*.ts` 脚本验证 → 跑一遍全部已有回归脚本确认没有破坏之前的功能。

---

## 六、快速自查清单（开工前）

- [ ] 读一遍 `docs/superpowers/specs/2026-07-17-brandsim-features-plan.md`（完整需求）
- [ ] 扫一眼 `docs/superpowers/plans/2026-07-17-student-account-foundation.md` 和 `docs/superpowers/plans/2026-07-18-teacher-challenge-management.md`（代码风格和实现模式的具体范例）
- [ ] 确认本地 `npm run dev` 能跑起来，`npx tsx scripts/test-flow.ts` 等现有脚本都能跑通（证明环境是好的）
- [ ] 确认种子账号存在：`teacher@example.com`/`password123`、`student@example.com`/`password123`（如果学生账号缺失，参考第三节第 2 条的临时脚本方法补建）
