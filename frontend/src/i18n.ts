export type Locale = 'en' | 'zh';

export const defaultLocale: Locale = 'en';

const messages: Record<Locale, Record<string, string>> = {
  en: {
    // App
    'app.name': 'APILite',
    'app.collections': 'Collections',
    'app.collections.comingSoon': 'Collections coming in next update',
    'app.settings': 'Settings',
    'app.toggleCollections': 'Toggle collections sidebar',
    'app.toggleCurlPanel': 'Toggle cURL panel',
    'app.response.placeholder': 'Send a request to see the response',
    'app.noTab': 'No open request. Click + to create a tab, or open one from Collections.',

    // URL Bar
    'url.placeholder': 'Enter request URL or paste curl command',
    'url.export': 'Export cURL',
    'url.send': 'Send',
    'url.sending': 'Sending...',
    'url.export.title': 'Export cURL',
    'url.cancel': 'Cancel',
    'url.copy': 'Copy to Clipboard',
    'url.curlParseError': 'Failed to parse cURL',

    // cURL panel
    'curl.title': 'cURL',
    'curl.copy': 'Copy',
    'curl.copied': 'cURL copied to clipboard',
    'curl.copyFailed': 'Failed to copy',
    'curl.empty': 'Enter a URL to generate cURL',
    'curl.generating': 'Generating…',
    'curl.expand': 'Expand cURL panel',
    'curl.collapse': 'Collapse cURL panel',

    // Tabs
    'tab.params': 'Params',
    'tab.headers': 'Headers',
    'tab.body': 'Body',

    'env.active': 'Environment',
    'env.quickHint': 'Use {{name}} in URL, Params, Headers & Body. Values resolve on send.',
    'env.manage': 'Manage…',
    'env.modalTitle': 'Environment variables',
    'env.modalHint':
      'Each column is one environment; each row is one variable. Cell values can reference other variables in the same environment with {{other_var}} (e.g. {{base_url}}:8001). Resolution is multi-pass within the active environment before request substitution.',
    'env.varName': 'Variable',
    'env.addEnvColumn': '+ Environment',
    'env.addVarRow': '+ Variable',
    'env.dragRow': 'Drag to reorder variable',
    'env.dragCol': 'Drag to reorder environment',
    'env.contextMenu': 'Right-click a column header or variable row for copy and delete.',
    'env.copySuffix': 'copy',
    'env.modalDone': 'Done',
    'env.unnamed': '(unnamed)',
    'kv.key': 'Key',
    'kv.value': 'Value',
    'kv.addParam': '+ Add Parameter',
    'kv.addHeader': '+ Add Header',
    'kv.remove': 'Remove',

    // Body
    'body.type.none': 'None',
    'body.json.placeholder': 'Enter JSON body...',
    'saveRequest.title': 'Save Request',
    'saveRequest.name': 'Request Name',
    'saveRequest.folder': 'Save to Folder',
    'saveRequest.save': 'Save',
    'saveRequest.noFolders': 'No folders available',
    'saveRequest.createFolderHint': 'Create a folder in the collection sidebar first.',
    'body.type.raw': 'Raw',
    'body.type.json': 'JSON',
    'body.type.xml': 'XML',
    'body.type.text': 'Text',
    'body.type.html': 'HTML',
    'body.type.javascript': 'JavaScript',
    'body.type.form-data': 'Form Data',
    'body.type.urlencoded': 'x-www-form-urlencoded',
    'body.type.binary': 'Binary',
    'body.noBody': 'No body',
    'body.binaryHint': 'Send the selected file as the raw request body (application/octet-stream).',
    'body.selectFile': 'Select file',
    'body.clearFile': 'Clear',
    'body.noFile': 'No file selected',
    'body.fieldType': 'Type',
    'body.fieldType.text': 'Text',
    'body.fieldType.file': 'File',
    'body.fieldValue': 'Value',
    'body.addFormField': 'Add field',
    'body.addUrlEncodedField': 'Add field',
    'body.placeholder.json': '{\n  "key": "value"\n}',
    'body.placeholder.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <key>value</key>\n</root>',
    'body.placeholder.text': 'Enter text content...',
    'body.placeholder.html': '<!DOCTYPE html>\n<html>\n  <body>Hello</body>\n</html>',
    'body.placeholder.javascript': '// Enter JavaScript code...',
    'body.json.format': 'Format',
    'body.json.minify': 'Minify',
    'body.json.valid': 'JSON valid',
    'body.json.invalid': 'JSON invalid',

    // Response
    'response.body': 'Body',
    'response.headers': 'Headers',
    'response.raw': 'Raw',

    // History
    'history.label': 'History',
    'history.clear': 'Clear',
    'history.loadMore': 'Load more',
    'history.loadingMore': 'Loading…',
    'history.requestRaw': 'Request (raw)',
    'history.responseRaw': 'Response (raw)',

    // Settings
    'settings.theme': 'Theme',
    'settings.shortcuts': 'Keyboard Shortcuts',
    'settings.resetShortcuts': 'Reset Shortcuts',
    'settings.resetAll': 'Reset All',
    'settings.storage.title': 'Local storage',
    'settings.storage.hint': 'Choose a folder for app data. The following are created automatically:',
    'settings.storage.collections': 'API collections',
    'settings.storage.histories': 'request history',
    'settings.storage.environments': 'environment variables',
    'settings.storage.select': 'Choose folder',
    'settings.storage.clear': 'Reset to default',
    'settings.storage.notSet': 'Using default location (~/.APILite)',
    'settings.request': 'Request',
    'settings.autoProtocol': 'Auto-complete http://',
    'settings.language': 'Language',
    'settings.history.title': 'History retention',
    'settings.history.hint':
      'History is saved locally. Entries older than the age limit or beyond the max count are removed automatically.',
    'settings.history.maxAgeDays': 'Keep (days)',
    'settings.history.maxCount': 'Max entries',

    // Shortcut labels
    'shortcut.sendRequest': 'Send Request',
    'shortcut.saveRequest': 'Save Request',
    'shortcut.exportCurl': 'Toggle cURL Panel',
    'shortcut.focusUrl': 'Focus URL Bar',
    'shortcut.focusCollectionSearch': 'Focus Collection Search',
    'shortcut.toggleSettings': 'Open Settings',
    'shortcut.newTab': 'New Tab',
    'shortcut.closeTab': 'Close Tab',
    'shortcut.prevTab': 'Previous Tab',
    'shortcut.nextTab': 'Next Tab',

    // Collection
    'collection.title': 'Collections',
    'collection.addCollection': 'New collection',
    'collection.duplicateName': 'A collection with this name already exists',
    'collection.addFolder': 'New Folder',
    'collection.addRequest': 'New Request',
    'collection.rename': 'Rename',
    'collection.duplicate': 'Duplicate',
    'collection.delete': 'Delete',
    'collection.empty': 'No collections yet',
    'collection.searchPlaceholder': 'Search collections, folders, requests by name or URL…',
    'collection.searchNoResults': 'No matches',
    'collection.rename.placeholder': 'Enter name...',
    'collection.rename.confirm': 'Confirm',

    // Theme names
    'theme.dark': 'Dark',
    'theme.light': 'Light',
    'theme.nord': 'Nord',
    'theme.solarized': 'Solarized Dark',
    'theme.monokai': 'Monokai',
  },
  zh: {
    // App
    'app.name': 'APILite',
    'app.collections': '集合',
    'app.collections.comingSoon': '集合功能即将推出',
    'app.settings': '设置',
    'app.toggleCollections': '显示或隐藏集合侧边栏',
    'app.toggleCurlPanel': '显示或隐藏 cURL 面板',
    'app.response.placeholder': '发送请求以查看响应',
    'app.noTab': '当前没有打开的请求。点击 + 新建标签页，或从集合中打开。',

    // URL Bar
    'url.placeholder': '输入请求 URL 或粘贴 curl 命令',
    'url.export': '导出 cURL',
    'url.send': '发送',
    'url.sending': '发送中...',
    'url.export.title': '导出 cURL',
    'url.cancel': '取消',
    'url.copy': '复制到剪贴板',
    'url.curlParseError': 'cURL 解析失败',

    // cURL panel
    'curl.title': 'cURL',
    'curl.copy': '复制',
    'curl.copied': '已复制 cURL 到剪贴板',
    'curl.copyFailed': '复制失败',
    'curl.empty': '输入 URL 后生成 cURL',
    'curl.generating': '生成中…',
    'curl.expand': '展开 cURL 面板',
    'curl.collapse': '收起 cURL 面板',

    // Tabs
    'tab.params': '参数',
    'tab.headers': '请求头',
    'tab.body': '请求体',

    'env.active': '当前环境',
    'env.quickHint': '在地址、参数、请求头、请求体中可用 {{变量名}}，发送时替换。',
    'env.manage': '管理…',
    'env.modalTitle': '环境变量',
    'env.modalHint':
      '横向每一列是一个环境，纵向每一行是一个变量。单元格内可引用同一环境下其他变量，如 {{base_url}}:8001；先在当前环境内多轮解析，再用于请求中的 {{}}。',
    'env.varName': '变量名',
    'env.addEnvColumn': '+ 环境列',
    'env.addVarRow': '+ 变量行',
    'env.dragRow': '拖动以排序变量',
    'env.dragCol': '拖动以排序环境',
    'env.contextMenu': '在环境列标题或变量行上右键，可复制或删除。',
    'env.copySuffix': '副本',
    'env.modalDone': '完成',
    'env.unnamed': '（未命名）',
    'kv.key': '键',
    'kv.value': '值',
    'kv.addParam': '+ 添加参数',
    'kv.addHeader': '+ 添加请求头',
    'kv.remove': '移除',

    // Body
    'body.type.none': '无',
    'body.json.placeholder': '输入 JSON 请求体...',
    'saveRequest.title': '保存请求',
    'saveRequest.name': '请求名称',
    'saveRequest.folder': '保存到文件夹',
    'saveRequest.save': '保存',
    'saveRequest.noFolders': '暂无文件夹',
    'saveRequest.createFolderHint': '请先在集合侧边栏中创建文件夹。',
    'body.type.raw': '原始',
    'body.type.json': 'JSON',
    'body.type.xml': 'XML',
    'body.type.text': '文本',
    'body.type.html': 'HTML',
    'body.type.javascript': 'JavaScript',
    'body.type.form-data': '表单数据',
    'body.type.urlencoded': 'x-www-form-urlencoded',
    'body.type.binary': '二进制',
    'body.noBody': '无请求体',
    'body.binaryHint': '将所选文件作为原始请求体发送（application/octet-stream）。',
    'body.selectFile': '选择文件',
    'body.clearFile': '清除',
    'body.noFile': '未选择文件',
    'body.fieldType': '类型',
    'body.fieldType.text': '文本',
    'body.fieldType.file': '文件',
    'body.fieldValue': '值',
    'body.addFormField': '添加字段',
    'body.addUrlEncodedField': '添加字段',
    'body.placeholder.json': '{\n  "key": "value"\n}',
    'body.placeholder.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <key>value</key>\n</root>',
    'body.placeholder.text': '输入文本内容...',
    'body.placeholder.html': '<!DOCTYPE html>\n<html>\n  <body>Hello</body>\n</html>',
    'body.placeholder.javascript': '// 输入 JavaScript 代码...',
    'body.json.format': '格式化',
    'body.json.minify': '压缩',
    'body.json.valid': 'JSON 有效',
    'body.json.invalid': 'JSON 无效',

    // Response
    'response.body': '响应体',
    'response.headers': '响应头',
    'response.raw': '原始 HTTP',

    // History
    'history.label': '历史记录',
    'history.clear': '清空',
    'history.loadMore': '加载更多',
    'history.loadingMore': '加载中…',
    'history.requestRaw': '请求（原始）',
    'history.responseRaw': '响应（原始）',

    // Settings
    'settings.theme': '主题',
    'settings.shortcuts': '快捷键',
    'settings.resetShortcuts': '重置快捷键',
    'settings.resetAll': '重置全部',
    'settings.storage.title': '本地存储',
    'settings.storage.hint': '选择用于保存应用数据的文件夹，将自动创建以下内容：',
    'settings.storage.collections': 'API 集合',
    'settings.storage.histories': '请求历史',
    'settings.storage.environments': '环境变量',
    'settings.storage.select': '选择文件夹',
    'settings.storage.clear': '恢复默认',
    'settings.storage.notSet': '使用默认位置（~/.APILite）',
    'settings.request': '请求',
    'settings.autoProtocol': '自动补全 http://',
    'settings.language': '语言',
    'settings.history.title': '历史记录保留',
    'settings.history.hint':
      '历史记录保存在本地。超出保留天数或超过条数上限的旧记录会自动清理。',
    'settings.history.maxAgeDays': '保留天数',
    'settings.history.maxCount': '最多条数',

    // Shortcut labels
    'shortcut.sendRequest': '发送请求',
    'shortcut.saveRequest': '保存请求',
    'shortcut.exportCurl': '切换 cURL 面板',
    'shortcut.focusUrl': '聚焦地址栏',
    'shortcut.focusCollectionSearch': '聚焦集合搜索',
    'shortcut.toggleSettings': '打开设置',
    'shortcut.newTab': '新建标签',
    'shortcut.closeTab': '关闭标签',
    'shortcut.prevTab': '上一个标签',
    'shortcut.nextTab': '下一个标签',

    // Collection
    'collection.title': '集合',
    'collection.addCollection': '新建集合',
    'collection.duplicateName': '已存在同名集合',
    'collection.addFolder': '新建文件夹',
    'collection.addRequest': '新建请求',
    'collection.rename': '重命名',
    'collection.duplicate': '复制',
    'collection.delete': '删除',
    'collection.empty': '暂无集合',
    'collection.searchPlaceholder': '按集合、文件夹、请求名称或 URL 搜索…',
    'collection.searchNoResults': '没有匹配项',
    'collection.rename.placeholder': '输入名称...',
    'collection.rename.confirm': '确认',

    // Theme names
    'theme.dark': '暗色',
    'theme.light': '亮色',
    'theme.nord': 'Nord',
    'theme.solarized': 'Solarized Dark',
    'theme.monokai': 'Monokai',
  },
};

let currentLocale: Locale = defaultLocale;

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function t(key: string): string {
  return messages[currentLocale]?.[key] ?? messages.en[key] ?? key;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function getAvailableLocales(): { value: Locale; label: string }[] {
  return [
    { value: 'en', label: 'English' },
    { value: 'zh', label: '中文' },
  ];
}
