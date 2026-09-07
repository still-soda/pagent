import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { scenes } from './scenes'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...scenes.flatMap((scene): RouteRecordRaw[] =>
      scene.routes?.length
        ? scene.routes
        : [
            {
              path: `/${scene.id}`,
              name: scene.id,
              component: scene.component,
              meta: { sceneId: scene.id },
            },
          ],
    ),
    { path: '/', redirect: `/${scenes[0].id}` },
    { path: '/:pathMatch(.*)*', redirect: `/${scenes[0].id}` },
  ],
})
