import BlogTheme from '@sugarat/theme'
import type { Theme } from 'vitepress'
import './style.css'

export default {
  extends: BlogTheme,
  enhanceApp(ctx) {
    BlogTheme.enhanceApp?.(ctx)
  },
} satisfies Theme
