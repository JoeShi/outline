# 实现计划：智能问答（Smart QA）

## 概述

基于 RAG 架构为 Outline 知识库平台实现智能问答功能。实现按照从底层服务到上层 UI 的顺序逐步构建，每一步都在前一步基础上递增。使用 TypeScript 贯穿前后端，复用 Outline 现有技术栈和架构模式。

## 任务

- [x] 1. 搭建项目结构与核心类型定义
  - [x] 1.1 创建共享类型定义文件
    - 创建 `shared/types/smartQA.ts` 文件
    - 定义 `QAMessage`、`Citation`、`QAError` 接口
    - 定义 API 请求和响应类型 `SmartQAAskRequest`、`SmartQAResponse`
    - _需求：8.7, 6.1_

  - [x] 1.2 创建后端 API 路由骨架与 Schema 验证
    - 创建 `server/routes/api/smartQA/smartQA.ts` 路由文件
    - 创建 `server/routes/api/smartQA/schema.ts`，定义 Zod Schema（`SmartQAAskSchema`），验证 question（1-2000 字符、trim 非空）和可选 conversationId（UUID）以及 history 数组
    - 在 `server/routes/api/index.ts` 中注册 smartQA 路由
    - 添加 auth()、rateLimiter(TwentyFivePerMinute)、validate(SmartQAAskSchema) 中间件链
    - _需求：8.1, 8.2, 8.3, 8.5, 8.6_

  - [ ]* 1.3 编写属性测试：API 输入验证
    - **属性 12：API 输入验证**
    - 使用 fast-check 生成随机长度/内容字符串
    - 验证空字符串、纯空白字符串、超过 2000 字符的字符串被拒绝
    - 验证 1-2000 且 trim 非空的字符串被接受
    - **验证需求：8.1, 8.3**

- [x] 2. 实现文档检索服务
  - [x] 2.1 实现 SmartQADocumentRetriever 服务
    - 创建 `server/services/SmartQADocumentRetriever.ts`
    - 实现 `retrieve(user, query)` 方法
    - 复用 `SearchProviderManager.getProvider().searchForUser()` 进行检索
    - 添加过滤条件：`publishedAt IS NOT NULL AND archivedAt IS NULL AND deletedAt IS NULL`
    - 限制返回结果最多 25 篇文档，按相关性排序
    - 实现错误处理：搜索服务异常时抛出明确错误
    - _需求：3.1, 3.2, 3.3, 3.4, 3.6_

  - [ ]* 2.2 编写属性测试：文档检索权限过滤正确性
    - **属性 4：文档检索权限过滤正确性**
    - 使用 fast-check 生成随机用户权限和文档集合
    - 验证返回文档均满足权限、已发布、未归档、未删除条件
    - **验证需求：3.1, 3.2, 3.3**

  - [ ]* 2.3 编写属性测试：检索结果数量上限不变量
    - **属性 5：检索结果数量上限不变量**
    - 使用 fast-check 生成随机大小文档集
    - 验证传递给后续处理的文档数量不超过 25 篇
    - **验证需求：3.4**

- [x] 3. 实现 LLM 服务
  - [x] 3.1 实现 SmartQALLMService 服务
    - 创建 `server/services/SmartQALLMService.ts`
    - 使用 `@aws-sdk/client-bedrock-runtime` 集成 Amazon Bedrock
    - 实现 `generateAnswer({ question, documents, history })` 方法
    - 从 25 篇检索结果中取相关性最高的前 10 篇作为 LLM 上下文
    - 实现 Token 估算逻辑（中文约 1.5 字符/token，英文约 4 字符/token）
    - 如果 10 篇文档总 token 超限，按相关性从低到高逐篇移除
    - 构造 System Prompt，包含规则（仅基于文档回答、引用格式 [docId:UUID]、Markdown 格式）
    - 实现 30 秒超时控制（AbortController + setTimeout）
    - 解析 LLM 响应，提取回答文本和引用的文档 ID 列表
    - _需求：4.1, 4.2, 4.3, 4.5, 4.6_

  - [ ]* 3.2 编写属性测试：LLM 上下文文档上限和 Token 限制
    - **属性 6：LLM 上下文文档上限和 Token 限制**
    - 使用 fast-check 生成随机文档内容
    - 验证发送给 LLM 的文档数量不超过 10 篇且总 token 不超限
    - **验证需求：4.5**

  - [ ]* 3.3 编写属性测试：LLM 上下文对话窗口
    - **属性 10：LLM 上下文对话窗口**
    - 使用 fast-check 生成随机长度对话历史
    - 验证对话超过 20 轮时仅发送最近 20 轮，不超过 20 轮时全部发送
    - **验证需求：6.2**

