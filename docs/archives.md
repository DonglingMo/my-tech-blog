---
title: 归档
layout: page
sidebar: false
---

<script setup>
import { data as posts } from './.vitepress/posts.data'
import { computed } from 'vue'
import { withBase } from 'vitepress'

const byYear = computed(() => {
  const map = {}
  posts.forEach(p => {
    if (!p.date) return
    const year = p.date.slice(0, 4)
    if (!map[year]) map[year] = []
    map[year].push(p)
  })
  return Object.entries(map).sort((a, b) => Number(b[0]) - Number(a[0]))
})

function fmtDate(str) {
  if (!str) return ''
  return str.slice(5, 10)
}
</script>

<div class="archives-page">
  <h1 class="page-title">归档</h1>
  <p class="page-desc">共 {{ posts.length }} 篇文章</p>
  <div v-for="[year, list] in byYear" :key="year" class="year-group">
    <h2 class="year-title">
      {{ year }}
      <span class="year-count">{{ list.length }} 篇</span>
    </h2>
    <ul class="post-list">
      <li v-for="post in list" :key="post.url" class="post-item">
        <span class="post-date">{{ fmtDate(post.date) }}</span>
        <a :href="withBase(post.url)" class="post-title">{{ post.title }}</a>
        <span v-if="post.tags.length" class="post-tags">
          <span v-for="tag in post.tags.slice(0, 2)" :key="tag" class="tag">{{ tag }}</span>
        </span>
      </li>
    </ul>
  </div>
</div>

<style scoped>
.archives-page { max-width: 760px; margin: 2rem auto; padding: 0 1rem; }
.page-title { font-size: 2rem; font-weight: 700; margin-bottom: 0.4rem; }
.page-desc { color: var(--vp-c-text-2); margin-bottom: 2.5rem; }
.year-group { margin-bottom: 2.5rem; }
.year-title {
  font-size: 1.4rem;
  font-weight: 700;
  padding-bottom: 0.4rem;
  border-bottom: 2px solid var(--vp-c-brand-1);
  margin-bottom: 1rem;
}
.year-count { font-size: 0.85rem; font-weight: 400; color: var(--vp-c-text-2); margin-left: 0.5rem; }
.post-list { list-style: none; padding: 0; margin: 0; }
.post-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 0;
  border-bottom: 1px dashed var(--vp-c-divider);
}
.post-date { font-size: 0.85rem; color: var(--vp-c-text-2); font-family: monospace; flex-shrink: 0; }
.post-title { flex: 1; color: var(--vp-c-text-1); text-decoration: none; font-weight: 500; }
.post-title:hover { color: var(--vp-c-brand-1); }
.post-tags { display: flex; gap: 0.3rem; flex-shrink: 0; }
.tag {
  font-size: 0.72rem;
  padding: 0.1rem 0.5rem;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border-radius: 999px;
}
</style>
