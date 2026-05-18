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
    'app.response.placeholder': 'Send a request to see the response',

    // URL Bar
    'url.placeholder': 'Enter request URL or paste curl command',
    'url.import': 'Import cURL',
    'url.export': 'Export cURL',
    'url.send': 'Send',
    'url.sending': 'Sending...',
    'url.import.title': 'Import cURL',
    'url.export.title': 'Export cURL',
    'url.import.placeholder': 'curl -X POST \'https://example.com/api\' -H \'Content-Type: application/json\' -d \'{"key":"value"}\'',
    'url.cancel': 'Cancel',
    'url.copy': 'Copy to Clipboard',
    'url.importBtn': 'Import',

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
    'env.deleteCol': 'Remove env',
    'env.modalDone': 'Done',
    'env.sidebarTitle': 'Environments',
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
    'body.binary': 'Binary body: select a file via the request form. (Coming soon)',
    'body.placeholder.json': '{\n  "key": "value"\n}',
    'body.placeholder.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <key>value</key>\n</root>',
    'body.placeholder.text': 'Enter text content...',
    'body.placeholder.html': '<!DOCTYPE html>\n<html>\n  <body>Hello</body>\n</html>',
    'body.placeholder.javascript': '// Enter JavaScript code...',
    'body.formHint': 'Form-data and x-www-form-urlencoded body types are supported via the Params table.',
    'body.urlencodedHint': 'Encode key-value pairs in the request body.',
    'body.useParamsLink': 'Use Params tab',
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

    // Settings
    'settings.theme': 'Theme',
    'settings.shortcuts': 'Keyboard Shortcuts',
    'settings.resetShortcuts': 'Reset Shortcuts',
    'settings.resetAll': 'Reset All',
    'settings.collection.select': 'Select',
    'settings.collection.clear': 'Clear',
    'settings.collection.notSet': 'No directory selected',
    'settings.request': 'Request',
    'settings.autoProtocol': 'Auto-complete http://',
    'settings.language': 'Language',

    // Shortcut labels
    'shortcut.sendRequest': 'Send Request',
    'shortcut.saveRequest': 'Save Request',
    'shortcut.importCurl': 'Import cURL',
    'shortcut.exportCurl': 'Export cURL',
    'shortcut.focusUrl': 'Focus URL Bar',
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
    'app.response.placeholder': '发送请求以查看响应',

    // URL Bar
    'url.placeholder': '输入请求 URL 或粘贴 curl 命令',
    'url.import': '导入 cURL',
    'url.export': '导出 cURL',
    'url.send': '发送',
    'url.sending': '发送中...',
    'url.import.title': '导入 cURL',
    'url.export.title': '导出 cURL',
    'url.import.placeholder': 'curl -X POST \'https://example.com/api\' -H \'Content-Type: application/json\' -d \'{"key":"value"}\'',
    'url.cancel': '取消',
    'url.copy': '复制到剪贴板',
    'url.importBtn': '导入',

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
    'env.deleteCol': '删除环境',
    'env.modalDone': '完成',
    'env.sidebarTitle': '环境',
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
    'body.binary': '二进制请求体：通过请求表单选择文件（即将推出）',
    'body.placeholder.json': '{\n  "key": "value"\n}',
    'body.placeholder.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <key>value</key>\n</root>',
    'body.placeholder.text': '输入文本内容...',
    'body.placeholder.html': '<!DOCTYPE html>\n<html>\n  <body>Hello</body>\n</html>',
    'body.placeholder.javascript': '// 输入 JavaScript 代码...',
    'body.formHint': '表单数据和 x-www-form-urlencoded 格式可通过参数表格添加。',
    'body.urlencodedHint': '在请求体中编码键值对。',
    'body.useParamsLink': '使用参数表格',
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

    // Settings
    'settings.theme': '主题',
    'settings.shortcuts': '快捷键',
    'settings.resetShortcuts': '重置快捷键',
    'settings.resetAll': '重置全部',
    'settings.collection.select': '选择',
    'settings.collection.clear': '清除',
    'settings.collection.notSet': '未选择目录',
    'settings.request': '请求',
    'settings.autoProtocol': '自动补全 http://',
    'settings.language': '语言',

    // Shortcut labels
    'shortcut.sendRequest': '发送请求',
    'shortcut.saveRequest': '保存请求',
    'shortcut.importCurl': '导入 cURL',
    'shortcut.exportCurl': '导出 cURL',
    'shortcut.focusUrl': '聚焦地址栏',
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
