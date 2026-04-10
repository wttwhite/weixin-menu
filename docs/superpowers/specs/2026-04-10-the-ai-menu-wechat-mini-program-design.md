# The AI Menu 微信小程序云端共享版设计

更新日期：2026-04-10

## 1. 目标

将 `the-ai-menu` 改写为运行在微信小程序中的云端共享版本，并将新代码落在当前目录 `D:\a-code\wechat-code` 中，不修改原项目 `D:\a-code\github\the-ai-menu`。

新版本采用以下目标形态：

- 前端：微信小程序
- 后端能力：微信云开发
- 结构化数据：云数据库
- 文件：云存储
- 业务入口：云函数
- 使用模式：在线优先
- 数据归属：家庭/团队空间共享

首版需要带上原项目主要业务域：

- 菜谱 `recipes`
- 库存 `pantry`
- 做饭计划 `meal-plans`
- 采购清单 `shopping`
- 统计 `statistics`
- 备份 `backup`

## 2. 非目标

首版不实现以下内容：

- 离线优先和本地 SQLite
- Capacitor、本地文件系统、本地 API
- 多级角色权限
- 增量备份合并
- 复杂协同编辑
- 账号体系以外的独立身份系统

## 3. 推荐架构

### 3.1 总体方案

采用“云函数 API 为主”的访问模型。

小程序页面不直接读写业务集合。业务读写统一通过云函数完成，图片文件由小程序上传到云存储，但上传前后的元数据与权限确认仍然通过云函数处理。

推荐原因：

- 与原项目 `api + service` 的分层最接近
- 权限和空间校验可以集中处理
- 更适合家庭/团队共享模式
- 更容易统一错误码、统计、备份、导入导出

### 3.2 目标目录结构

在当前目录内按以下结构扩展：

```text
wechat-code/
├─ miniprogram/
│  ├─ pages/
│  ├─ components/
│  ├─ services/
│  ├─ utils/
│  └─ stores/
├─ cloudfunctions/
│  ├─ api/
│  ├─ memberOps/
│  └─ fileOps/
├─ shared/
│  ├─ types/
│  ├─ constants/
│  └─ utils/
└─ docs/
   └─ superpowers/
      ├─ specs/
      └─ plans/
```

### 3.3 云函数职责

- `api`
  - 统一业务读写入口
  - 按领域分发到 `recipes / pantry / mealPlans / shopping / statistics`
- `memberOps`
  - 创建空间
  - 生成和重置邀请码
  - 加入空间
  - 切换空间
  - 成员管理
- `fileOps`
  - 菜谱图片上传准备和确认
  - 图片删除和清理
  - 备份导出
  - 备份导入

## 4. 共享空间模型

### 4.1 核心原则

- 业务数据按空间 `spaceId` 隔离，不按个人隔离
- 用户身份通过微信 `openid` 识别
- 一个用户可加入多个空间
- 小程序运行时维护一个 `activeSpaceId`
- 所有业务请求都必须携带并校验 `spaceId`

### 4.2 成员模型

首版权限基线：

- `owner`
  - 可管理成员
  - 可修改空间名称
  - 可重置邀请码
  - 可解散空间
- `member`
  - 可查看和编辑共享业务数据
  - 可上传图片
  - 可发起备份导出

加入空间流程：

1. 拥有者创建空间
2. 系统生成邀请码
3. 其他微信用户输入邀请码加入
4. 加入后可共享查看和编辑该空间数据

## 5. 数据模型设计

### 5.1 通用字段

所有业务集合统一带上：

- `id`
- `spaceId`
- `createdAt`
- `updatedAt`
- `createdBy`
- `updatedBy`
- `isDeleted`

### 5.2 集合清单

#### `spaces`

字段建议：

- `id`
- `name`
- `ownerOpenId`
- `inviteCode`
- `status`
- `createdAt`
- `updatedAt`

#### `space_members`

字段建议：

- `id`
- `spaceId`
- `userOpenId`
- `role`
- `displayName`
- `avatarUrl`
- `status`
- `joinedAt`
- `createdAt`
- `updatedAt`

#### `recipes`

保留原项目主字段，并补充空间字段：

- `id`
- `spaceId`
- `name`
- `summary`
- `category`
- `cuisine`
- `difficulty`
- `servings`
- `prepTimeMinutes`
- `cookTimeMinutes`
- `recommendationScore`
- `notes`
- `sourceName`
- `sourceUrl`
- `isFavorite`
- `coverImageId`
- `ingredients`
- `steps`
- `tagIds`
- `createdBy`
- `updatedBy`
- `isDeleted`
- `createdAt`
- `updatedAt`

说明：

- `ingredients` 和 `steps` 以数组内嵌，减少详情查询次数
- 标签字典独立维护，但菜谱记录只保存 `tagIds`

#### `recipe_tags`

