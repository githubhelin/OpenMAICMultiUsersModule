import { describe, it, expect } from 'vitest';
import * as vm from 'node:vm';
import { repairInteractiveHtml } from '@/lib/interactive/repair-interactive-html';

describe('repairInteractiveHtml (Defensive Self-Healing Cleaner)', () => {
  it('handles null, undefined, or empty html gracefully', () => {
    expect(repairInteractiveHtml('' as any)).toEqual({ html: '', appliedRepairs: [] });
    expect(repairInteractiveHtml(null as any)).toEqual({ html: null, appliedRepairs: [] });
    expect(repairInteractiveHtml(undefined as any)).toEqual({ html: undefined, appliedRepairs: [] });
  });

  it('corrects invalid JSON syntax in script tags', () => {
    const raw = `<script type="application/json">{ label: "test", 'key': 'val', }</script>`;
    const { html, appliedRepairs } = repairInteractiveHtml(raw);
    expect(appliedRepairs).toContain('JSON 语法校正');
    expect(html).toContain('"label":');
    expect(html).toContain('"key": "val"');
  });

  it('bridges missing onclick functions even with trailing semicolons or parameters', () => {
    const raw = `
      <div id="modal" class="modal-overlay active">
        <button onclick="nextLevelOrRestart();">进入下一关</button>
        <button onclick="customCheck(1, 'ok');">验证</button>
      </div>
      <script>
        function customCheck(a, b) {}
      </script>
    `;
    const { html, appliedRepairs } = repairInteractiveHtml(raw);
    expect(appliedRepairs.some((r) => r.includes('自动桥接缺失函数: nextLevelOrRestart'))).toBe(true);
    expect(html).toContain('id="openmaic-missing-fn-bridge"');
    expect(html).toContain('window["nextLevelOrRestart"] = function');
  });

  it('does not treat JavaScript control keywords like if, for, while, return as missing functions', () => {
    const raw = `
      <button onclick="if(confirm('重来？')) restartGame();">重来</button>
      <button onclick="for(let i=0;i<3;i++) doSomething(i);">循环</button>
      <button onclick="return (valid > 0);">返回</button>
      <script>
        function restartGame() {}
        function doSomething() {}
      </script>
    `;
    const { html, appliedRepairs } = repairInteractiveHtml(raw);
    expect(html).not.toContain('window["if"]');
    expect(html).not.toContain('window["for"]');
    expect(html).not.toContain('window["return"]');
    expect(appliedRepairs.filter((r) => r.includes('自动桥接缺失函数'))).toEqual([]);
  });

  it('adds preventDefault to ondragover dropzones', () => {
    const raw = `<div class="slot" ondragover="handleOver(event)"></div>`;
    const { html, appliedRepairs } = repairInteractiveHtml(raw);
    expect(appliedRepairs).toContain('补齐 ondragover 默认行为拦截 (防止 drop 丢弃)');
    expect(html).toContain('ondragover="event.preventDefault(); handleOver(event)"');
  });

  it('protects against Canvas negative arc radius, createRadialGradient and roundRect', () => {
    const raw = `
      <script>
        ctx.arc(100, 100, radius - 20, 0, Math.PI * 2);
        c.createRadialGradient(0, 0, -10, 100, 100, -20);
        function roundRect(ctx, x, y, w, h, r) {
          ctx.beginPath();
        }
      </script>
    `;
    const { html, appliedRepairs } = repairInteractiveHtml(raw);
    expect(appliedRepairs).toContain('Canvas 关键绘制尺寸防负数保护');
    expect(html).toContain('Math.max(0.1, radius - 20)');
    expect(html).toContain('Math.max(0.1, -10)');
    expect(html).toContain('Math.max(0, Math.min(r || 0');
  });

  it('injects sandbox guard for localStorage, alert, and AudioContext', () => {
    const raw = `
      <!DOCTYPE html>
      <html>
      <head><title>Test Game</title></head>
      <body>
        <script>
          localStorage.setItem('score', 100);
          alert('You win!');
        </script>
      </body>
      </html>
    `;
    const { html, appliedRepairs } = repairInteractiveHtml(raw);
    expect(appliedRepairs).toContain('注入沙箱环境与 Storage/Alert/Audio 安全守卫');
    expect(html).toContain('id="openmaic-sandbox-safe-guard"');
    expect(html).toContain('createMemoryStorage');
  });

  it('injects touch drag-and-drop polyfill without TypeScript-in-browser syntax errors', () => {
    const raw = `
      <!DOCTYPE html>
      <html>
      <head><title>DND Game</title></head>
      <body>
        <div class="card" draggable="true" ondragstart="drag(event)">Card</div>
      </body>
      </html>
    `;
    const { html, appliedRepairs } = repairInteractiveHtml(raw);
    expect(appliedRepairs).toContain('注入电子白板与触控拖拽兼容 Polyfill');
    expect(html).toContain('id="openmaic-touch-dnd-guard"');
    expect(html).not.toContain('(evt as any)');

    // Ensure all injected scripts are 100% valid JavaScript in a real JS engine
    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of scriptMatches) {
      expect(() => new vm.Script(match[1])).not.toThrow();
    }
  });

  it('is completely idempotent when run multiple times', () => {
    const raw = `
      <!DOCTYPE html>
      <html>
      <head><title>Complex Interactive Game</title></head>
      <body>
        <div class="card" draggable="true" ondragstart="drag(event)">Card</div>
        <div class="slot" ondragover="handleOver(event)">Slot</div>
        <button onclick="nextLevelOrRestart()">下一关</button>
        <script>
          localStorage.setItem('high', 1000);
          ctx.arc(50, 50, -5, 0, 6.28);
        </script>
      </body>
      </html>
    `;
    const firstRun = repairInteractiveHtml(raw);
    expect(firstRun.appliedRepairs.length).toBeGreaterThan(0);

    const secondRun = repairInteractiveHtml(firstRun.html);
    expect(secondRun.appliedRepairs).toEqual([]);
    expect(secondRun.html).toBe(firstRun.html);
  });
});
