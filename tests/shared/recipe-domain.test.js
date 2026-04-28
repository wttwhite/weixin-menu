import { describe, expect, it } from 'vitest'
import { normalizeRecipeDraft, normalizeRecipeTagDraft } from '../../shared/domain/recipe'

describe('normalizeRecipeDraft', () => {
  it('keeps ingredients and steps sorted by sortOrder', () => {
    const result = normalizeRecipeDraft({
      name: 'Mapo Tofu',
      ingredients: [
        { name: 'Tofu', sortOrder: 2 },
        { name: 'Pork', sortOrder: 1 }
      ],
      steps: [
        { content: 'Cook', sortOrder: 2 },
        { content: 'Prep', sortOrder: 1 }
      ]
    })

    expect(result.ingredients.map((item) => item.name)).toEqual(['Pork', 'Tofu'])
    expect(result.steps.map((item) => item.content)).toEqual(['Prep', 'Cook'])
  })

  it('normalizes text fields and infers tagIds from tag objects', () => {
    const result = normalizeRecipeDraft({
      name: '  Tomato Egg  ',
      summary: ' 家常快手 ',
      category: ' home ',
      servings: ' 2 ',
      notes: ' 简单 ',
      isFavorite: 1,
      tags: [
        { id: 'tag-1', name: ' 快手 ', color: ' #f66 ' },
        { id: 'tag-2', name: ' 家常 ' }
      ],
      tagIds: ['tag-2', '']
    })

    expect(result).toEqual(
      expect.objectContaining({
        name: 'Tomato Egg',
        summary: '家常快手',
        category: 'home',
        servings: '2',
        notes: '简单',
        isFavorite: true,
        tagIds: ['tag-2', 'tag-1'],
        tags: [
          { id: 'tag-1', name: '快手', color: '#f66' },
          { id: 'tag-2', name: '家常', color: '' }
        ]
      })
    )
  })

  it('splits ingredient name input with trailing quantity and unit', () => {
    const result = normalizeRecipeDraft({
      name: '土豆炖肉',
      ingredients: [
        { name: '土豆 2个' },
        { name: '五花肉 500g' },
        { name: '盐 少许' }
      ]
    })

    expect(result.ingredients).toEqual([
      expect.objectContaining({
        name: '土豆',
        quantity: '2',
        unit: '个'
      }),
      expect.objectContaining({
        name: '五花肉',
        quantity: '500',
        unit: 'g'
      }),
      expect.objectContaining({
        name: '盐',
        quantity: '少许',
        unit: ''
      })
    ])
  })
})

describe('normalizeRecipeTagDraft', () => {
  it('normalizes tag writes with default color', () => {
    expect(
      normalizeRecipeTagDraft({
        name: '  低卡 ',
        color: ''
      })
    ).toEqual({
      name: '低卡',
      color: '#E6A23C'
    })
  })
})
