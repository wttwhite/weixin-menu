# Meal Plans Calendar Collapse Design

更新日期：2026-04-21

## 目标

把微信小程序 `pages/meal-plans/index` 的日历改成双态展示：

- 默认收起时只展示当前选中日期所在周
- 展开时展示完整月份
- 切换过程带平滑过渡动画

## 范围

- 饮食计划页顶部日历区域
- 月份切换后的选中日期与周定位逻辑
- 展开/收起触发器与箭头动效
- 月历首尾补齐为灰态跨月日期
- 对应数据层、页面流、模板样式测试

## 交互约束

- 默认进入页面时日历处于收起态
- 收起态始终跟随“当前选中日期”所在周，不跟今天绑定
- 选中日期不会自动改变展开状态
- 翻月时保留当前展开状态，并按现有规则重算该月有效选中日期
- 点击灰态跨月日期时，切换到对应月份并选中该日期

## 视觉方向

- 延续现有页面的圆角卡片和浅色背景
- 日历主体采用“视口 + 整月网格”结构，避免生硬切换
- 收起/展开时以高度与位移过渡为主，箭头同步旋转
- 跨月日期弱化显示，但仍保留完整格子对齐

## 数据与实现思路

- 抽出 `miniprogram/pages/meal-plans/calendar.js` 作为纯函数模块
- 完整月份仍统一生成 7 列网格数据
- 页面层只根据 `selectedDate` 和 `isCalendarExpanded` 计算：
  - 当前选中日期所在行
  - 视口高度
  - 网格位移
- 现有 `syncCalendarView` 继续负责月份、选中日期、计划列表同步

## 非目标

- 不改动库存检查弹层
- 不改动计划卡片列表结构
- 不引入第三方动画库
- 不改动 `shared/` 领域模型

## 预期文件

- 新增 `miniprogram/pages/meal-plans/calendar.js`
- 修改 `miniprogram/pages/meal-plans/index.js`
- 修改 `miniprogram/pages/meal-plans/index.wxml`
- 修改 `miniprogram/pages/meal-plans/index.wxss`
- 新增 `tests/miniprogram/meal-plans-calendar.test.js`
- 修改 `tests/miniprogram/meal-plan-page-flow.test.js`
- 修改 `tests/miniprogram/meal-plans-template.test.js`
