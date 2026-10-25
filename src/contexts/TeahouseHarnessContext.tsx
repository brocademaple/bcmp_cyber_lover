/**
 * Teahouse Harness Context
 * 
 * **茶室 Harness 全局状态管理**
 * 
 * 管理当前会话的 Harness 状态：
 * - 当前基底饮品与佐料
 * - 待泡茶叶列表
 * - 会话 ID 与校准记录
 * - UI 面板开关状态
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { UnsteepedLeaf, SessionSettlementCard } from '../types/harness';
import type { Message } from '../types';
import { listUnsteepedLeaves } from '../services/ingestDistillerService';
import { seedHarnessDataIfNeeded } from '../services/harnessSeeding';
import { settleSession, applySealCard } from '../services/teahouseSessionService';

interface TeahouseHarnessState {
  // 当前激活的技能
  baseDrink: string;
  modifiers: string[];
  
  // 会话状态
  sessionId: string | null;
  unsteepedLeaves: UnsteepedLeaf[];
  settlementCard: SessionSettlementCard | null;
  
  // UI 面板状态
  harnessDrawerVisible: boolean;
  ingestPanelVisible: boolean;
  teaPetShelfVisible: boolean;
  inspectorVisible: boolean;
  settlementVisible: boolean;
  
  // 操作方法
  setBaseDrink: (drinkId: string) => void;
  toggleModifier: (modifierId: string) => void;
  startSession: (characterId: string) => void;
  refreshLeaves: (characterId: string) => Promise<void>;
  triggerSettlement: (characterId: string, messages: Message[]) => Promise<void>;
  applySettlement: (characterId: string, selection: { sealIds: number[]; updateConfirmed: boolean; discardIds: number[] }) => Promise<void>;
  
  // UI 控制
  openHarnessDrawer: () => void;
  closeHarnessDrawer: () => void;
  openIngestPanel: () => void;
  closeIngestPanel: () => void;
  openTeaPetShelf: () => void;
  closeTeaPetShelf: () => void;
  openInspector: () => void;
  closeInspector: () => void;
  openSettlement: () => void;
  closeSettlement: () => void;
}

const TeahouseHarnessContext = createContext<TeahouseHarnessState | null>(null);

export function useTeahouseHarness() {
  const context = useContext(TeahouseHarnessContext);
  if (!context) {
    throw new Error('useTeahouseHarness must be used within TeahouseHarnessProvider');
  }
  return context;
}

interface Props {
  children: React.ReactNode;
}

export function TeahouseHarnessProvider({ children }: Props) {
  const [baseDrink, setBaseDrink] = useState('oolong');
  const [modifiers, setModifiers] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [unsteepedLeaves, setUnsteepedLeaves] = useState<UnsteepedLeaf[]>([]);
  const [settlementCard, setSettlementCard] = useState<SessionSettlementCard | null>(null);
  
  const [harnessDrawerVisible, setHarnessDrawerVisible] = useState(false);
  const [ingestPanelVisible, setIngestPanelVisible] = useState(false);
  const [teaPetShelfVisible, setTeaPetShelfVisible] = useState(false);
  const [inspectorVisible, setInspectorVisible] = useState(false);
  const [settlementVisible, setSettlementVisible] = useState(false);
  
  // 初始化播种
  useEffect(() => {
    seedHarnessDataIfNeeded('qingning').then((result) => {
      if (result.seeded) {
        console.log('[TeahouseHarness] Demo data seeded successfully');
      }
    });
  }, []);
  
  const toggleModifier = useCallback((modifierId: string) => {
    setModifiers((prev) =>
      prev.includes(modifierId)
        ? prev.filter((id) => id !== modifierId)
        : [...prev, modifierId]
    );
  }, []);
  
  const startSession = useCallback((characterId: string) => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    setSessionId(newSessionId);
  }, []);
  
  const refreshLeaves = useCallback(async (characterId: string) => {
    const leaves = await listUnsteepedLeaves(characterId, { status: 'fresh' });
    setUnsteepedLeaves(leaves);
  }, []);
  
  const triggerSettlement = useCallback(async (characterId: string, messages: Message[]) => {
    if (!sessionId) return;
    
    try {
      const card = await settleSession(characterId, sessionId, messages);
      setSettlementCard(card);
      setSettlementVisible(true);
    } catch (error) {
      console.error('[TeahouseHarness] Settlement failed:', error);
    }
  }, [sessionId]);
  
  const applySettlement = useCallback(async (
    characterId: string,
    selection: { sealIds: number[]; updateConfirmed: boolean; discardIds: number[] }
  ) => {
    if (!settlementCard) return;
    
    try {
      await applySealCard(characterId, settlementCard, selection);
      setSettlementCard(null);
      setSettlementVisible(false);
      
      console.log('[TeahouseHarness] Settlement applied successfully');
    } catch (error) {
      console.error('[TeahouseHarness] Apply settlement failed:', error);
    }
  }, [settlementCard]);
  
  const state: TeahouseHarnessState = {
    baseDrink,
    modifiers,
    sessionId,
    unsteepedLeaves,
    settlementCard,
    
    harnessDrawerVisible,
    ingestPanelVisible,
    teaPetShelfVisible,
    inspectorVisible,
    settlementVisible,
    
    setBaseDrink,
    toggleModifier,
    startSession,
    refreshLeaves,
    triggerSettlement,
    applySettlement,
    
    openHarnessDrawer: () => setHarnessDrawerVisible(true),
    closeHarnessDrawer: () => setHarnessDrawerVisible(false),
    openIngestPanel: () => setIngestPanelVisible(true),
    closeIngestPanel: () => setIngestPanelVisible(false),
    openTeaPetShelf: () => setTeaPetShelfVisible(true),
    closeTeaPetShelf: () => setTeaPetShelfVisible(false),
    openInspector: () => setInspectorVisible(true),
    closeInspector: () => setInspectorVisible(false),
    openSettlement: () => setSettlementVisible(true),
    closeSettlement: () => setSettlementVisible(false),
  };
  
  return (
    <TeahouseHarnessContext.Provider value={state}>
      {children}
    </TeahouseHarnessContext.Provider>
  );
}
