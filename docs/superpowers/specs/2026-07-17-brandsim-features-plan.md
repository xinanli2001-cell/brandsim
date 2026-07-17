# BrandSim 功能改造计划

- **日期**：2026-07-17
- **项目**：`brandsim`（Next.js 16 + Prisma + SQLite）
- **状态**：设计已确认，待写实施计划 / 开工

本文件汇总本轮 7 块需求的改造方案与决策，作为后续实施依据。

---

## 一、需求与关键决策一览

| # | 需求 | 关键决策 |
|---|------|----------|
| 1 | 学生账号体系 + 统一登录 + 个人页加入码 + 自主退出 + 登出 | 学生**自己注册**；**邮箱+密码**；登录页**选角色**；退出**保留成绩仅移出列表** |
| 2 | 老师端编辑 / 删除挑战 | 有对局时**只能改文本字段**；删除**归档 + 永久删除都做** |
| 3 | 学生端预填上一轮内容 + 可改 + 看历史 | 预填**只填帖子内容**（不填投放动作）；纯前端 |
| 4 | 老师端学生管理：谁参加、谁发帖谁没发 | “没发”**总进度 + 本轮是否已交都显示** |
| 5 | 激活老师端灰按钮 | Student Progress=需求4；Token Economy=**代币消耗统计**；Reports=**全班数据汇总** |
| 6 | AI 打分 prompt 更完善、多维、有逻辑 | 多维小分**完全内部**，UI 不变；保持 OpenAI 供应商 |

---

## 二、地基改造（所有功能的前置）

### 2.1 数据模型（`prisma/schema.prisma`）

```prisma
model Student {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  displayName  String
  createdAt    DateTime @default(now())

  sessions Session[]
  groups   Group[]
}

model Session {
  // teacherId 改为可空，新增可空 studentId；一行会话属于老师或学生其一
  teacherId String?
  teacher   Teacher? @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  studentId String?
  student   Student? @relation(fields: [studentId], references: [id], onDelete: Cascade)
  // ...其余字段不变
}

model Challenge {
  // 新增
  archivedAt DateTime?
  // groups 关系补 onDelete: Cascade（见 Group）
}

model Group {
  // 新增
  studentId String?
  student   Student?  @relation(fields: [studentId], references: [id])
  leftAt    DateTime?
  // challenge 关系补 onDelete: Cascade
  challenge Challenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  // rounds 关系补 onDelete: Cascade（见 Round）
}

model Round {
  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
}
```

- 迁移命令：`npm run db:migrate`（开发）/ `db:deploy`（部署）。
- `onDelete: Cascade` 用于需求2 的永久删除。

### 2.2 认证层（`lib/auth/session.ts`）

- `createSession(opts: { teacherId?: string; studentId?: string })`。
- 保留 `getCurrentTeacher()`；新增 `getCurrentStudent()`、`getCurrentUser()`（返回 `{ role: "teacher"|"student", teacher?|student? }`）。
- 学生**弃用 localStorage**（废弃 `lib/client/session.ts` 那套），改 httpOnly cookie 真会话，与老师同机制。

### 2.3 认证 API

- 新增 `POST /api/auth/student/signup`（邮箱唯一校验 + bcrypt 存 hash + displayName）。
- 登录接口（现 `/api/auth/login`）扩展：请求带 `role` 字段决定查 Teacher 还是 Student 表。
- `/api/auth/me` 扩展：返回当前用户及其角色。
- `/api/auth/logout` 复用（删 session 行 + 清 cookie）。

---

## 三、各需求实施方案

### 需求 1 · 统一登录 + 学生个人页

**页面**
- `app/page.tsx` → 统一登录页：顶部 **老师 / 学生** 切换标签 + 邮箱/密码表单 + “去注册”。
- 注册页（新增或复用）：同样带角色切换；学生注册收 邮箱 + 密码 + 昵称(displayName)。
- 登录成功跳转：老师 → `/teacher`，学生 → `/student`。
- 删除旧 `/join` 页。

**`app/student/page.tsx`（新增）**
- 顶部：学生名 + **登出按钮**。
- **加入挑战**：输入码 → 调用（改造后的）`/api/join`；`groupName` 取 `displayName`，**重名自动加后缀**（`Alice` → `Alice-2`），并绑定 `studentId`。
- **挑战列表**：列出该学生 `leftAt == null` 的 Group 卡片 → 点进去 `/play/...` 继续。
- 每张卡 **“退出挑战”**：写 `leftAt = now()`，**不删数据**，仅从列表移除。

**改造**
- `/api/join`：需登录学生身份；写入 `studentId`；重名后缀逻辑。
- `GameProvider.tsx`：不再读 localStorage，改为从服务端会话取身份；进入对局前校验该 group 属于当前登录学生。
- 新增 `GET /api/student/challenges`：返回当前学生未退出的挑战 + 进度。

**登出按钮**：老师端（已存在于 TeacherShell）保留；学生端个人页新增。

---

### 需求 2 · 老师端 编辑 / 删除挑战

**编辑**
- 复用 `/teacher/new` 表单做**编辑模式**（如 `/teacher/[id]/edit`，预填现有数据）。
- **有对局（groups 存在）时仅文本字段可改**：`brandName / brandBackground / goal / targetAudience / seasonalContext`。
- **锁死**：`totalRounds / startingTokens / difficulty / availableActions / leaderboardEnabled`（无对局时才可改）。
- 新增 `PUT /api/challenges/[id]`：服务端强制上述锁（即便前端被绕过也拒绝）。

