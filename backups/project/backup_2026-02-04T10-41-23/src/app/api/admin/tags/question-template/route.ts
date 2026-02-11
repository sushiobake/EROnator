/**
 * 質問テンプレート管理API
 * GET: 全テンプレート取得
 * POST: テンプレート更新（単一または一括）
 */

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const TEMPLATES_FILE = path.join(process.cwd(), 'config', 'questionTemplates.json');

interface TemplatesConfig {
  description: string;
  updatedAt: string;
  templates: Record<string, string>; // displayName -> template
}

async function loadTemplates(): Promise<TemplatesConfig> {
  try {
    const content = await fs.readFile(TEMPLATES_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      description: 'タグごとの質問テンプレート',
      updatedAt: '',
      templates: {}
    };
  }
}

async function saveTemplates(config: TemplatesConfig): Promise<void> {
  config.updatedAt = new Date().toISOString();
  await fs.writeFile(TEMPLATES_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export async function GET() {
  try {
    const config = await loadTemplates();
    return NextResponse.json({ 
      success: true, 
      templates: config.templates 
    });
  } catch (error) {
    console.error('Error loading templates:', error);
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { displayName, template, bulk } = body;

    const config = await loadTemplates();

    // 一括更新
    if (bulk && typeof bulk === 'object') {
      for (const [name, tmpl] of Object.entries(bulk)) {
        if (tmpl) {
          config.templates[name] = tmpl as string;
        } else {
          delete config.templates[name];
        }
      }
      await saveTemplates(config);
      return NextResponse.json({ success: true, templates: config.templates });
    }

    // 単一更新
    if (displayName) {
      if (template) {
        config.templates[displayName] = template;
      } else {
        delete config.templates[displayName];
      }
      await saveTemplates(config);
      return NextResponse.json({ success: true, templates: config.templates });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error saving template:', error);
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  }
}
