import 'dotenv/config';
import path from 'path';
import { generateArticle } from '../dist/index.js';

async function main() {
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  const topic = '跨国婚姻与国籍冲突：身份认同、法律挑战与未来趋势';
  const keywords = [
    '国籍冲突',
    '跨国婚姻',
    '身份认同',
    '法律风险',
    '国籍政策',
    '双重国籍',
    '户籍管理'
  ];
  const { article } = await generateArticle({
    model,
    topic,
    keywords,
    lang: 'zh',
    minWords: 900,
    maxWords: 1300,
    contextStrategy: 'summary',
    styleNotes: '专业、结构清晰、兼顾政策解读与人文关怀',
    existingTags: ['法律', '国际关系', '社会政策'],
    existingCategories: ['社会议题', '法律政策'],
    exportModes: ['json','md'],
    verbose: true,
    outputDir: path.join(process.cwd(), 'result')
  });
  console.log('生成完成:', article.slug, '状态:', article.status);
}

main().catch(e => { console.error(e); process.exit(1); });
