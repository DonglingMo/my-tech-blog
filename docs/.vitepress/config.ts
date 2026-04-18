import { defineConfig, getThemeConfig } from '@sugarat/theme/node'
import { withMermaid } from 'vitepress-plugin-mermaid'
import mathjax3 from 'markdown-it-mathjax3'
const blogTheme = getThemeConfig({
  author: 'Dongling Mo',
  comment: {
    repo: 'DonglingMo/my-tech-blog',
    repoId: 'R_kgDONxxxxxx',
    category: 'Announcements',
    categoryId: 'DIC_kwDONxxxxxx',
    inputPosition: 'top',
  },
  RSS: {
    title: 'Dongling Blog',
    baseUrl: 'https://donglingmo.github.io',
    copyright: `Copyright © 2024-${new Date().getFullYear()} Dongling Mo`,
  },
  recommend: {
    showSelf: true,
    nextText: '下一篇',
  },
  article: {
    readingTime: true,
    hiddenCover: false,
  },
  themeColor: 'vp-default',
  footer: {
    message: '记录技术，分享思考，保持好奇',
    copyright: `Copyright © 2024-${new Date().getFullYear()} Dongling Mo`,
    icpRecord: undefined,
  },
  hotArticle: {
    title: '🔥 精选文章',
    pageSize: 6,
    nextText: '换一组',
    empty: '暂无精选内容',
  },
  home: {
    name: 'Dongling Mo',
    motto: '记录技术，分享思考，保持好奇',
    inspiring: [
      '后端 · 前端 · 系统设计 · AI · 工具效率',
      '深度探索技术的每一个有趣角落',
    ],
    pageSize: 6,
  },
})

export default withMermaid(
  defineConfig({
    extends: blogTheme,
    lang: 'zh-CN',
    title: 'Dongling Blog',
    description: '后端 · 前端 · 系统设计 · AI · 工具效率 · 综合技术博客',
    base: '/my-tech-blog/',
    head: [
      ['link', { rel: 'icon', href: '/my-tech-blog/favicon.svg', type: 'image/svg+xml' }],
      ['meta', { name: 'author', content: 'Dongling Mo' }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:site_name', content: 'Dongling Blog' }],
    ],
    themeConfig: {
      nav: [
        { text: '首页', link: '/' },
        { text: '文章', link: '/posts/' },
        { text: '标签', link: '/tags' },
        { text: '归档', link: '/archives' },
        { text: '关于', link: '/about' },
      ],
      socialLinks: [
        { icon: 'github', link: 'https://github.com/DonglingMo' },
      ],
      lastUpdated: {
        text: '最后更新于',
        formatOptions: { dateStyle: 'short', timeStyle: 'short' },
      },
      returnToTopLabel: '回到顶部',
      sidebarMenuLabel: '目录',
      darkModeSwitchLabel: '外观',
      outline: {
        label: '本页目录',
        level: [2, 3],
      },
      search: {
        provider: 'local',
        options: {
          translations: {
            button: { buttonText: '搜索文章', buttonAriaLabel: '搜索' },
            modal: {
              noResultsText: '无法找到相关结果',
              resetButtonTitle: '清除查询条件',
              footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
            },
          },
        },
      },
    },
    markdown: {
      config(md) {
        md.use(mathjax3)
      },
      image: {
        lazyLoading: true,
      },
    },
  })
)