- [x] 4. 完成后端 API 端点集成
  - [x] 4.1 实现 smartQA.ask 路由处理逻辑
    - 在路由处理函数中集成 DocumentRetriever 和 LLMService
    - 实现完整请求流程：认证 → 验证 → 限流 → 检索文档 → 调用 LLM → 构造响应
    - 检索结果为空时返回提示信息告知用户（不调用 LLM）
    - 构造响应包含 answer（Markdown）、citations（最多 10 条）、conversationId
    - 实现错误分类和适当的 HTTP 状态码返回（401/400/429/408/500）
    - _需求：3.5, 4.1, 4.3, 7.1, 8.4_

  - [ ]* 4.2 编写后端 API 集成测试
    - 测试完整请求链路（auth → validate → rateLimiter → service → response）
    - Mock SearchProvider 和 Bedrock 客户端
    - 测试认证失败（401）、验证失败（400）、速率超限（429）、超时（408）场景
    - _需求：8.1, 8.2, 8.3, 8.5, 8.6_

- [x] 5. 检查点 - 后端服务验证
  - 确保所有后端测试通过，ask the user if questions arise。

- [x] 6. 实现前端状态管理
  - [x] 6.1 实现 SmartQAStore
    - 创建 `app/stores/SmartQAStore.ts`
    - 定义 observable 状态：isPanelOpen、messages、isLoading、error、retryCount、preservedInput、isRateLimited
    - 实现 actions：openPanel、closePanel、togglePanel、submitQuestion、newConversation、retry
    - 实现 computed：canSubmit、canRetry、recentHistory（最近 20 轮）
    - submitQuestion 内部调用 `client.post("/api/smartQA.ask", ...)` 发送请求
    - 实现对话历史管理：最多 50 轮（100 条消息），超限时自动移除最早轮次
    - 实现错误处理：超时、速率限制（60 秒冷却）、检索失败；错误时保留输入和历史
    - 实现重试逻辑：最多 3 次，耗尽后禁用重试
    - 在 RootStore 中注册：`this.registerStore(SmartQAStore, "smartQA")`
    - _需求：2.5, 2.6, 2.7, 2.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.4, 7.5, 7.6_

  - [ ]* 6.2 编写属性测试：空白输入拒绝
    - **属性 1：空白输入拒绝**
    - 使用 fast-check 生成空白字符串（空格、换行、制表符组合）
    - 验证提交被拒绝，消息列表不变，canSubmit 为 false
    - **验证需求：2.6, 7.2**

  - [ ]* 6.3 编写属性测试：有效输入提交追加消息
    - **属性 3：有效输入提交追加消息**
    - 使用 fast-check 生成非空白有效问题字符串（1-2000，trim 非空）
    - 验证提交后消息列表长度增加 1，最后一条为 user 角色
    - **验证需求：2.5**

  - [ ]* 6.4 编写属性测试：消息时间排序不变量
    - **属性 2：消息时间排序不变量**
    - 使用 fast-check 生成随机消息列表
    - 验证消息始终按 timestamp 升序排列
    - **验证需求：2.4**

  - [ ]* 6.5 编写属性测试：对话历史有界滑动窗口
    - **属性 9：对话历史有界滑动窗口**
    - 使用 fast-check 生成随机长度对话历史
    - 验证消息总轮次不超过 50 轮，超限时移除最早轮次
    - **验证需求：6.1, 6.6**

  - [ ]* 6.6 编写属性测试：错误状态保持对话和输入
    - **属性 11：错误状态保持对话和输入**
    - 使用 fast-check 生成随机对话状态和错误类型
    - 验证错误发生后对话历史保留，用户输入保留在 preservedInput
    - **验证需求：7.5**

- [x] 7. 实现前端 UI 组件
  - [x] 7.1 实现 SmartQAButton 组件
    - 创建 `app/scenes/Document/components/SmartQAButton.tsx`
    - 使用 observer HOC 包装、NudeButton 图标按钮、Tooltip 悬停提示"智能问答"
    - 设置 aria-label="智能问答" 确保无障碍访问
    - 使用 useEditingFocus() 控制编辑焦点时 opacity: 0
    - 使用 breakpoint("tablet") 控制 737px 以下不渲染
    - 添加 @media print 规则隐藏
    - 点击时调用 smartQAStore.togglePanel()
    - _需求：1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 7.2 将 SmartQAButton 集成到 Footer 区域
    - 在 Footer 组件中引入 SmartQAButton，放置在 KeyboardShortcutsButton 左侧
    - 确保布局与现有按钮风格一致
    - _需求：1.1_

  - [x] 7.3 实现 SmartQAPanel 面板组件
    - 创建 `app/scenes/Document/components/SmartQAPanel.tsx`
    - 实现 position: fixed 右下角浮动面板
    - 宽度：min(30vw) 且 min-width: 320px；高度：min(60vh) 且 min-height: 400px
    - 包含子组件：SmartQAPanelHeader（标题 + 新建对话按钮 + 关闭按钮）、SmartQAMessageList、SmartQAInput
    - z-index 确保浮于 Footer 之上
    - 圆角 + 阴影 + 主题适配（dark/light 模式）
    - _需求：2.1, 2.2, 2.4_

  - [x] 7.4 实现 SmartQAInput 输入组件
    - 创建 `app/scenes/Document/components/SmartQAInput.tsx`
    - Enter 键提交（Shift+Enter 换行），空白时禁用发送按钮
    - maxLength: 2000，接近上限时显示字符计数
    - 加载状态时禁用整体输入
    - 错误时恢复 preservedInput 内容
    - _需求：2.3, 2.5, 2.6, 2.7, 7.2_

  - [x] 7.5 实现 SmartQAMessageItem 消息组件
    - 创建 `app/scenes/Document/components/SmartQAMessageItem.tsx`
    - 区分用户消息和系统回答的视觉样式（对齐方式/背景色）
    - 使用 Markdown 渲染组件处理系统回答（支持标题、列表、代码块、链接）
    - 展示加载状态动画占位符
    - 展示错误状态和重试按钮
    - _需求：2.4, 2.7, 4.4, 7.1_

  - [ ]* 7.6 编写属性测试：Markdown 渲染正确性
    - **属性 14：Markdown 渲染正确性**
    - 使用 fast-check 生成随机 Markdown 元素组合（标题、列表、代码块、链接）
    - 验证渲染后 HTML 包含对应语义化元素
    - **验证需求：4.4**

