# 需求文档

## 简介

智能问答（Smart QA）功能为 Outline 知识库应用添加基于自然语言的智能问答能力。用户可以从任意页面发起提问，系统将基于用户有权限访问的文档内容，利用 Amazon Bedrock Sonnet 4.6 大语言模型生成回答，并提供来源引用链接，支持多轮追问对话。

## 术语表

- **Smart_QA_Panel**：智能问答面板，用户与系统进行问答交互的浮动面板组件
- **Smart_QA_Button**：智能问答按钮，位于页面右下角键盘快捷键按钮上方的图标按钮，用于打开智能问答面板
- **Conversation**：对话会话，用户与系统之间的一次多轮问答交互上下文
- **Source_Citation**：来源引用，回答中标注的引用来源，包含可点击跳转到源文档的链接
- **LLM_Service**：大语言模型服务，指 Amazon Bedrock 提供的 Sonnet 4.6 模型接口
- **Context_Documents**：上下文文档，系统根据用户问题检索到的、用于生成回答的相关文档集合
- **Permission_Filter**：权限过滤器，确保仅检索用户有权限访问的文档的过滤机制

## 需求

### 需求 1：智能问答按钮展示

**用户故事：** 作为 Outline 用户，我希望在页面右下角看到一个智能问答入口按钮，以便随时发起提问。

#### 验收标准

1. THE Smart_QA_Button SHALL 以图标按钮形式展示在页面右下角 Footer 固定区域内，排列在 KeyboardShortcutsButton 左侧
2. WHEN 用户将鼠标悬停在 Smart_QA_Button 上时，THE Smart_QA_Button SHALL 通过 Tooltip 展示"智能问答"提示文字
3. WHILE 用户处于编辑焦点状态时，THE Smart_QA_Button SHALL 通过透明度过渡变为不可见（opacity: 0），保留布局空间，与 KeyboardShortcutsButton 的隐藏行为一致
4. WHILE 页面处于打印模式时，THE Smart_QA_Button SHALL 通过 CSS @media print 规则完全隐藏（display: none）
5. IF 视口宽度小于 tablet 断点（737px），THEN THE Smart_QA_Button SHALL 不渲染显示（display: none）
6. WHEN 用户点击 Smart_QA_Button 时，THE Smart_QA_Button SHALL 触发智能问答面板的打开操作
7. THE Smart_QA_Button SHALL 提供 aria-label 属性标识按钮用途为"智能问答"，确保屏幕阅读器可识别

### 需求 2：智能问答面板交互

**用户故事：** 作为 Outline 用户，我希望通过面板界面进行问答交互，以便方便地查看回答和追问。

#### 验收标准

1. WHEN 用户点击 Smart_QA_Button 时，THE Smart_QA_Panel SHALL 以浮动面板形式在页面右下角展开显示，面板宽度不超过视口宽度的 30% 且不小于 320px，高度不超过视口高度的 60% 且不小于 400px
2. WHILE Smart_QA_Panel 处于打开状态，WHEN 用户点击 Smart_QA_Button 或面板关闭按钮时，THE Smart_QA_Panel SHALL 关闭并隐藏
3. THE Smart_QA_Panel SHALL 包含一个文本输入框供用户输入自然语言问题，输入框最大字符数为 2000 个字符
4. THE Smart_QA_Panel SHALL 包含一个消息展示区域，按时间升序（从旧到新）显示对话中的问题和回答，其中用户问题和系统回答通过不同的对齐方式或视觉样式进行区分
5. WHEN 用户在输入框中按下 Enter 键或点击发送按钮时，THE Smart_QA_Panel SHALL 提交用户输入的问题，并在消息展示区域追加该问题消息，同时清空输入框
6. IF 用户尝试提交空白内容（仅包含空格或无任何字符）时，THEN THE Smart_QA_Panel SHALL 不执行提交操作，且发送按钮保持禁用状态
7. WHILE 系统正在生成回答时，THE Smart_QA_Panel SHALL 在消息展示区域底部展示可见的加载状态指示器（如动画占位符），并禁用输入框的提交功能
8. IF 系统在 30 秒内未返回回答，THEN THE Smart_QA_Panel SHALL 停止加载状态指示器，并在消息区域展示超时错误提示信息，同时恢复输入框的可用状态

