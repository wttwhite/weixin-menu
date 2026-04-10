const { createPantryService } = require('../../services/pantry')
const { getErrorMessage } = require('../../utils/error')

function getActiveSpaceId() {
  const app = getApp()
  return app.globalData.activeSpaceId || ''
}

function createEmptyForm() {
  return {
    name: '',
    category: '',
    quantity: '1',
    unit: '',
    location: '',
    expirationDate: '',
    notes: ''
  }
}

function getTodayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

Page({
  data: {
    loading: true,
    submitting: false,
    deleting: false,
    isEdit: false,
    loadErrorMessage: '',
    pantryItemId: '',
    activeSpaceId: '',
    today: getTodayDate(),
    form: createEmptyForm()
  },

  onLoad(options) {
    const pantryItemId = options && options.pantryItemId ? options.pantryItemId : ''
    const activeSpaceId = getActiveSpaceId()

    this.setData({
      pantryItemId,
      isEdit: Boolean(pantryItemId),
      activeSpaceId,
      loadErrorMessage: ''
    })

    if (!activeSpaceId) {
      this.setData({ loading: false })
      return
    }

    if (!pantryItemId) {
      this.setData({ loading: false })
      return
    }

    this.loadItem(activeSpaceId, pantryItemId)
  },

  async loadItem(spaceId, pantryItemId) {
    this.setData({
      loading: true,
      loadErrorMessage: ''
    })

    try {
      const result = await createPantryService().getPantryItem(spaceId, pantryItemId)
      const matched = result.item || {}

      this.setData({
        loading: false,
        loadErrorMessage: '',
        form: {
          name: matched.name || '',
          category: matched.category || '',
          quantity: matched.quantity || '1',
          unit: matched.unit || '',
          location: matched.location || '',
          expirationDate: matched.expirationDate || '',
          notes: matched.notes || ''
        }
      })
    } catch (error) {
      this.setData({
        loading: false,
        loadErrorMessage: getErrorMessage(error),
        form: createEmptyForm()
      })
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: event.detail.value
    })
  },

  handleExpirationChange(event) {
    this.setData({
      'form.expirationDate': event.detail.value
    })
  },

  clearExpirationDate() {
    this.setData({
      'form.expirationDate': ''
    })
  },

  async submit() {
    if (
      this.data.submitting ||
      !this.data.activeSpaceId ||
      this.data.loading ||
      (this.data.isEdit && this.data.loadErrorMessage)
    ) {
      return
    }

    this.setData({ submitting: true })

    try {
      const service = createPantryService()
      if (this.data.isEdit) {
        await service.updatePantryItem(
          this.data.activeSpaceId,
          this.data.pantryItemId,
          this.data.form
        )
      } else {
        await service.createPantryItem(this.data.activeSpaceId, this.data.form)
      }

      wx.showToast({
        title: this.data.isEdit ? '已更新库存' : '已添加库存',
        icon: 'success'
      })
      wx.navigateBack()
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  async removeItem() {
    if (
      !this.data.isEdit ||
      this.data.deleting ||
      this.data.loading ||
      this.data.loadErrorMessage
    ) {
      return
    }

    const modalResult = await wx.showModal({
      title: '移出库存',
      content: '确认删除这个库存项吗？',
      confirmColor: '#b44343'
    })
    if (!modalResult.confirm) {
      return
    }

    this.setData({ deleting: true })

    try {
      await createPantryService().deletePantryItem(
        this.data.activeSpaceId,
        this.data.pantryItemId
      )
      wx.showToast({
        title: '已移出库存',
        icon: 'success'
      })
      wx.navigateBack()
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({ deleting: false })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})