- [x] 8. 实现来源引用功能
  - [x] 8.1 实现 SmartQACitationList 组件
    - 创建 `app/scenes/Document/components/SmartQACitationList.tsx`
    - 有序编号列表展示来源引用
    - 标题超过 80 字符时截断并加省略号
    - 去重逻辑：同一文档 ID 仅展示一条
    - 最多展示 10 条引用，按首次出现顺序排列
    - 点击引用导航到文档路径，面板自动关闭
    - 文档不可访问时展示提示信息
    - _需求：5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 8.2 编写属性测试：来源引用渲染正确性
    - **属性 7：来源引用渲染正确性（排序、去重、上限）**
    - 使用 fast-check 生成随机引用列表
    - 验证引用按首次出现顺序排列、去重、总数不超过 10
    - **验证需求：5.1, 5.6**

  - [ ]* 8.3 编写属性测试：来源引用标题截断
    - **属性 8：来源引用标题截断**
    - 使用 fast-check 生成随机长度字符串
    - 验证超过 80 字符时截断加省略号，不超过时完整展示
    - **验证需求：5.2**

  - [ ]* 8.4 编写属性测试：来源引用响应数据完整性
    - **属性 13：来源引用响应数据完整性**
    - 使用 fast-check 生成随机 Citation 对象
    - 验证每个 Citation 包含有效 UUID 的 id、非空 title、以 "/" 开头的 url
    - **验证需求：8.7**

- [x] 9. 实现多轮对话与新建对话功能
  - [x] 9.1 实现面板中的新建对话按钮和对话历史管理 UI
    - 在 SmartQAPanelHeader 中添加"新建对话"按钮
    - 点击新建对话按钮调用 smartQAStore.newConversation()
    - 清空消息列表、重置上下文、恢复初始空状态
    - 面板关闭再打开时保留历史（依赖 SmartQAStore 状态持久）
    - _需求：6.3, 6.4, 6.5_

- [x] 10. 检查点 - 前端功能验证
  - 确保所有前端测试通过，ask the user if questions arise。

- [x] 11. 端到端集成与错误处理完善
  - [x] 11.1 集成前后端完整流程
    - 确保 SmartQAStore.submitQuestion 正确调用后端 API 并处理响应
    - 验证消息流程：提交 → 加载 → 回答显示 → 引用展示
    - 验证错误流程：超时、速率限制、检索失败的前端展示
    - 验证重试机制：重试按钮点击 → 重新发送 → 计数递增 → 3 次耗尽后禁用
    - 验证速率限制：触发后 60 秒冷却期显示倒计时
    - _需求：2.5, 2.7, 2.8, 7.1, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 11.2 编写端到端集成测试
    - 测试完整用户交互流程：打开面板 → 输入问题 → 收到回答 → 查看引用
    - 测试错误恢复流程：超时 → 显示错误 → 重试 → 成功
    - 测试多轮对话：追问 → 上下文保持 → 新建对话 → 重置
    - _需求：2.5, 6.2, 6.4, 7.1_

- [x] 12. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，ask the user if questions arise。

## 注意事项

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点确保增量验证，避免问题积累
- 属性测试验证普遍正确性属性，单元测试验证具体示例和边界条件
- 前端使用 TypeScript + React + MobX + styled-components
- 后端使用 TypeScript + Koa + Zod + PostgreSQL
- 测试使用 Jest + fast-check + React Testing Library

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 4, "tasks": ["4.2", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "6.4", "6.5", "6.6", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "7.4", "7.5"] },
    { "id": 7, "tasks": ["7.6", "8.1", "9.1"] },
    { "id": 8, "tasks": ["8.2", "8.3", "8.4", "11.1"] },
    { "id": 9, "tasks": ["11.2"] }
  ]
}
```
