import { describe, expect, it } from 'vitest'
import { formatRecommendationStars } from '../../miniprogram/utils/recipe-view'

describe('formatRecommendationStars', () => {
  it('pads recommendation scores with empty stars up to five slots', () => {
    expect(formatRecommendationStars(3)).toBe('★★★☆☆')
    expect(formatRecommendationStars(0)).toBe('☆☆☆☆☆')
    expect(formatRecommendationStars('')).toBe('☆☆☆☆☆')
  })
})
