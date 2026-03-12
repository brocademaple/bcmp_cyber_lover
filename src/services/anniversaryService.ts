import { Anniversary } from '../types';

export function checkAnniversaries(anniversaries: Anniversary[]): Anniversary[] {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return anniversaries.filter(ann => {
    const annDate = new Date(ann.date);
    const annStr = `${today.getFullYear()}-${String(annDate.getMonth() + 1).padStart(2, '0')}-${String(annDate.getDate()).padStart(2, '0')}`;
    return annStr === todayStr && !ann.notified;
  });
}

export function getAnniversaryMessage(anniversary: Anniversary, characterName: string): string {
  const messages = {
    birthday: `${characterName}：今天是${anniversary.title}呢！祝你生日快乐，老公~🎂`,
    anniversary: `${characterName}：今天是${anniversary.title}，我一直记得哦~💕`,
    custom: `${characterName}：今天是${anniversary.title}的日子呢~`,
  };
  return messages[anniversary.type];
}
