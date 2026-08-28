import { installListenerTracker } from '@/features/page/listener-tracker';

/**
 * 在主世界 document_start 安装 addEventListener / removeEventListener 劫持，
 * 记录登记过事件的元素并维护 data-pagent-listener 标记（监听被移除后自动摘除）。
 * 该脚本运行在页面主世界，不能使用 browser/chrome API。
 */
export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    installListenerTracker();
  },
});