### 需求 3：基于权限的文档检索

**用户故事：** 作为 Outline 用户，我希望问答系统仅基于我有权限访问的文档回答问题，以确保信息安全。

#### 验收标准

1. WHEN 用户提交问题时，THE Permission_Filter SHALL 仅检索该用户有权限访问的已发布文档，权限范围包括用户所属集合（Collection）的成员权限以及文档级别的单独共享权限
2. WHEN 用户提交问题时，THE Permission_Filter SHALL 排除用户无权限访问的文档内容，包括用户不属于其所在集合的文档以及未被单独授权访问的文档
3. THE Permission_Filter SHALL 排除已归档（archivedAt 不为空）、已删除（deletedAt 不为空）以及草稿状态（publishedAt 为空）的文档
4. WHEN 检索完成且匹配文档数量大于 0 时，THE Smart_QA_Panel SHALL 将匹配的 Context_Documents 内容（最多 25 篇文档）提供给 LLM_Service 作为回答生成的上下文
5. IF 检索完成后匹配文档数量为 0，THEN THE Smart_QA_Panel SHALL 向用户展示无法找到相关授权文档的提示信息，且不调用 LLM_Service
6. IF Permission_Filter 在检索过程中发生错误（如权限服务不可用），THEN THE Smart_QA_Panel SHALL 向用户展示检索失败的错误提示信息，且不返回任何文档内容

### 需求 4：智能回答生成

**用户故事：** 作为 Outline 用户，我希望系统能基于知识库内容生成准确的回答，以便快速获取所需信息。

#### 验收标准

1. WHEN Context_Documents 被成功检索后，THE LLM_Service SHALL 使用 Amazon Bedrock Sonnet 4.6 模型基于上下文文档内容生成回答，且回答生成过程不超过 30 秒
2. THE LLM_Service SHALL 仅基于 Context_Documents 中的内容生成回答，回答中的所有事实陈述必须可追溯到至少一个 Context_Document 中的具体内容
3. IF Context_Documents 为空或检索到的文档内容与用户问题无语义关联，THEN THE LLM_Service SHALL 返回提示信息告知用户当前知识库中未找到与问题相关的内容
4. THE Smart_QA_Panel SHALL 以 Markdown 格式渲染 LLM_Service 返回的回答内容，支持标题、列表、代码块和链接等常见 Markdown 元素的正确显示
5. THE LLM_Service SHALL 将传入模型的 Context_Documents 上下文限制在最多 10 篇文档，且总上下文长度不超过模型支持的最大输入 token 数
6. IF LLM_Service 回答生成超过 30 秒未完成，THEN THE Smart_QA_Panel SHALL 终止请求并向用户展示超时错误提示，允许用户重试

### 需求 5：来源引用展示

**用户故事：** 作为 Outline 用户，我希望回答中包含来源引用，以便我能验证信息来源并跳转到原始文档。

#### 验收标准

1. WHEN LLM_Service 生成包含至少一个来源引用的回答时，THE Smart_QA_Panel SHALL 在回答内容末尾展示带有"来源"标签的 Source_Citation 列表，列表中的引用按其在回答中首次被引用的顺序排列，最多展示 10 条 Source_Citation
2. THE Source_Citation SHALL 以有序编号列表形式展示，每条包含源文档的完整标题作为可点击链接文字；IF 文档标题超过 80 个字符，THEN THE Source_Citation SHALL 截断标题并以省略号结尾
3. WHEN 用户点击 Source_Citation 链接时，THE Smart_QA_Panel SHALL 在当前窗口导航到对应源文档的 Outline 文档路径页面，面板在导航后自动关闭
4. IF LLM_Service 生成的回答未引用任何文档，THEN THE Smart_QA_Panel SHALL 不展示 Source_Citation 区域
5. IF 用户点击的 Source_Citation 对应的文档已被删除或用户已无权限访问，THEN THE Smart_QA_Panel SHALL 展示提示信息告知用户该文档不可访问，且不进行页面导航
6. IF 回答引用了多个文档中的相同文档，THEN THE Smart_QA_Panel SHALL 对该文档仅展示一条 Source_Citation（去重）

