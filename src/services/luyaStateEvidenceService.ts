import type { EmotionalState, Message } from '../types';

export interface LuyaStateEvidence {
  actor: 'user' | 'luya' | 'third_party' | 'fictional_character';
  kind: 'feeling' | 'situation';
  sourceMessageIds: string[];
  summary: string;
  mood?: EmotionalState['mood'];
}

/** Conservative subject isolation; ambiguous text never changes the character's state. */
export function collectLuyaStateEvidence(messages: Message[]): LuyaStateEvidence[] {
  return messages.filter(message => message.role !== 'system' && message.status !== 'failed').map(message => {
    const text = message.content;
    const actor = /小说|虚构|故事里|书里的|角色/.test(text) ? 'fictional_character' : /我朋友|我的朋友|朋友(?:说|又|很|今天)|同事|博主|他说|她说|[“”「」]/.test(text) ? 'third_party' : message.role === 'assistant' ? 'luya' : 'user';
    let mood: EmotionalState['mood'] | undefined;
    if (actor === 'luya') {
      // Require a first-person self-report, not '我知道你很累' or an offered blanket.
      if (/(?:^|[。！？;；\n])我(?:今天|现在|这会儿|自己)?(?:有点|有些|真的|很|也)?(?:累|疲惫|困|低电量)/.test(text)) mood = 'tired';
      else if (/(?:^|[。！？;；\n])我(?:今天|现在|这会儿|自己)?(?:有点|有些|真的|很)?(?:难过|低落|伤心)/.test(text)) mood = 'sad';
      else if (/(?:^|[。！？;；\n])我(?:今天|现在|这会儿|自己)?(?:有点|有些|真的|很)?(?:生气|失望|受伤)/.test(text)) mood = 'angry';
      else if (/(?:^|[。！？;；\n])我(?:今天|现在|这会儿|自己)?(?:有点|真的|很)?(?:兴奋|激动)/.test(text)) mood = 'excited';
      else if (/(?:^|[。！？;；\n])我(?:今天|现在|这会儿|自己)?(?:真的|很|挺)?(?:开心|高兴|有兴致)/.test(text)) mood = 'happy';
    }
    return { actor, kind: mood ? 'feeling' : 'situation', sourceMessageIds: [message.id], summary: text.slice(0, 240), ...(mood ? { mood } : {}) };
  });
}
