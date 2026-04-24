function getTouchPayload(event = {}) {
  return {
    touches: Array.isArray(event.touches) ? event.touches : [],
    changedTouches: Array.isArray(event.changedTouches) ? event.changedTouches : []
  }
}

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    loading: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: '分类管理'
    },
    inputPlaceholder: {
      type: String,
      value: '输入分类名称'
    },
    inputValue: {
      type: String,
      value: ''
    },
    draggingIndex: {
      type: Number,
      value: -1
    },
    items: {
      type: Array,
      value: []
    }
  },

  methods: {
    noop() {},

    handleClose() {
      this.triggerEvent('close')
    },

    handleInput(event) {
      this.triggerEvent('inputchange', {
        value: event && event.detail ? event.detail.value : ''
      })
    },

    handleSubmit() {
      this.triggerEvent('submit')
    },

    handleRename(event) {
      const name = event && event.currentTarget && event.currentTarget.dataset
        ? event.currentTarget.dataset.name || ''
        : ''
      this.triggerEvent('rename', {
        name
      })
    },

    handleDelete(event) {
      const dataset = event && event.currentTarget ? event.currentTarget.dataset || {} : {}
      this.triggerEvent('delete', {
        name: dataset.name || '',
        deletable: dataset.deletable === true || dataset.deletable === 'true'
      })
    },

    handleDragStart(event) {
      const dataset = event && event.currentTarget ? event.currentTarget.dataset || {} : {}
      this.triggerEvent('dragstart', {
        index: Number(dataset.index),
        ...getTouchPayload(event)
      })
    },

    handleDragMove(event) {
      this.triggerEvent('dragmove', getTouchPayload(event))
    },

    handleDragEnd(event) {
      this.triggerEvent('dragend', getTouchPayload(event))
    },

    handleDragCancel(event) {
      this.triggerEvent('dragcancel', getTouchPayload(event))
    }
  }
})
