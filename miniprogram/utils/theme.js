const DEFAULT_THEME_KEY = 'default'

const THEMES = {
  default: {
    label: '奶油暖色',
    description: '柔和厨房色',
    vars: {
      '--page-bg': '#f5f1e8',
      '--surface-bg': '#fffaf0',
      '--surface-muted': '#efe3cf',
      '--surface-strong': '#3f3226',
      '--brand': '#c56a3d',
      '--brand-strong': '#a34e24',
      '--text-primary': '#2f241c',
      '--text-secondary': '#70594a',
      '--text-tertiary': '#977d6c',
      '--border-soft': 'rgba(63, 50, 38, 0.12)',
      '--success': '#2f7d4a',
      '--danger': '#b64a3a',
      '--shadow-soft': '0 18rpx 40rpx rgba(63, 50, 38, 0.08)'
    }
  },
  'fresh-green': {
    label: '清新浅绿',
    description: '更轻盈的整理感',
    vars: {
      '--page-bg': '#eef7ef',
      '--surface-bg': '#fcfffb',
      '--surface-muted': '#dcebdf',
      '--surface-strong': '#274131',
      '--brand': '#56a36c',
      '--brand-strong': '#35754a',
      '--text-primary': '#1f3125',
      '--text-secondary': '#5e7765',
      '--text-tertiary': '#86a08d',
      '--border-soft': 'rgba(39, 65, 49, 0.12)',
      '--success': '#2f8a54',
      '--danger': '#b85a49',
      '--shadow-soft': '0 18rpx 40rpx rgba(39, 65, 49, 0.08)'
    }
  },
  amber: {
    label: '暖橙琥珀',
    description: '更有温度的餐厨氛围',
    vars: {
      '--page-bg': '#fbf2e8',
      '--surface-bg': '#fffaf6',
      '--surface-muted': '#f3e1ce',
      '--surface-strong': '#4a3020',
      '--brand': '#d28441',
      '--brand-strong': '#a95c1f',
      '--text-primary': '#352216',
      '--text-secondary': '#7d5a43',
      '--text-tertiary': '#ad866d',
      '--border-soft': 'rgba(74, 48, 32, 0.12)',
      '--success': '#3d8654',
      '--danger': '#c25a43',
      '--shadow-soft': '0 18rpx 40rpx rgba(74, 48, 32, 0.08)'
    }
  }
}

function resolveThemeKey(themeKey = '') {
  return Object.prototype.hasOwnProperty.call(THEMES, themeKey) ? themeKey : DEFAULT_THEME_KEY
}

function getTheme(themeKey = '') {
  return THEMES[resolveThemeKey(themeKey)]
}

function buildThemeStyle(themeKey = '') {
  return Object.entries(getTheme(themeKey).vars)
    .map(([key, value]) => `${key}: ${value};`)
    .join(' ')
}

function getThemeOptions(activeThemeKey = DEFAULT_THEME_KEY) {
  return Object.entries(THEMES).map(([key, value]) => ({
    key,
    label: value.label,
    description: value.description,
    active: key === resolveThemeKey(activeThemeKey)
  }))
}

function readAppThemeState(appInstance) {
  const app =
    appInstance ||
    (typeof getApp === 'function' ? getApp() : null)
  const themeKey = resolveThemeKey(app && app.globalData ? app.globalData.themeKey : '')
  return {
    themeKey,
    themeStyle: buildThemeStyle(themeKey)
  }
}

function syncPageTheme(page, appInstance) {
  if (!page || typeof page.setData !== 'function') {
    return readAppThemeState(appInstance)
  }
  const nextTheme = readAppThemeState(appInstance)
  page.setData(nextTheme)
  return nextTheme
}

module.exports = {
  DEFAULT_THEME_KEY,
  buildThemeStyle,
  getTheme,
  getThemeOptions,
  readAppThemeState,
  resolveThemeKey,
  syncPageTheme
}
