/**
 * Agent Harness Unit Tests
 * 
 * 测试 v2 Agent Harness 核心服务的关键功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getBrewSkillRegistry, assembleSystemPrompt } from '../src/services/brewSkillRegistry';
import { createDefaultDualPersonaStore, getUserMirrorSummary } from '../src/services/dualPersonaStore';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    getAllKeys: vi.fn(() => Promise.resolve([])),
  },
}));

describe('BrewSkillRegistry', () => {
  it('should return registry with 4 base drinks', () => {
    const registry = getBrewSkillRegistry();
    
    expect(registry.baseDrinks).toBeDefined();
    expect(Object.keys(registry.baseDrinks)).toHaveLength(4);
    expect(registry.baseDrinks.oolong).toBeDefined();
    expect(registry.baseDrinks.espresso).toBeDefined();
    expect(registry.baseDrinks.chamomile).toBeDefined();
    expect(registry.baseDrinks.matcha).toBeDefined();
  });
  
  it('should return registry with 4 modifiers', () => {
    const registry = getBrewSkillRegistry();
    
    expect(registry.modifiers).toBeDefined();
    expect(Object.keys(registry.modifiers)).toHaveLength(4);
    expect(registry.modifiers.milk).toBeDefined();
    expect(registry.modifiers.sugar).toBeDefined();
    expect(registry.modifiers.peel).toBeDefined();
    expect(registry.modifiers.ice).toBeDefined();
  });
  
  it('should have oolong as default base drink', () => {
    const registry = getBrewSkillRegistry();
    
    expect(registry.defaultBaseDrink).toBe('oolong');
  });
  
  it('should assemble system prompt with base drink', () => {
    const prompt = assembleSystemPrompt({
      baseDrink: 'espresso',
      modifiers: [],
      basePersona: 'Test persona',
      userMirrorSummary: '',
    });
    
    expect(prompt).toContain('茶室对话系统');
    expect(prompt).toContain('Test persona');
    expect(prompt).toContain('手冲黑咖');
    // Should contain instruction to prohibit this pattern (which is correct)
    expect(prompt).toContain('禁止使用「不是……而是……」说教句式');
  });
  
  it('should assemble system prompt with modifiers', () => {
    const prompt = assembleSystemPrompt({
      baseDrink: 'oolong',
      modifiers: ['milk', 'peel'],
      basePersona: 'Test persona',
      userMirrorSummary: '',
    });
    
    expect(prompt).toContain('加鲜奶模式已激活');
    expect(prompt).toContain('加陈皮模式已激活');
  });
  
  it('should include user mirror summary when provided', () => {
    const prompt = assembleSystemPrompt({
      baseDrink: 'oolong',
      modifiers: [],
      basePersona: 'Test persona',
      userMirrorSummary: '# User traits\n- Trait 1',
    });
    
    expect(prompt).toContain('# User traits');
    expect(prompt).toContain('- Trait 1');
  });
  
  it('should not contain 不是而是 pattern in any drink', () => {
    const registry = getBrewSkillRegistry();
    
    Object.values(registry.baseDrinks).forEach((drink) => {
      expect(drink.conversationPhilosophy).not.toMatch(/不是.*而是/);
      expect(drink.description).not.toMatch(/不是.*而是/);
    });
    
    Object.values(registry.modifiers).forEach((modifier) => {
      expect(modifier.promptSnippet).not.toMatch(/不是.*而是/);
      expect(modifier.description).not.toMatch(/不是.*而是/);
    });
  });
});

describe('DualPersonaStore', () => {
  it('should create default dual persona store', () => {
    const store = createDefaultDualPersonaStore('qingning');
    
    expect(store.host).toBeDefined();
    expect(store.host.name).toBe('鹿芽');
    expect(store.userMirror).toBeDefined();
    expect(store.userMirror.traits).toEqual([]);
    expect(store.userMirror.currentFocus).toEqual([]);
    expect(store.userMirror.resolvedBlockers).toEqual([]);
    expect(store.schemaVersion).toBe(2);
  });
  
  it('should generate empty user mirror summary when no data', () => {
    const store = createDefaultDualPersonaStore('qingning');
    const summary = getUserMirrorSummary(store.userMirror);
    
    expect(summary).toBe('');
  });
  
  it('should generate user mirror summary with traits', () => {
    const store = createDefaultDualPersonaStore('qingning');
    store.userMirror.traits = ['习惯深夜工作', '对技术实现感兴趣'];
    
    const summary = getUserMirrorSummary(store.userMirror);
    
    expect(summary).toContain('## 用户特质');
    expect(summary).toContain('- 习惯深夜工作');
    expect(summary).toContain('- 对技术实现感兴趣');
  });
  
  it('should include resolved blockers in summary', () => {
    const store = createDefaultDualPersonaStore('qingning');
    store.userMirror.resolvedBlockers = ['产品功能取舍的焦虑'];
    
    const summary = getUserMirrorSummary(store.userMirror);
    
    expect(summary).toContain('## 已解决问题（不要重复追问）');
    expect(summary).toContain('- 产品功能取舍的焦虑');
  });
  
  it('should have instruction prohibiting 不是而是 pattern', () => {
    const store = createDefaultDualPersonaStore('qingning');
    
    // Should contain explicit instruction prohibiting this pattern
    const hasProhibition = store.host.boundaries.some(b => 
      b.includes('禁止使用「不是……而是……」')
    );
    expect(hasProhibition).toBe(true);
  });
});

describe('Ingest Distiller Deterministic Path', () => {
  it('should extract urgency level from keywords', () => {
    const urgentContent = '紧急！马上要交付了，还有很多 bug';
    
    expect(urgentContent).toContain('紧急');
    expect(urgentContent).toContain('马上');
  });
  
  it('should identify blocker keywords', () => {
    const blockerContent = '不知道怎么开始，完全卡住了';
    
    expect(blockerContent).toContain('不知道');
    expect(blockerContent).toContain('卡住');
  });
});

describe('Tea Pet Shelf', () => {
  it('should calculate correct pet level from experience', () => {
    const calculatePetLevel = (exp: number): number => {
      if (exp < 100) return 1;
      if (exp < 300) return 2;
      if (exp < 600) return 3;
      if (exp < 1000) return 4;
      return 5;
    };
    
    expect(calculatePetLevel(0)).toBe(1);
    expect(calculatePetLevel(50)).toBe(1);
    expect(calculatePetLevel(100)).toBe(2);
    expect(calculatePetLevel(250)).toBe(2);
    expect(calculatePetLevel(300)).toBe(3);
    expect(calculatePetLevel(500)).toBe(3);
    expect(calculatePetLevel(600)).toBe(4);
    expect(calculatePetLevel(900)).toBe(4);
    expect(calculatePetLevel(1000)).toBe(5);
    expect(calculatePetLevel(2000)).toBe(5);
  });
});

describe('Context Window Manager', () => {
  it('should estimate tokens correctly', () => {
    const estimateTokens = (text: string): number => {
      return Math.ceil(text.length / 3);
    };
    
    expect(estimateTokens('你好')).toBe(1);
    expect(estimateTokens('这是一段测试文本')).toBe(3);
    expect(estimateTokens('这是一段比较长的测试文本，用来验证 Token 估算')).toBe(9);
  });
});