**删除（两个操作都做）**
- **归档**：写 `archivedAt = now()`，从老师列表隐藏、可恢复。经 `PATCH /api/challenges/[id]`（新增 action）或专用端点。
- **永久删除**：`DELETE /api/challenges/[id]`，级联删 Group + Round，**二次确认弹窗**。

**按钮**：仪表盘卡片 / 监控页挂上 编辑 · 归档 · 删除。仪表盘查询默认过滤 `archivedAt == null`。

---

### 需求 3 · 学生端 预填上一轮 + 历史

- **compose 预填**（`app/play/compose/page.tsx`）：若 `gameState.history` 非空，用最后一条**只预填帖子内容**（`text / hashtags / imageStyle / scheduledDay / scheduledHour`）；投放动作（boost/ad/audience/influencer）每轮重置。
- **历史视图**：新增页面 `app/play/history/page.tsx`（或弹窗），列出每轮发过的帖子（正文/话题/配图/时间 + 该轮成绩），数据取自 `gameState.history`。
- **纯前端**，不动数据库与 API。

---

### 需求 4 + 5(Student Progress) · 学生管理

- 激活 `TeacherShell` 中 **Student Progress** 灰按钮（`enabled: true`，指向新页 `app/teacher/students/...`）。
- 学生名单页：按挑战列出**已加入的真实学生**，每人显示：
  - **总进度**：已发 X / 共 Y 轮；
  - **本轮是否已交**（两个都显示）；
  - 代币余额、最新成绩。
- 数据靠 `Group.studentId` 关联；新增/扩展 API 返回花名册（复用/扩展 `/api/challenges/[id]` 或新增 `/api/challenges/[id]/students`）。
- “本轮是否已交”判定：`in_progress` 时 `rounds.length == currentRound - 1`，故“本轮未交”= 尚无 `currentRound` 的 Round 记录。

---

### 需求 5 · 另两个灰按钮

- **Token Economy** → 激活，做**全班代币消耗统计**页：按 动作类型 / 对局 / 轮次 聚合花费（只读，聚合现有 Round.actions 数据）。
- **Reports** → 激活，做**全班数据汇总**页：整挑战表现汇总（触达/互动/CTR/最终分等，只读聚合）。
- 两页均新增只读聚合 API。

---

### 需求 6 · AI 打分 prompt 升级

- 重写 `lib/engine/llm.ts` 的 `judgeWithLlm` prompt：
  - **结构化多维量规**：目标契合、受众匹配、文案质量、CTA、话题策略、发布时机、品牌调性、季节契合、创意度。
  - 让模型**逐维推理再有逻辑地汇总**成 `qualityCoefficient`（0.7–1.3）。
  - **多维小分完全内部**，输出 schema 基本不变（系数 + 反馈 + contentNotes + visibleEngagement），**UI 不改**；反馈更具体、系数更有依据。
  - 补全喂给模型的上下文：难度、投放动作、发布时机、上一轮表现。
- **同步升级无 key 的确定性兜底桩** `stubJudgement`，按类似逻辑给分，保证无 API key 也合理。
- 保持 OpenAI 供应商；建议将 `OPENAI_MODEL` 由 `gpt-4o-mini` 调到 `gpt-4o`（仅环境变量，不改码）。

---

## 四、实施分期

> 依赖关系：所有功能依赖「地基」；老师端功能依赖 `studentId`。

- **阶段 0 · 地基**：Prisma 迁移 + 认证层改造 + 认证 API。
- **阶段 1 · 需求1**：统一登录 / 注册 / 学生个人页 / 加入 / 退出 / 登出。
- **阶段 2 · 老师端**：需求2（编辑/删除）+ 需求4/5（学生管理 + 代币统计 + 数据汇总）。
- **阶段 3 · 收尾**：需求3（预填/历史）+ 需求6（AI prompt）。

---

## 五、受影响文件清单（预估）

**新增**
- `app/student/page.tsx`、`app/play/history/page.tsx`
- `app/teacher/[id]/edit/page.tsx`、`app/teacher/students/...`、`app/teacher/token-economy/...`、`app/teacher/reports/...`
- `app/api/auth/student/signup/route.ts`、`app/api/student/challenges/route.ts`
- 可能的聚合 API：`app/api/challenges/[id]/students`、代币统计 / 汇总端点

**修改**
- `prisma/schema.prisma`
- `lib/auth/session.ts`、`lib/game-state.ts`（带出 studentId/leftAt）
- `app/page.tsx`、`app/api/auth/login/route.ts`、`app/api/auth/me/route.ts`
- `app/api/join/route.ts`、`app/play/GameProvider.tsx`、`app/play/compose/page.tsx`
- `app/api/challenges/route.ts`、`app/api/challenges/[id]/route.ts`
- `app/teacher/page.tsx`、`app/teacher/TeacherShell.tsx`、`app/teacher/new/page.tsx`、`app/teacher/monitor/[challengeId]/page.tsx`
- `lib/engine/llm.ts`

**废弃**
- `app/join/page.tsx`、`lib/client/session.ts`、`lib/client/teacher-session.ts`

---

## 六、风险与注意点

1. **会话迁移**：学生从 localStorage 迁到 cookie，旧的 localStorage 会话作废，现有“进行中”的匿名对局无法自动认领（需老师/学生重新加入）。
2. **数据一致性**：编辑挑战锁死结构性字段，务必在服务端强制，而非仅前端禁用。
3. **级联删除**：永久删除前二次确认；确保 `onDelete: Cascade` 已随迁移生效，否则外键报错。
4. **AI 兜底**：升级 prompt 后，务必同步升级 `stubJudgement`，避免无 key 环境行为退化。
5. **重名处理**：`Group` 的 `@@unique([challengeId, groupName])` 仍在，加入时的后缀逻辑要能兜住并发重名。
