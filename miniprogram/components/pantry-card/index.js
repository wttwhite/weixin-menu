Component({
  properties: {
    item: {
      type: Object,
      value: null
    }
  },

  methods: {
    handleTap() {
      this.triggerEvent('select', {
        pantryItemId: this.properties.item ? this.properties.item._id : ''
      })
    }
  }
})
