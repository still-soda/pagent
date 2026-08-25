import { describe, expect, it } from 'vitest';
import { jsonSchemaToZod } from '@/features/mcp/json-schema-to-zod';
import { serializeMcpResult } from '@/features/mcp/serialize';

describe('jsonSchemaToZod', () => {
  it('builds an object schema with required and optional fields', () => {
    const schema = jsonSchemaToZod({
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        count: { type: 'integer' },
        tags: { type: 'array', items: { type: 'string' } },
      },
    });
    expect(schema.safeParse({ name: 'x' }).success).toBe(true);
    expect(schema.safeParse({ name: 'x', count: 3, tags: ['a'] }).success).toBe(true);
    expect(schema.safeParse({ count: 3 }).success).toBe(false);
    expect(schema.safeParse({ name: 'x', count: 3.5 }).success).toBe(false);
  });

  it('supports enums and single-value enums', () => {
    expect(jsonSchemaToZod({ type: 'string', enum: ['a', 'b'] }).safeParse('c').success).toBe(false);
    expect(jsonSchemaToZod({ type: 'string', enum: ['a', 'b'] }).safeParse('a').success).toBe(true);
    expect(jsonSchemaToZod({ type: 'string', enum: ['only'] }).safeParse('only').success).toBe(true);
    expect(jsonSchemaToZod({ type: 'string', enum: ['only'] }).safeParse('other').success).toBe(false);
  });

  it('falls back to any for unsupported or missing schemas', () => {
    expect(jsonSchemaToZod(undefined).safeParse(123).success).toBe(true);
    expect(jsonSchemaToZod({ type: 'object', properties: {} }).safeParse({}).success).toBe(true);
    expect(jsonSchemaToZod({ type: 'string' }).safeParse('').success).toBe(true);
    expect(jsonSchemaToZod({ type: 'string' }).safeParse(5).success).toBe(false);
  });
});

describe('serializeMcpResult', () => {
  it('joins text content parts', () => {
    expect(
      serializeMcpResult({ content: [{ type: 'text', text: '第一行' }, { type: 'text', text: '第二行' }] }),
    ).toBe('第一行\n第二行');
  });

  it('summarizes images and marks errors', () => {
    const result = serializeMcpResult({
      isError: true,
      content: [{ type: 'text', text: '失败原因' }, { type: 'image', mimeType: 'image/png', data: 'AAAA' }],
    });
    expect(result).toContain('工具执行失败');
    expect(result).toContain('失败原因');
    expect(result).toContain('[图片 image/png');
  });

  it('handles plain values and empty results', () => {
    expect(serializeMcpResult(null)).toBe('(无内容)');
    expect(serializeMcpResult('ok')).toBe('ok');
    // 空 content 数组回退为整体 JSON，避免丢失结构化信息
    expect(serializeMcpResult({ content: [] })).toContain('content');
  });
});