- `id`
- `spaceId`
- `name`
- `color`
- `isDeleted`
- `createdAt`
- `updatedAt`

#### `recipe_images`

- `id`
- `spaceId`
- `recipeId`
- `stepId`
- `cloudPath`
- `fileId`
- `mimeType`
- `fileSize`
- `sortOrder`
- `imageRole`
- `uploadStatus`
- `uploadSessionId`
- `isDeleted`
- `createdAt`
- `updatedAt`

#### `pantry_items`

字段基本沿用原项目：

- `id`
- `spaceId`
- `name`
- `category`
- `location`
- `quantity`
- `unit`
- `productionDate`
- `shelfLifeMonths`
- `expirationDate`
- `openedDate`
- `notes`
- `status`
- `handledType`
- `handledAt`
- `createdBy`
- `updatedBy`
- `isDeleted`
- `createdAt`
- `updatedAt`

#### `meal_plans`

- `id`
- `spaceId`
- `planDate`
- `mealType`
- `mealLabel`
- `status`
- `notes`
- `recipes`
- `createdBy`
- `updatedBy`
- `isDeleted`
- `createdAt`
- `updatedAt`

说明：

- `recipes` 直接内嵌计划中的菜谱快照数组
- 内嵌元素结构贴近原项目 `MealPlanRecipe`

#### `shopping_lists`

- `id`
- `spaceId`
- `name`
- `listDate`
- `status`
- `notes`
- `createdBy`
- `updatedBy`
- `isDeleted`
- `createdAt`
- `updatedAt`

#### `shopping_items`

- `id`
- `spaceId`
- `shoppingListId`
- `name`
- `category`
- `quantity`
- `unit`
- `isChecked`
- `sourceType`
- `sourceRefType`
- `sourceRefId`
- `recipeId`
- `mealPlanId`
- `notes`
- `sortOrder`
- `createdBy`
- `updatedBy`
- `isDeleted`
- `createdAt`
- `updatedAt`

说明：

- 采购项独立成集合，便于频繁勾选和多人并发修改

#### `backup_records`

- `id`
- `spaceId`
- `type`
- `status`
- `fileId`
- `cloudPath`
- `summary`
- `createdBy`
- `createdAt`

## 6. 权限与安全设计

### 6.1 云函数校验

每个业务云函数都必须先做：

1. 获取当前用户 `openid`
2. 校验 `spaceId`
3. 查询 `space_members`
4. 确认成员状态有效
5. 再进入具体业务逻辑

### 6.2 权限边界

- 页面层不直接写业务集合
- 业务集合默认只允许云函数访问
- 文件操作必须带空间上下文
- 所有云存储路径都必须包含 `spaceId`

推荐云存储路径：

- `spaces/{spaceId}/recipes/...`
- `spaces/{spaceId}/backup/...`

## 7. 页面与导航设计

### 7.1 页面清单

- `pages/boot/index`
- `pages/space/index`
- `pages/space-create/index`
- `pages/space-join/index`
- `pages/space-members/index`
- `pages/recipes/index`
- `pages/recipe-detail/index`
- `pages/recipe-edit/index`
- `pages/pantry/index`
- `pages/pantry-edit/index`
- `pages/meal-plans/index`
- `pages/meal-plan-edit/index`
- `pages/shopping/index`
- `pages/shopping-edit/index`
- `pages/statistics/index`
- `pages/backup/index`

### 7.2 底部导航

底部 `tabBar` 建议保留 5 个主入口：

- 菜谱
- 库存
- 计划
- 采购
- 统计

`空间管理` 和 `备份` 作为次级入口进入，不放到底栏。

### 7.3 启动流程

建议固定为：

1. `App.onLaunch` 初始化云开发
2. 进入 `boot`
3. 调用 `memberOps.bootstrap`
4. 返回：
   - `openid`
   - 已加入空间列表
   - 默认空间
   - 当前角色
5. 无空间则进入创建/加入空间页
6. 有空间则写入本地 `activeSpaceId`，进入主业务页

## 8. 前端分层

推荐保留类似原项目的 service 分层：

- `services/cloud.ts`
- `services/session.ts`
- `services/recipe.ts`
- `services/pantry.ts`
- `services/mealPlan.ts`
- `services/shopping.ts`
- `services/statistics.ts`
- `services/backup.ts`
- `services/upload.ts`

页面层只调用 `services/*`，不直接拼接云函数请求。

## 9. 并发与冲突策略

首版采用最小可行冲突控制：

- 默认最后一次成功写入生效
- 更新请求必须带 `updatedAt`
- 云函数更新前比对库内最新 `updatedAt`
- 不一致则返回 `DATA_CONFLICT`

前端提示：

- “这条数据已被其他成员更新，请刷新后再保存”
- 提供“刷新最新内容”和“强制覆盖一次”两个动作

## 10. 图片上传链路

