const { createShoppingService } = require('../../services/shopping')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')

function findPreviousPageByRoute(route = '') {
  if (typeof getCurrentPages !== 'function') {
    return null
  }

  const pages = getCurrentPages()
  if (!Array.isArray(pages) || pages.length < 2) {
    return null
  }

  for (let index = pages.length - 2; index >= 0; index -= 1) {
    const page = pages[index] || null
    if (!page) {
      continue
    }
    if ((page.route || '') === route) {
      return page
    }
  }

  return null
}

function markShoppingPageForRefresh() {
  const shoppingPage = findPreviousPageByRoute('pages/shopping/index')
  if (!shoppingPage || typeof shoppingPage.markNeedsRefreshOnNextShow !== 'function') {
    return false
  }

  shoppingPage.markNeedsRefreshOnNextShow()
  return true
}

Page({
  data: {
    loading: false,
    submitting: false,
    activeSpaceId: '',
    shoppingListId: '',
    shoppingListUpdatedAt: '',
    shoppingItemId: '',
    shoppingItemUpdatedAt: '',
    isEdit: false,
    form: {
      name: '',
      quantity: '',
      unit: '',
      notes: ''
    }
  },

  onLoad(options) {
    const shoppingListId = (options && options.shoppingListId) || ''
    const shoppingItemId = (options && options.shoppingItemId) || ''
    this.setData({
      activeSpaceId: getActiveSpaceId(),
      shoppingListId,
      shoppingListUpdatedAt: decodeURIComponent((options && options.shoppingListUpdatedAt) || ''),
      shoppingItemId,
      shoppingItemUpdatedAt: decodeURIComponent((options && options.updatedAt) || ''),
      isEdit: Boolean(shoppingItemId),
      form: {
        name: decodeURIComponent((options && options.name) || ''),
        quantity: decodeURIComponent((options && options.quantity) || ''),
        unit: decodeURIComponent((options && options.unit) || ''),
        notes: decodeURIComponent((options && options.notes) || '')
      }
    })
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: event.detail.value
    })
  },

  async submit() {
    if (this.data.submitting || !this.data.activeSpaceId || !this.data.shoppingListId) {
      return
    }
    if (!this.data.form.name.trim()) {
      wx.showToast({
        title: '请输入采购项名称',
        icon: 'none'
      })
      return
    }

    this.setData({
      submitting: true
    })

    try {
      await createShoppingService().updateShoppingList(
        this.data.activeSpaceId,
        this.data.shoppingListId,
        {
          itemDraft: {
            shoppingItemId: this.data.shoppingItemId || '',
            expectedUpdatedAt: this.data.shoppingItemUpdatedAt || '',
            name: this.data.form.name,
            quantity: this.data.form.quantity,
            unit: this.data.form.unit,
            notes: this.data.form.notes,
            sourceType: 'manual'
          }
        },
        this.data.shoppingListUpdatedAt || ''
      )
      markShoppingPageForRefresh()
      wx.showToast({
        title: this.data.isEdit ? '已更新采购项' : '已添加采购项',
        icon: 'success'
      })
      wx.navigateBack()
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({
        submitting: false
      })
    }
  }
})
