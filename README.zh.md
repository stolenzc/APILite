<p align="center">
  <img src=".github/assets/logo.png" width="128" height="128" alt="APILite">
</p>

<h1 align="center">APILite</h1>

<p align="center">
  一款基于 Tauri（Rust）和 React 构建的轻量级桌面 HTTP 客户端<br>提供类似 Postman 的界面，用于发送、测试和管理 API 请求。
</p>

<p align="center">
  <a href="README.md">English</a>
</p>

<p align="center">
  <picture>
    <img alt="APILite HTTP client with request editor and response panel" src=".github/assets/app.png" width="800">
  </picture>
</p>

## 目录

- [目录](#目录)
- [快速开始](#快速开始)
  - [从源码构建](#从源码构建)
  - [项目结构](#项目结构)
- [界面概览](#界面概览)
- [发送请求](#发送请求)
  - [发送步骤](#发送步骤)
  - [URL 输入](#url-输入)
- [查询参数](#查询参数)
  - [自动识别](#自动识别)
  - [手动编辑](#手动编辑)
- [请求头](#请求头)
  - [自动补全](#自动补全)
- [请求体](#请求体)
- [响应面板](#响应面板)
- [cURL 导入与导出](#curl-导入与导出)
  - [导入 cURL](#导入-curl)
  - [导出 cURL](#导出-curl)
- [请求历史](#请求历史)
- [设置](#设置)
  - [语言](#语言)
  - [主题](#主题)
  - [拖拽分割线](#拖拽分割线)
  - [本地存储](#本地存储)
  - [历史记录保留](#历史记录保留)
  - [快捷键](#快捷键)

---

## 快速开始

### 从源码构建

```bash
# 安装依赖
npm install

# 启动开发模式
npm run tauri dev
```

### 项目结构

```plain text
APILite/
├── src-tauri/           # Rust 后端
│   ├── src/
│   │   ├── main.rs          # Tauri 入口与命令注册
│   │   ├── curl_parser.rs   # cURL 命令解析
│   │   ├── curl_export.rs   # cURL 命令生成
│   │   ├── http_client.rs   # HTTP 请求引擎
│   │   ├── histories.rs     # 历史记录持久化（按日分片）
│   │   ├── storage.rs       # 数据目录结构
│   │   ├── environments.rs  # 环境变量文件
│   │   └── collections.rs   # API 集合文件
│   ├── Cargo.toml
│   └── tauri.conf.json
├── frontend/            # React + TypeScript 前端
│   └── src/
│       ├── App.tsx
│       ├── components/      # UI 组件
│       ├── store/           # Zustand 状态管理
│       ├── i18n.ts          # 国际化
│       ├── themes.ts        # 主题定义
│       └── constants.ts     # 请求头提示
└── docs/                # 文档
```

---

## 界面概览

APILite 界面由以下几个主要区域组成：

1. **顶栏** — 显示应用名称和设置按钮（⚙）。
2. **集合** — 列出所有集合和文件夹。
3. **地址栏** — HTTP 方法选择器、URL 输入框、cURL 导入/导出按钮和发送按钮。
4. **请求编辑器** — 选项卡面板，包含「参数」「请求头」「请求体」三个标签页。
5. **响应面板** — 显示响应状态码、耗时、响应体和响应头。
6. **历史面板** — 列出最近的请求记录，方便快速复用。

---

## 发送请求

### 发送步骤

1. 从下拉菜单选择 HTTP 方法（GET、POST、PUT、PATCH、DELETE、HEAD、OPTIONS）。
2. 在地址栏输入请求 URL。
3. 可选：通过下方标签页配置参数、请求头或请求体。
4. 点击 **发送** 按钮或按 **⌘ Enter**（macOS）/ **Ctrl+Enter**（Windows 与 Linux）。

### URL 输入

地址栏支持以下格式：

- 标准 HTTP/HTTPS URL（如 `https://httpbin.org/get`）
- 带查询参数的 URL（如 `https://httpbin.org/get?foo=bar&baz=qux`）
- cURL 命令（粘贴以 `curl` 开头的文本时自动识别）

---

## 查询参数

### 自动识别

当输入带查询字符串的 URL（如 `?key1=val1&key2=val2`）时，APILite 会自动解析并填充到**参数**表格中。

### 手动编辑

切换到**参数**标签页，可以：

- **添加**参数：点击"+ 添加参数"
- **编辑**参数：直接在键/值单元格中输入
- **删除**参数：点击 × 按钮
- **启用/禁用**参数：使用复选框

参数表格中的修改会实时同步到地址栏。

---

## 请求头

切换到**请求头**标签页可以配置请求头。

### 自动补全

在键名输入框中输入时，APILite 会从内置的常用 HTTP 请求头列表中弹出匹配建议：

| 请求头          | 说明                     |
| --------------- | ------------------------ |
| `Accept`        | 客户端可接受的媒体类型   |
| `Content-Type`  | 请求体媒体类型           |
| `Authorization` | 认证凭据（Bearer Token） |
| `User-Agent`    | 客户端软件标识           |
| `Cookie`        | HTTP Cookie              |
| `Origin`        | 请求来源（CORS）         |
| `X-Api-Key`     | API 密钥认证             |

使用方向键浏览建议，按 Enter 选择。

---

## 请求体

切换到**请求体**标签页可以配置请求体。支持以下格式：

| 格式                      | Content-Type                        | 说明                          |
| ------------------------- | ----------------------------------- | ----------------------------- |
| **无**                    | —                                   | 不发送请求体                  |
| **原始**                  | —                                   | 原始文本，不设置 Content-Type |
| **JSON**                  | `application/json`                  | JSON 格式数据                 |
| **XML**                   | `application/xml`                   | XML 格式数据                  |
| **文本**                  | `text/plain`                        | 纯文本                        |
| **HTML**                  | `text/html`                         | HTML 内容                     |
| **表单数据**              | `multipart/form-data`               | 键值表格，支持文本或文件字段  |
| **x-www-form-urlencoded** | `application/x-www-form-urlencoded` | 键值表格，自动 URL 编码       |
| **二进制**                | `application/octet-stream`          | 单个文件作为原始请求体        |

**表单数据**与 **x-www-form-urlencoded** 在请求体标签页通过键值表编辑（勾选启用）。文件字段可选取本地文件（桌面端为系统对话框，浏览器为文件选择器）。**原始** 子类型（JSON、XML 等）提供占位模板。

---

## 响应面板

发送请求后，响应面板显示：

- **状态码** — 彩色标签（2xx 绿色、3xx 黄色、4xx/5xx 红色）
- **耗时** — 响应时间（毫秒）
- **响应体** — 自动格式化 JSON 的响应内容
- **响应头** — 响应头的键值表格

---

## cURL 导入与导出

### 导入 cURL

1. 点击地址栏旁的 **`{}`** 按钮。
2. 在弹窗中粘贴完整的 cURL 命令。
3. 点击**导入**。

APILite 会解析命令并填充：

- HTTP 方法（`-X`）
- URL
- 请求头（`-H`）
- 请求体（`-d`、`--data`、`--data-raw`、`--data-binary`、`--data-urlencode`）

### 导出 cURL

1. 配置好请求（方法、URL、参数、请求头、请求体）。
2. 点击地址栏旁的 **`→_`** 按钮。
3. 查看并复制生成的 cURL 命令。

导出时自动包含：

- 非 GET 请求的 `-X` 参数
- 带参数的完整 URL
- 请求头（`-H`）
- 请求体（`-d`、`--data-binary`，表单文件字段为 `-F`）
- JSON/XML 等格式在缺少时自动补全 `Content-Type` 请求头

---

## 请求历史

窗口底部的历史面板记录最近发送的请求：

- **时间** — 请求发送时间
- **方法** — 彩色 HTTP 方法标签
- **URL** — 完整请求 URL
- **状态** — 响应状态码

展开行可查看原始请求与响应。点击 **加载更多** 分批载入更早记录（每次 50 条）。历史保存在数据目录下的按日文件（`histories/YYYY-MM-DD.json`），可在 **设置** 中配置保留天数与条数上限。

---

## 设置

点击 ⚙ 图标或按 **⌘ ,**（macOS）/ **Ctrl+,**（Windows 与 Linux）打开设置面板。

### 语言

选择 **English** 或 **中文**，切换后界面文本即时更新。

### 主题

内置五种主题：

| 主题               | 说明                    |
| ------------------ | ----------------------- |
| **Dark**           | 默认暗色主题，深蓝基调  |
| **Light**          | 干净的白底浅灰主题      |
| **Nord**           | 北极冷色调配色          |
| **Solarized Dark** | 经典 Solarized 深色方案 |
| **Monokai**        | 编辑器风格的深色主题    |

### 拖拽分割线

请求编辑器与响应面板之间有一条可拖拽的分割线。鼠标按住向上/向下拖动可调整响应面板高度，最高不能超过地址栏和标签栏区域，最小不低于 100px。拖动结束后高度自动保存。

### 本地存储

选择应用数据目录（默认 `~/.APILite`），自动创建：

- `collections/` — API 集合
- `histories/` — 请求历史（按日一个 JSON 文件）
- `environments.json` — 环境变量

### 历史记录保留

可设置最长保留天数与最大条数，超出部分会从磁盘自动清理。

### 快捷键

为常用操作配置自定义快捷键。点击 **重置快捷键** 恢复默认值，点击 **重置全部** 清除所有设置。

在 macOS 上默认使用 **⌘（Command）**，在 Windows 与 Linux 上默认使用 **Ctrl**（应用会按平台自动选择修饰键）。在 Tauri 桌面版中，相同组合会出现在菜单栏 **APILite** / **Tab** 中，且仅在当前应用获得焦点时生效。

| 操作         | macOS   | Windows / Linux   |
| ------------ | ------- | ----------------- |
| 发送请求     | ⌘ Enter | Ctrl+Enter        |
| 保存请求     | ⌘ S     | Ctrl+S            |
| 导入 cURL    | ⌘ ⇧ I   | Ctrl+Shift+I      |
| 导出 cURL    | ⌘ ⇧ E   | Ctrl+Shift+E      |
| 聚焦地址栏   | ⌘ L     | Ctrl+L            |
| 聚焦集合搜索 | ⌘ ⇧ F   | Ctrl+Shift+F      |
| 打开设置     | ⌘ ,     | Ctrl+,            |
| 新建标签     | ⌘ T     | Ctrl+T            |
| 关闭标签     | ⌘ W     | Ctrl+W            |
| 上一个标签   | ⌘ ⌥ ←   | Ctrl+Alt+左方向键 |
| 下一个标签   | ⌘ ⌥ →   | Ctrl+Alt+右方向键 |

所有快捷键均可在 **设置** 面板中自定义。