### 需求 6：多轮对话支持

**用户故事：** 作为 Outline 用户，我希望能在同一会话中进行追问，以便深入了解某个话题。

#### 验收标准

1. THE Conversation SHALL 维护当前会话的对话历史记录，每条记录包含角色标识（用户或系统）、消息内容和时间戳，最多保留 50 轮对话（100 条消息）
2. WHEN 用户在已有对话中提交新问题时，THE LLM_Service SHALL 将 Conversation 中最近 20 轮对话历史作为上下文与新问题一并发送至模型以生成回答
3. WHEN 用户关闭 Smart_QA_Panel 后重新打开时，THE Conversation SHALL 保留之前的对话历史记录，直至用户刷新页面、关闭浏览器标签页或主动清除
4. THE Smart_QA_Panel SHALL 提供"新建对话"按钮，允许用户清除历史记录并开始全新对话
5. WHEN 用户点击"新建对话"按钮时，THE Smart_QA_Panel SHALL 清空当前 Conversation 的所有历史消息、重置对话上下文，并将消息展示区域恢复为初始空状态
6. IF Conversation 历史记录达到 50 轮上限，THEN THE Conversation SHALL 自动移除最早的对话轮次以为新消息腾出空间

### 需求 7：错误处理

**用户故事：** 作为 Outline 用户，我希望在系统出错时能收到清晰的反馈，以便了解问题状况。

#### 验收标准

1. IF LLM_Service 请求在 30 秒内未返回响应或服务返回不可用状态，THEN THE Smart_QA_Panel SHALL 展示包含错误原因描述的提示信息，并提供重试按钮允许用户重新发送同一问题，重试次数上限为 3 次
2. IF 用户提交的问题内容为空字符串或仅包含空白字符（空格、换行、制表符），THEN THE Smart_QA_Panel SHALL 禁用发送按钮并在输入框附近展示提示信息告知用户需输入有效问题内容
3. IF 文档检索过程中发生错误，THEN THE Smart_QA_Panel SHALL 向用户展示检索失败的提示信息并提供重试按钮
4. IF LLM_Service 返回速率限制错误，THEN THE Smart_QA_Panel SHALL 展示提示信息告知用户请求过于频繁，并在 60 秒后自动恢复发送功能
5. IF 任何错误发生导致回答生成失败，THEN THE Smart_QA_Panel SHALL 移除加载状态指示器，保留 Conversation 中已有的对话历史记录不丢失，并将用户输入内容保留在输入框中
6. IF 重试次数已达到 3 次上限且问题仍未解决，THEN THE Smart_QA_Panel SHALL 禁用重试按钮并展示提示信息建议用户稍后再试

### 需求 8：后端问答 API

**用户故事：** 作为开发者，我希望有一个清晰的后端 API 接口来处理问答请求，以便前端能正确调用。

#### 验收标准

1. THE Smart_QA_API SHALL 提供 POST 接口接收用户的问题文本（长度为 1 至 2000 个字符）和可选的对话历史标识（UUID 格式）
2. IF 请求未携带有效的身份认证凭证，THEN THE Smart_QA_API SHALL 拒绝该请求并返回认证失败的错误响应，不执行任何问答处理
3. IF 请求中的问题文本为空、超出长度限制或格式不合法，THEN THE Smart_QA_API SHALL 拒绝该请求并返回指明验证失败原因的错误响应
4. WHEN 收到通过身份认证且通过输入验证的请求时，THE Smart_QA_API SHALL 返回包含回答文本和来源引用列表（最多 10 条引用）的响应
5. THE Smart_QA_API SHALL 对每个 IP 地址实施速率限制，限制为每分钟最多 25 次请求
6. IF 请求超出速率限制，THEN THE Smart_QA_API SHALL 拒绝该请求并返回指示速率超限的错误响应
7. THE Source_Citation 响应数据 SHALL 包含文档标识符（UUID 格式）、文档标题（字符串）和文档访问路径（相对 URL 路径）
