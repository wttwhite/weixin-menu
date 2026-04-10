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
        recipeId: this.properties.item ? this.properties.item._id : ''
      })
    },

    handleEditTap() {
      this.triggerEvent('edit', {
        recipeId: this.properties.item ? this.properties.item._id : ''
      })
    }
  }
})
