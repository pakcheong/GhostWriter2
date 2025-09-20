import type { RequiredContentItem } from '../article/types.js';

// Intent ranking for upgrade precedence
const intentRank: Record<NonNullable<RequiredContentItem['intent']>, number> = {
  section: 4,
  heading: 3,
  subheading: 2,
  mention: 1
};

function strongerInject(
  a?: RequiredContentItem['injectStrategy'],
  b?: RequiredContentItem['injectStrategy']
) {
  if (!a) return b;
  if (!b) return a;
  const order = ['append-section', 'append-paragraph', 'none'];
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia === -1 || ib === -1) return a || b;
  return ib < ia ? b : a; // earlier in list is stronger
}

function canonKey(item: RequiredContentItem) {
  if (item.id) return `id:${item.id}`;
  return `text:${item.text.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

export function mergeRequiredContentLists(
  lists: Array<RequiredContentItem[] | undefined | null>
): RequiredContentItem[] {
  const map = new Map<string, RequiredContentItem>();
  for (const list of lists) {
    if (!list) continue;
    for (const raw of list) {
      if (!raw || !raw.text) continue;
      const base: RequiredContentItem = {
        intent: 'mention',
        minMentions: 1,
        ...raw
      };
      base.text = base.text.trim();
      const key = canonKey(base);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...base });
        continue;
      }
      // Upgrade intent if stronger
      if (base.intent && existing.intent) {
        if (intentRank[base.intent] > intentRank[existing.intent]) existing.intent = base.intent;
      } else if (base.intent && !existing.intent) existing.intent = base.intent;
      // minMentions (stricter = larger)
      const newMin = Math.max(existing.minMentions || 1, base.minMentions || 1);
      existing.minMentions = newMin;
      // maxMentions (stricter = smaller positive)
      if (base.maxMentions) {
        if (!existing.maxMentions) existing.maxMentions = base.maxMentions;
        else existing.maxMentions = Math.min(existing.maxMentions, base.maxMentions);
      }
      if (existing.maxMentions && existing.minMentions && existing.minMentions > existing.maxMentions) {
        existing.minMentions = existing.maxMentions;
      }
      // optional => only optional if both are optional
      existing.optional = (existing.optional ?? false) && (base.optional ?? false);
      // matchMode: keep existing unless empty
      if (!existing.matchMode && base.matchMode) existing.matchMode = base.matchMode;
      // injectStrategy pick stronger
      existing.injectStrategy = strongerInject(existing.injectStrategy, base.injectStrategy);
      // notes merge
      if (base.notes) existing.notes = existing.notes ? `${existing.notes} | ${base.notes}` : base.notes;
    }
  }
  return Array.from(map.values());
}
