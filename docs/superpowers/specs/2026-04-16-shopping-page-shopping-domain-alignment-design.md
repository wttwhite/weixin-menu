# Shopping Page And Shopping-Domain Alignment

更新日期：2026-04-16

## 目标

把微信小程序的 `pages/shopping/index` 改成接近用户提供截图的采购页样式，并同步把当前小程序的购物域字段命名对齐到原项目 `the-ai-menu` 的购物模型，降低后续原项目数据导入成本。

## 背景结论

- 当前项目尚未正式投入使用，因此本轮允许做破坏性字段调整，不需要保留旧购物数据兼容。
- 原项目购物域字段已经稳定，优先沿用原项目命名和状态值。
- 原项目的 `recipes` 与 `meal-plans` 主字段已经基本对齐当前小程序，不需要在本轮一起重构。
- 当前小程序的 `pantry` 比原项目多了 `productionDate` / `shelfLifeMonths` 和“新鲜度 + 使用状态”拆分逻辑，这部分不在本轮收口。

## 范围

- 重做采购页 `hero`、状态筛选条、清单卡片和采购项区域
- 移除采购页顶部 `切换空间`
- 采购清单弹框改成自定义表单弹层，不再使用 `wx.showModal`
- 采购项“录入库存”改为在采购页内打开库存录入弹框
- 录入库存成功后，自动把对应采购项标记为已完成
- 购物域字段命名、状态值、服务层和测试统一对齐原项目

## 原项目对齐规则

### 采购清单字段

统一对齐为：

- `name`
- `listDate`
- `status`
- `notes`

状态值统一使用原项目：

- `open`
- `completed`
- `archived`

### 采购项字段

统一对齐为：

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

### 当前小程序中需要移除的临时命名

- 清单头部的 `title` 改为 `name`
- 采购项的 `checked` 改为 `isChecked`

## 页面结构

### 1. 顶部 Hero

采用用户截图中的绿色 `Market Action Panel` 视觉方向。

包含：

- 日期
- 英文副标题 `MARKET ACTION PANEL`
- 主标题 `采购清单`
- 一句摘要文案
- 下方运营指标面板

指标面板展示：

- 待采购项数量
- 完成率
- 自动生成项数量

购物页不再显示空间名，也不提供 `切换空间` 按钮。

### 2. 状态筛选条

在 `hero` 下方增加采购清单状态筛选：

- 全部
- 进行中
- 已完成
- 已归档

显示文案使用中文，内部值保持原项目英文状态值。

### 3. 清单卡片区

每个采购清单卡片展示：

- 清单名称
- 状态标签
- `listDate`
- 进度条
- 完成文案，例如 `3 / 4 项已完成`
- 编辑入口
- 删除入口

采购项区域展示：

- 勾选框
- 名称
- 数量与单位
- 右侧 `录入库存`

卡片内采购项默认以内嵌列表形式展示，不再要求先切换 picker 再看单个清单。

## 弹框设计

### 1. 新建 / 编辑清单弹框

采用白色圆角大卡片弹层，结构参考用户给图。

字段：

- `name`
- `listDate`
- `status`
- `notes`

底部保留“手工采购项”草稿区，允许在创建清单时一并录入手工采购项。

草稿采购项字段：

- `name`
- `category`
- `quantity`
- `unit`
- `notes`

保存时：

- 清单头信息写入 `shopping_lists`
- 手工采购项写入 `shopping_items`
- `sourceType` 统一写 `manual`

### 2. 录入库存弹框

不再跳转到 `pages/pantry-edit/index`，而是在购物页内直接打开库存录入弹框。

录入库存弹框视觉和字段编排参考当前库存编辑页，但按弹层形态重组，不复用整页导航壳。

预填规则：

- `name <- shoppingItem.name`
- `category <- shoppingItem.category`
- `quantity <- shoppingItem.quantity`
- `unit <- shoppingItem.unit`
- `notes <- ''`
- `location <- ''`
- `usageStatus <- 'normal'`

保存库存成功后：

1. 创建一条库存记录
2. 将当前采购项 `isChecked` 更新为 `true`
3. 刷新当前采购清单视图

## 数据流设计

### 采购页加载

采购页加载后直接读取当前空间下所有采购清单，并在前端做状态筛选与排序。

推荐排序：

1. 按状态分组时，先按当前筛选条件过滤
2. 再按 `listDate` 倒序
3. 日期相同时按 `updatedAt` 倒序

### 新建 / 编辑清单

保留现有 `createShoppingList` / `updateShoppingList` 入口，但请求体字段改成原项目命名。

如果单次提交里包含手工采购项草稿：

- 允许一次创建清单头
- 再逐条创建采购项

不要求本轮为了原子事务额外引入复杂批处理接口。

### 录入库存

购物页调用现有 `pantry` 服务创建库存项，不改 `pantry` 后端核心模型。

采购项自动勾选通过现有购物服务更新采购项完成状态。

## 非目标

- 本轮不收口 `pantry` 到原项目的 `status / handledType / handledAt` 模型
- 本轮不改 `recipe_images` 的云端存储结构去模拟原项目 `filePath`
- 本轮不做原项目备份导入器
- 本轮不做采购项拖拽排序
- 本轮不把购物页改成完全离线模式

## 文件影响

预计至少影响：

- `shared/domain/shopping.js`
- `cloudfunctions/api/services/shopping-service.js`
- `miniprogram/services/shopping.js`
- `miniprogram/pages/shopping/index.js`
- `miniprogram/pages/shopping/index.wxml`
- `miniprogram/pages/shopping/index.wxss`
- `tests/shared/shopping-domain.test.js`
- `tests/cloudfunctions/shopping-service.test.js`
- `tests/miniprogram/shopping-service.test.js`
- 购物页相关 flow / template 测试

可能新增：

- 购物页内部弹框状态与草稿辅助函数
- 购物页“录入库存”辅助函数测试

## 验证要求

至少验证以下场景：

1. 新建清单时可保存 `name / listDate / status / notes`
2. 状态筛选条能正确过滤 `open / completed / archived`
3. 手工采购项可在清单弹框中新增
4. 自动生成采购项仍能正常落库
5. 采购项勾选仍能更新进度
6. 点击 `录入库存` 打开库存弹框并带入预填值
7. 录入库存成功后，采购项自动变为已完成
8. `npx vitest run` 中购物域相关测试通过

## 后续建议

本轮完成后，再单独启动下一轮设计：

- `pantry` 字段与状态语义向原项目进一步收口
- 增加原项目备份导入适配层
- 处理 `id -> _id` 和原项目 ZIP 清单嵌套结构到云端双集合的转换
