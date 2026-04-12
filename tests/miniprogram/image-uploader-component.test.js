import { beforeEach, describe, expect, it, vi } from 'vitest'

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createComponentInstance(componentConfig, initialProps = {}) {
  const instance = {
    data: { ...(componentConfig.data || {}) },
    properties: {
      label: '',
      items: [],
      spaceId: '',
      recipeId: '',
      imageRole: 'gallery',
      maxCount: 10,
      disabled: false,
      ...initialProps
    },
    triggered: [],
    setData(nextData) {
      this.data = {
        ...this.data,
        ...nextData
      }
    },
    triggerEvent(name, detail) {
      this.triggered.push({ name, detail })
    },
    setProperty(key, value) {
      const previous = this.properties[key]
      this.properties[key] = value
      if (componentConfig.observers && typeof componentConfig.observers[key] === 'function') {
        componentConfig.observers[key].call(this, value, previous)
      }
    },
    detach() {
      if (
        componentConfig.lifetimes &&
        typeof componentConfig.lifetimes.detached === 'function'
      ) {
        componentConfig.lifetimes.detached.call(this)
      }
    }
  }

  Object.keys(componentConfig.methods || {}).forEach((key) => {
    instance[key] = componentConfig.methods[key].bind(instance)
  })

  if (
    componentConfig.lifetimes &&
    typeof componentConfig.lifetimes.attached === 'function'
  ) {
    componentConfig.lifetimes.attached.call(instance)
  }

  return instance
}

async function loadComponent() {
  let capturedComponent = null
  global.Component = (config) => {
    capturedComponent = config
  }

  await import('../../miniprogram/components/image-uploader/index.js')
  return capturedComponent
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  delete global.Component
  delete global.wx
})

describe('image-uploader component lifecycle cleanup', () => {
  it('discards late upload success after component is detached', async () => {
    const deferred = createDeferred()
    const uploadRecipeImage = vi.fn().mockReturnValue(deferred.promise)
    const discardRecipeImage = vi.fn().mockResolvedValue({ discarded: true })
    global.wx = {
      chooseMedia: vi.fn().mockResolvedValue({
        tempFiles: [{ tempFilePath: '/tmp/cover.jpg', fileName: 'cover.jpg', size: 1 }]
      }),
      showToast: vi.fn()
    }

    const componentConfig = await loadComponent()
    const instance = createComponentInstance(componentConfig, {
      spaceId: 'space-1',
      recipeId: '',
      imageRole: 'cover'
    })
    instance.__uploadService = {
      uploadRecipeImage,
      discardRecipeImage
    }

    const task = instance.chooseAndUpload()
    instance.detach()
    deferred.resolve({
      _id: 'img-detached',
      uploadStatus: 'confirmed',
      imageRole: 'cover',
      fileId: 'cloud://img-detached'
    })
    await task

    expect(discardRecipeImage).toHaveBeenCalledWith('space-1', 'img-detached')
    expect(instance.triggered.some((event) => event.name === 'uploaded')).toBe(false)
  })

  it('discards late upload success after spaceId changed during upload', async () => {
    const deferred = createDeferred()
    const uploadRecipeImage = vi.fn().mockReturnValue(deferred.promise)
    const discardRecipeImage = vi.fn().mockResolvedValue({ discarded: true })
    global.wx = {
      chooseMedia: vi.fn().mockResolvedValue({
        tempFiles: [{ tempFilePath: '/tmp/cover.jpg', fileName: 'cover.jpg', size: 1 }]
      }),
      showToast: vi.fn()
    }

    const componentConfig = await loadComponent()
    const instance = createComponentInstance(componentConfig, {
      spaceId: 'space-1',
      recipeId: '',
      imageRole: 'cover'
    })
    instance.__uploadService = {
      uploadRecipeImage,
      discardRecipeImage
    }

    const task = instance.chooseAndUpload()
    await Promise.resolve()
    await Promise.resolve()
    instance.setProperty('spaceId', 'space-2')
    deferred.resolve({
      _id: 'img-space-switch',
      uploadStatus: 'confirmed',
      imageRole: 'cover',
      fileId: 'cloud://img-space-switch'
    })
    await task

    expect(discardRecipeImage).toHaveBeenCalledWith('space-1', 'img-space-switch')
    expect(instance.triggered.some((event) => event.name === 'uploaded')).toBe(false)
  })
})
