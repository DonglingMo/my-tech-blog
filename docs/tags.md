---
title: 标签
layout: page
sidebar: false
---

<script setup>
import { data as posts } from './.vitepress/posts.data'
import { computed } from 'vue'
import { withBase } from 'vitepress'

const tagMap = computed(() => {
  const map = {}
  posts.forEach(p => {
    p.tags.forEach(tag => {
      if (tag) map[tag] = (map[tag] || 0) + 1
    })
  })
  return Object.entries(map).sort((a, b) => b[1] - a[1])
})
</script>

<div class="tags-page">
  <h1 class="page-title">标签</h1>
  <p class="page-desc">共 {{ tagMap.length }} 个标签，{{ posts.length }} 篇文章</p>
  <div class="tag-cloud">
    <a
      v-for="[tag, count] in tagMap"
      :key="tag"
      :href="withBase('/?tag=' + encodeURIComponent(tag))"
      class="tag-item"
      :style="{ fontSize: Math.min(1.4, 0.85 + count * 0.1) + 'rem' }"
    >
      {{ tag }}
      <span class="tag-count">{{ count }}</span>
    </a>
  </div>
</div>

<style scoped>
.tags-page { max-width: 760px; margin: 2rem auto; padding: 0 1rem; }
.page-title { font-size: 2rem; font-weight: 700; margin-bottom: 0.4rem; }
.page-desc { color: var(--vp-c-text-2); margin-bottom: 2rem; }
.tag-cloud { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.9rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
  font-weight: 500;
}
.tag-item:hover {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}
.tag-count {
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-mute);
  border-radius: 999px;
  padding: 0 0.4rem;
}
</style>
