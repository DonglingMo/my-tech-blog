import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Dongling Blog',
  description: '学习记录与技术博客',
  base: '/my-tech-blog/',
  themeConfig: {
    nav: [
      { text: '首页', link: '/' }
    ],
    sidebar: [
      {
        text: '学习笔记',
        items: [
          { text: '开始', link: '/' }
        ]
      }
    ]
  }
})