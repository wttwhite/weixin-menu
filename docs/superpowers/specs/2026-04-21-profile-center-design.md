# Profile Center Design

更新日期：2026-04-21

## 目标

新增一个个人中心 tab 页，聚合当前空间昵称、空间管理、成员管理、分类管理、位置管理、换肤、备份导入和统计入口，并替换现有 tabBar 最后一项“统计”入口。

## 范围

- 新增 `/pages/profile/index` 作为 tabBar 页面
- tabBar 最后一项从“统计”改成“我的”
- 现有 `/pages/statistics/index` 改为个人中心二级入口
- 个人中心首页聚合以下能力：
  - 当前空间昵称展示与编辑
  - 当前空间卡片
  - 成员管理入口
  - 菜谱分类管理
  - 食材分类管理
  - 食材位置管理
  - 换肤
  - 数据备份
  - 数据导入
  - 统计入口
- 补齐当前空间昵称的后端字段与更新链路
- 复用或抽离现有分类/位置管理逻辑供个人中心弹层使用

## 非目标

- 不新增全局账号资料系统
- 不实现复杂背景图皮肤，仅实现配色主题切换
- 不实现成员角色编辑
- 不把完整备份/导入流程内嵌进个人中心首页
- 不把完整统计 dashboard 搬进个人中心首页

## 信息架构

个人中心首页采用“聚合入口页”结构，而不是重型管理页。

### 1. 顶部资料卡

- 主标题：当前空间昵称
- 副标题：当前空间名 + 当前角色
- 右侧操作：编辑昵称
- 轻量摘要：
  - 成员数
  - 菜谱数
  - 最近备份状态

### 2. 当前空间卡

- 展示当前空间名
- 展示角色标签
- 展示邀请码摘要
- 支持复制邀请码
- 提供空间操作入口：
  - 切换空间
  - 创建空间
  - 加入空间
- 若当前用户是 owner，额外显示“修改空间名”

### 3. 功能分组

#### 空间与成员

- 成员管理

#### 内容配置

- 菜谱分类
- 食材分类
- 食材位置
- 换肤

#### 数据与分析

- 数据备份
- 数据导入
- 统计

## 交互设计

### 个人中心首页

- 入口样式采用卡片列表，不使用密集宫格
- 每个入口展示：
  - 图标
  - 标题
  - 一行说明
  - 右侧箭头或当前状态
- 首页不直接承载重型 CRUD，只做摘要和统一入口

### 当前空间昵称

- 顶部资料卡提供“编辑昵称”
- 点击后使用 `wx.showModal({ editable: true })`
- 保存后刷新首页资料和成员信息

### 成员管理

- 从个人中心跳转到独立子页面
- 复用并升级现有 `/pages/space-members/index`
- 本轮支持：
  - 查看成员
  - 复制/刷新邀请码
  - owner 删除成员
  - owner 编辑成员昵称

### 菜谱分类 / 食材分类 / 食材位置

- 在个人中心内以弹层管理
- 不跳回业务页
- 底层复用现有 service 调用和管理逻辑
- 三类管理行为保持一致：
  - 查看
  - 新增
  - 重命名
  - 删除
  - 排序（若现有逻辑已支持）

### 换肤

- 在个人中心内弹层切换
- 选择后即时生效
- 本轮提供 3 套主题：
  - 默认奶油暖色
  - 清新浅绿
  - 暖橙琥珀

### 备份 / 导入

- 作为两个独立入口出现在首页
- 点击后进入现有 `/pages/backup/index`
- 不在首页重复实现文件选择、导出等重交互

### 统计

- 点击后进入现有 `/pages/statistics/index`
- 首页仅显示摘要，不直接内嵌 dashboard

## 数据设计

### 当前空间昵称

当前空间昵称是本次唯一新增的核心资料字段。

- 存储位置：`space_members` 成员关系记录
- 建议字段：`displayName`
- 语义：当前用户在当前空间中的昵称
- 特性：
  - 同一用户在不同空间可有不同昵称
  - 不影响全局账号
  - 与 `role/status/openid/spaceId` 同层维护

### 显示回退顺序

若 `displayName` 为空，则前端按以下顺序回退：

1. `nickName`
2. `name`
3. `openid`
4. `匿名成员`

### 空间卡片数据来源

- `session.bootstrap()`：获取 `spaces/activeSpaceId/role/openid`
- `members.bootstrapSession()`：补充 active space 相关信息
- `space-members`：用于获取成员数和当前成员信息
- `statistics dashboard`：用于首页摘要

## 复用与拆分策略

### 现有页面复用

- `/pages/space/index`
  - 切换空间
- `/pages/space-create/index`
  - 创建空间
- `/pages/space-join/index`
  - 加入空间
- `/pages/backup/index`
  - 数据备份 / 数据导入
- `/pages/statistics/index`
  - 统计
- `/pages/space-members/index`
  - 成员管理基础能力

### 分类/位置管理逻辑复用

不在个人中心重写第三套分类/位置逻辑。

- 从 `pages/recipes/index` 抽出菜谱分类管理 helper
- 从 `pages/pantry/index` 抽出食材分类/位置管理 helper
- 个人中心内的弹层只承载统一 UI 与状态封装
- service 调用和业务规则复用原页面逻辑

### 换肤实现

- 不走云端配置
- 先走本地 storage
- app 启动时读取主题配置
- 页面视觉通过 CSS 变量切换品牌色、背景色、强调色

## 权限规则

- 当前空间昵称：成员仅可编辑自己的昵称
- 修改空间名：仅 owner 可见
- 成员管理：
  - 所有成员可查看列表
  - owner 可删除成员
  - owner 可编辑成员昵称
- 备份导入：延续现有备份页权限控制

## 空状态与容错

### 无 active space

- 个人中心首页显示空状态
- 引导用户创建空间或加入空间
- 分类/成员/统计等依赖空间的入口置灰或隐藏

### 资料缺失

- 当前空间昵称为空时走回退显示
- 空间名为空时显示“未命名空间”

### 功能失败

- 分类/位置弹层加载失败：toast 提示，不影响首页其他入口
- 换肤失败：回退默认主题
- 昵称更新失败：toast 提示并保留当前显示

## 测试设计

### 新增测试

- 个人中心页面 flow test
- 个人中心页面 template test
- 当前空间昵称更新 service / page flow test
- 主题 storage/helper test
- 分类/位置管理 helper test

### 回归测试

- `space-members`
- `backup`
- `statistics`
- `recipes`
- `pantry`
- custom tab bar

## 预期文件

- 新增 `miniprogram/pages/profile/index.js`
- 新增 `miniprogram/pages/profile/index.wxml`
- 新增 `miniprogram/pages/profile/index.wxss`
- 新增 `miniprogram/pages/profile/index.json`
- 修改 `miniprogram/app.json`
- 修改 `miniprogram/custom-tab-bar/index.js`
- 修改成员服务链路与 `memberOps` 云函数
- 抽离菜谱分类与库存分类/位置管理 helper
- 补充对应测试
