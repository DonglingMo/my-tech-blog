import { createContentLoader } from 'vitepress'

export interface Post {
  title: string
  url: string
  date: string
  tags: string[]
  categories: string[]
  description: string
}

export default createContentLoader('posts/*.md', {
  transform(rawData): Post[] {
    return rawData
      .filter(p => p.frontmatter.publish !== false && !p.frontmatter.hidden)
      .map(p => ({
        title: p.frontmatter.title || '无标题',
        url: p.url,
        date: p.frontmatter.date ? String(p.frontmatter.date).slice(0, 10) : '',
        tags: [p.frontmatter.tags || []].flat(3) as string[],
        categories: [p.frontmatter.categories || []].flat(3) as string[],
        description: p.frontmatter.description || '',
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  },
})
