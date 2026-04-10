Component({
  properties: {
    tagId: {
      type: String,
      value: ''
    },
    text: {
      type: String,
      value: ''
    },
    color: {
      type: String,
      value: '#E6A23C'
    },
    selected: {
      type: Boolean,
      value: false
    },
    plain: {
      type: Boolean,
      value: false
    },
    removable: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    handleTap() {
      this.triggerEvent('select', {
        tagId: this.properties.tagId
      })
    },

    handleRemoveTap() {
      this.triggerEvent('remove', {
        tagId: this.properties.tagId
      })
    }
  }
})
