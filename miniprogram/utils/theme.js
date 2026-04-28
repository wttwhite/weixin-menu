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
      '--shadow-soft': '0 18rpx 40rpx rgba(63, 50, 38, 0.08)',
      '--hero-soft-start': '#fff1e4',
      '--hero-soft-end': '#f1d7bb',
      '--hero-soft-glow': 'rgba(255, 255, 255, 0.48)',
      '--hero-soft-glow-weak': 'rgba(255, 255, 255, 0.24)',
      '--hero-soft-text': '#5a381d',
      '--hero-soft-subtle': '#b27c53',
      '--hero-soft-chip-bg': 'rgba(255, 255, 255, 0.62)',
      '--hero-soft-chip-border': 'rgba(255, 255, 255, 0.34)',
      '--hero-soft-panel-bg': 'rgba(255, 255, 255, 0.55)'
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
      '--brand': '#2e7d32',
      '--brand-strong': '#1b5e20',
      '--text-primary': '#1f3125',
      '--text-secondary': '#5e7765',
      '--text-tertiary': '#86a08d',
      '--border-soft': 'rgba(39, 65, 49, 0.12)',
      '--success': '#2f8a54',
      '--danger': '#b85a49',
      '--shadow-soft': '0 18rpx 40rpx rgba(39, 65, 49, 0.08)',
      '--hero-soft-start': '#e6f7e8',
      '--hero-soft-end': '#cce9d4',
      '--hero-soft-glow': 'rgba(255, 255, 255, 0.5)',
      '--hero-soft-glow-weak': 'rgba(255, 255, 255, 0.24)',
      '--hero-soft-text': '#25533a',
      '--hero-soft-subtle': '#5c8c6d',
      '--hero-soft-chip-bg': 'rgba(255, 255, 255, 0.64)',
      '--hero-soft-chip-border': 'rgba(255, 255, 255, 0.34)',
      '--hero-soft-panel-bg': 'rgba(255, 255, 255, 0.58)'
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
      '--shadow-soft': '0 18rpx 40rpx rgba(74, 48, 32, 0.08)',
      '--hero-soft-start': '#fff0dc',
      '--hero-soft-end': '#f5d2ac',
      '--hero-soft-glow': 'rgba(255, 255, 255, 0.48)',
      '--hero-soft-glow-weak': 'rgba(255, 255, 255, 0.22)',
      '--hero-soft-text': '#623717',
      '--hero-soft-subtle': '#b67843',
      '--hero-soft-chip-bg': 'rgba(255, 255, 255, 0.64)',
      '--hero-soft-chip-border': 'rgba(255, 255, 255, 0.34)',
      '--hero-soft-panel-bg': 'rgba(255, 255, 255, 0.54)'
    }
  },
  'tech-blue': {
    label: '冷调科技蓝',
    description: '更利落的冷色界面',
    vars: {
      '--page-bg': '#eaf1f8',
      '--surface-bg': '#f8fbff',
      '--surface-muted': '#d9e4ef',
      '--surface-strong': '#203447',
      '--brand': '#5c86b1',
      '--brand-strong': '#456d98',
      '--text-primary': '#1d2a36',
      '--text-secondary': '#617384',
      '--text-tertiary': '#8da0b2',
      '--border-soft': 'rgba(32, 52, 71, 0.12)',
      '--success': '#2f7d6a',
      '--danger': '#ba5f66',
      '--shadow-soft': '0 18rpx 40rpx rgba(32, 52, 71, 0.08)',
      '--hero-soft-start': '#dcecff',
      '--hero-soft-end': '#bdd9f6',
      '--hero-soft-glow': 'rgba(255, 255, 255, 0.5)',
      '--hero-soft-glow-weak': 'rgba(255, 255, 255, 0.26)',
      '--hero-soft-text': '#204361',
      '--hero-soft-subtle': '#5a7fa3',
      '--hero-soft-chip-bg': 'rgba(255, 255, 255, 0.66)',
      '--hero-soft-chip-border': 'rgba(255, 255, 255, 0.34)',
      '--hero-soft-panel-bg': 'rgba(255, 255, 255, 0.58)'
    }
  },
  'sea-salt-blue': {
    label: '海盐蓝',
    description: '偏轻盈的浅海配色',
    vars: {
      '--page-bg': '#edf5f7',
      '--surface-bg': '#fbfeff',
      '--surface-muted': '#d9eaee',
      '--surface-strong': '#2a4852',
      '--brand': '#5d93a6',
      '--brand-strong': '#3f6f7f',
      '--text-primary': '#233940',
      '--text-secondary': '#617b85',
      '--text-tertiary': '#8ca5ae',
      '--border-soft': 'rgba(42, 72, 82, 0.12)',
      '--success': '#3a866f',
      '--danger': '#c06963',
      '--shadow-soft': '0 18rpx 40rpx rgba(42, 72, 82, 0.08)',
      '--hero-soft-start': '#dff4f8',
      '--hero-soft-end': '#bfe2ea',
      '--hero-soft-glow': 'rgba(255, 255, 255, 0.5)',
      '--hero-soft-glow-weak': 'rgba(255, 255, 255, 0.24)',
      '--hero-soft-text': '#24525e',
      '--hero-soft-subtle': '#5e8e9a',
      '--hero-soft-chip-bg': 'rgba(255, 255, 255, 0.66)',
      '--hero-soft-chip-border': 'rgba(255, 255, 255, 0.34)',
      '--hero-soft-panel-bg': 'rgba(255, 255, 255, 0.58)'
    }
  },
  'sakura-pink': {
    label: '樱花粉',
    description: '更柔和的暖粉配色',
    vars: {
      '--page-bg': '#fbf1f4',
      '--surface-bg': '#fffafb',
      '--surface-muted': '#f2dfe6',
      '--surface-strong': '#513741',
      '--brand': '#d58aa2',
      '--brand-strong': '#b96884',
      '--text-primary': '#3a2830',
      '--text-secondary': '#7c626d',
      '--text-tertiary': '#aa8e99',
      '--border-soft': 'rgba(81, 55, 65, 0.12)',
      '--success': '#4b8b6b',
      '--danger': '#cb6f78',
      '--shadow-soft': '0 18rpx 40rpx rgba(81, 55, 65, 0.08)',
      '--hero-soft-start': '#fbe7ef',
      '--hero-soft-end': '#efcad9',
      '--hero-soft-glow': 'rgba(255, 255, 255, 0.52)',
      '--hero-soft-glow-weak': 'rgba(255, 255, 255, 0.28)',
      '--hero-soft-text': '#5b3f5b',
      '--hero-soft-subtle': '#a07ca1',
      '--hero-soft-chip-bg': 'rgba(255, 255, 255, 0.68)',
      '--hero-soft-chip-border': 'rgba(255, 255, 255, 0.36)',
      '--hero-soft-panel-bg': 'rgba(255, 255, 255, 0.6)'
    }
  },
  'muted-gray-purple': {
    label: '低饱和灰紫',
    description: '更安静的雾紫配色',
    vars: {
      '--page-bg': '#f1eff5',
      '--surface-bg': '#fbfaff',
      '--surface-muted': '#e1ddea',
      '--surface-strong': '#40384c',
      '--brand': '#8b80a8',
      '--brand-strong': '#6b6288',
      '--text-primary': '#2e2838',
      '--text-secondary': '#6f687d',
      '--text-tertiary': '#9b94aa',
      '--border-soft': 'rgba(64, 56, 76, 0.12)',
      '--success': '#4a8667',
      '--danger': '#b86476',
      '--shadow-soft': '0 18rpx 40rpx rgba(64, 56, 76, 0.08)',
      '--hero-soft-start': '#efeaf8',
      '--hero-soft-end': '#d8d0ea',
      '--hero-soft-glow': 'rgba(255, 255, 255, 0.5)',
      '--hero-soft-glow-weak': 'rgba(255, 255, 255, 0.24)',
      '--hero-soft-text': '#4e4465',
      '--hero-soft-subtle': '#8879a0',
      '--hero-soft-chip-bg': 'rgba(255, 255, 255, 0.66)',
      '--hero-soft-chip-border': 'rgba(255, 255, 255, 0.34)',
      '--hero-soft-panel-bg': 'rgba(255, 255, 255, 0.58)'
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
    swatches: [
      value.vars['--brand'],
      value.vars['--brand-strong'],
      value.vars['--hero-soft-start']
    ],
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