### 10.1 三段式上传

推荐流程：

1. 页面调用 `fileOps.prepareRecipeImageUpload`
2. 云函数生成：
   - `imageId`
   - `uploadSessionId`
   - `cloudPath`
3. 小程序调用 `wx.cloud.uploadFile`
4. 上传成功后调用 `fileOps.confirmRecipeImageUpload`
5. 云函数写入 `recipe_images`
6. 页面更新编辑态

### 10.2 删除与取消

- 编辑中取消图片：调用 `fileOps.discardRecipeImage`
- 已绑定图片删除：调用 `fileOps.deleteRecipeImage`

### 10.3 失败处理

- 文件上传失败：提示“图片上传失败，请重试”
- 文件成功但元数据失败：提示“图片已上传但登记失败，系统将尝试清理，请重试”
- 保存菜谱失败：保留编辑态和已确认图片元数据，允许再次提交

## 11. 备份链路

### 11.1 导出

导出语义为“导出当前空间完整数据与图片”。

推荐流程：

1. 页面调用 `fileOps.exportSpaceBackup`
2. 云函数读取当前空间所有业务数据
3. 云函数读取相关图片文件
4. 生成 `backup.json + files/...`
5. 打包为 zip
6. 回传到云存储 `spaces/{spaceId}/backup/...`
7. 记录到 `backup_records`

### 11.2 导入

导入语义为“覆盖恢复当前空间”。

推荐流程：

1. 页面选择 zip 文件
2. 上传到临时云路径
3. 调用 `fileOps.importSpaceBackup`
4. 校验 zip、版本、结构和图片完整性
5. 清空当前空间业务数据
6. 按顺序恢复数据和图片
7. 写入导入结果记录

### 11.3 失败分类

必须区分：

- 格式无效
- 版本不支持
- 图片缺失
- 数据恢复失败
- 权限不足

## 12. 统计设计

统计页首版由云函数实时汇总，不单独维护派生表。

建议展示：

- 菜谱总数
- 库存总数
- 即将过期数量
- 本周计划数量
- 待完成采购项数量
- 最近备份时间
- 当前空间名称
- 成员数量

## 13. 错误处理规范

统一返回结构建议：

```ts
interface ApiResponse<T> {
  code: number
  message?: string
  data: T
  retryable?: boolean
}
```

建议保留明确错误码：

- `SPACE_FORBIDDEN`
- `SPACE_NOT_FOUND`
- `SPACE_INVITE_INVALID`
- `CLOUD_UPLOAD_FAILED`
- `DB_WRITE_FAILED`
- `DATA_CONFLICT`
- `BACKUP_EXPORT_FAILED`
- `BACKUP_IMPORT_INVALID`

小程序统一把云端错误转换为明确中文提示，不允许吞错。

## 14. 从原项目复用与重写边界

### 14.1 可复用内容

- 领域类型定义
- 字段语义
- 状态与排序规则
- 统计口径
- 备份数据结构
- 业务错误语义

### 14.2 必须重写内容

- Vue 页面与路由
- Pinia 与 Element Plus 交互
- Express API
- Local API
- SQLite 与本地文件系统
- Capacitor 原生桥接

## 15. 迁移阶段

### 阶段 1：项目骨架与空间体系

- 初始化小程序云开发骨架
- 搭建统一云函数调用层
- 实现创建空间、加入空间、切换空间
- 接入全局错误提示

### 阶段 2：库存 `pantry`

- 列表
- 筛选
- 新增
- 编辑
- 删除

### 阶段 3：菜谱 `recipes`

- 列表
- 详情
- 新增和编辑
- 标签
- 步骤与食材
- 图片上传、删除、排序

### 阶段 4：计划 `meal-plans`

- 日期维度查看
- 餐次管理
- 关联菜谱

### 阶段 5：采购与统计

- 采购清单
- 采购项勾选
- 从计划生成采购项
- 统计页聚合

### 阶段 6：备份

- 导出 zip
- 导入 zip
- 最近备份记录

## 16. 测试与验证策略

首版验证重点：

- 云函数单测
- 领域纯函数单测
- 两个账号进入同一空间的共享验证
- 图片上传链路验证
- 备份导入导出验证

重点验证场景：

- 成员权限校验正确
- 空间切换后数据不串空间
- 云端写入失败有清晰提示
- 图片上传成功但确认失败时有补偿处理
- 导入失败不会产生半恢复状态

## 17. 结论

最终推荐方案：

- 在当前目录独立实现微信小程序版本
- 原项目只作为迁移参考，不做修改
- 使用 `云数据库 + 云存储 + 云函数`
- 使用家庭/团队空间作为共享边界
- 使用“云函数 API 为主”的业务访问模型
- 按“空间 -> 库存 -> 菜谱 -> 计划 -> 采购/统计 -> 备份”顺序分阶段落地
