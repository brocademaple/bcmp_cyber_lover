/**
 * Tea Pet Shelf Component
 * 
 * **茶宠博古架展示**
 * 
 * 显示：
 * 1. 4 只茶宠的包浆进度与等级
 * 2. 最近封存的瓶子
 * 3. 博古架总体统计
 * 
 * 用户可以点击茶宠查看详情和相关瓶子。
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useThemeColors } from '../utils/theme';
import { NOTO_SANS_SC } from '../utils/appFonts';
import { getShelfStats, listSealedBottles } from '../services/teaPetShelfService';
import type { TeaPet, SealedBottle } from '../types/harness';

interface TeaPetShelfProps {
  visible: boolean;
  onClose: () => void;
  characterId: string;
}

export default function TeaPetShelf({
  visible,
  onClose,
  characterId,
}: TeaPetShelfProps) {
  const colors = useThemeColors();
  
  const [stats, setStats] = useState<any>(null);
  const [selectedPetBottles, setSelectedPetBottles] = useState<SealedBottle[] | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  
  useEffect(() => {
    if (visible) {
      loadStats();
    }
  }, [visible, characterId]);
  
  const loadStats = async () => {
    try {
      const data = await getShelfStats(characterId);
      setStats(data);
    } catch (error) {
      console.error('[TeaPetShelf] Failed to load stats:', error);
    }
  };
  
  const handlePetPress = async (petId: string) => {
    setSelectedPetId(petId);
    const bottles = await listSealedBottles(characterId, { nourishes: petId as any, limit: 20 });
    setSelectedPetBottles(bottles);
  };
  
  const handleBackToShelf = () => {
    setSelectedPetId(null);
    setSelectedPetBottles(null);
  };
  
  if (!visible) return null;
  
  if (!stats) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={[styles.container, { backgroundColor: colors.surface }]}>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>加载中...</Text>
          </View>
        </View>
      </Modal>
    );
  }
  
  const petData = [
    { id: 'clarity_deer', icon: '🦌', name: '青瓷小鹿 · 澄明', level: stats.petLevels.clarity_deer || 1, patinaExp: stats.petPatinaExp.clarity_deer || 0 },
    { id: 'action_cat', icon: '🐱', name: '乌木小猫 · 笃行', level: stats.petLevels.action_cat || 1, patinaExp: stats.petPatinaExp.action_cat || 0 },
    { id: 'ease_fox', icon: '🦊', name: '白玉睡狐 · 松弛', level: stats.petLevels.ease_fox || 1, patinaExp: stats.petPatinaExp.ease_fox || 0 },
    { id: 'spark_bird', icon: '🐦', name: '赤陶小雀 · 灵光', level: stats.petLevels.spark_bird || 1, patinaExp: stats.petPatinaExp.spark_bird || 0 },
  ];
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.container, { 
            backgroundColor: 'rgba(253, 248, 245, 0.92)',
            borderTopWidth: 1,
            borderLeftWidth: 0.5,
            borderRightWidth: 0.5,
            borderColor: '#C4A574',
          }]}>
            <View style={[styles.handle, { backgroundColor: '#C4A574' }]} />
            
            {!selectedPetId ? (
              <>
                <View style={styles.header}>
                  <Text style={[styles.title, { color: colors.text, fontFamily: NOTO_SANS_SC.bold }]}>
                    🏺 茶宠博古架
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                    自我发现的收藏与包浆成长
                  </Text>
                </View>
                
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                  <View style={[styles.statsCard, { backgroundColor: colors.accentLight, borderColor: colors.primary }]}>
                    <Text style={[styles.statsTitle, { color: colors.primary, fontFamily: NOTO_SANS_SC.bold }]}>
                      博古架 Lv.{stats.shelfLevel}
                    </Text>
                    <Text style={[styles.statsText, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                      总包浆经验：{stats.totalPatinaExp} · 封存瓶数：{stats.totalBottles}
                    </Text>
                  </View>
                  
                  <View style={styles.petsGrid}>
                    {petData.map((pet) => (
                      <TouchableOpacity
                        key={pet.id}
                        style={[styles.petCard, { 
                          backgroundColor: 'rgba(253, 248, 245, 0.6)', 
                          borderColor: '#C4A574',
                        }]}
                        onPress={() => handlePetPress(pet.id)}
                      >
                        <Text style={styles.petIcon}>{pet.icon}</Text>
                        <Text style={[styles.petName, { color: colors.text, fontFamily: NOTO_SANS_SC.medium }]}>
                          {pet.name.split(' · ')[1]}
                        </Text>
                        <View style={styles.levelBadge}>
                          {Array.from({ length: 5 }, (_, i) => {
                            const expInCurrentLevel = pet.patinaExp % 100;
                            const filledDots = Math.floor(expInCurrentLevel / 20);
                            return (
                              <View
                                key={i}
                                style={[
                                  styles.levelDot,
                                  { backgroundColor: i < filledDots ? '#C4A574' : 'rgba(196, 165, 116, 0.2)' },
                                ]}
                              />
                            );
                          })}
                        </View>
                        <Text style={[styles.petLevel, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                          Lv.{pet.level} · {pet.patinaExp % 100} / 100 XP
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  {stats.recentBottles.length > 0 && (
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.medium }]}>
                        最近封存
                      </Text>
                      {stats.recentBottles.map((bottle: SealedBottle) => (
                        <View
                          key={bottle.id}
                          style={[styles.bottleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                          <Text style={[styles.bottleText, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                            {bottle.insight}
                          </Text>
                          <Text style={[styles.bottleMeta, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                            {new Date(bottle.sealedAt).toLocaleDateString()} · 滋养 {getPetName(bottle.nourishes)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.backButton} onPress={handleBackToShelf}>
                  <Text style={[styles.backButtonText, { color: colors.primary, fontFamily: NOTO_SANS_SC.medium }]}>
                    ‹ 回到博古架
                  </Text>
                </TouchableOpacity>
                
                <View style={styles.header}>
                  <Text style={[styles.title, { color: colors.text, fontFamily: NOTO_SANS_SC.bold }]}>
                    {petData.find(p => p.id === selectedPetId)?.name}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                    相关封存瓶：{selectedPetBottles?.length || 0} 个
                  </Text>
                </View>
                
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                  {selectedPetBottles && selectedPetBottles.length > 0 ? (
                    selectedPetBottles.map((bottle) => (
                      <View
                        key={bottle.id}
                        style={[styles.bottleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <Text style={[styles.bottleText, { color: colors.text, fontFamily: NOTO_SANS_SC.regular }]}>
                          {bottle.insight}
                        </Text>
                        <Text style={[styles.bottleMeta, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                          {new Date(bottle.sealedAt).toLocaleDateString()} · +{bottle.patinaContribution} 包浆
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: NOTO_SANS_SC.regular }]}>
                      这只茶宠还没有相关封存瓶
                    </Text>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getPetName(nourishes: string): string {
  const names: Record<string, string> = {
    clarity_deer: '澄明',
    action_cat: '笃行',
    ease_fox: '松弛',
    spark_bird: '灵光',
  };
  return names[nourishes] || nourishes;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  panel: {
    maxHeight: '85%',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
  },
  content: {
    maxHeight: 480,
  },
  loadingText: {
    textAlign: 'center',
    padding: 40,
    fontSize: 14,
  },
  statsCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  statsTitle: {
    fontSize: 18,
    marginBottom: 6,
  },
  statsText: {
    fontSize: 13,
  },
  petsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 20,
  },
  petCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    margin: '1%',
    alignItems: 'center',
  },
  petIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  petName: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  levelBadge: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  levelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  petLevel: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 13,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bottleCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  bottleText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
  },
  bottleMeta: {
    fontSize: 11,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 15,
  },
  emptyText: {
    textAlign: 'center',
    padding: 40,
    fontSize: 13,
  },
});
