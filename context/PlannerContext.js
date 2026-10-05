import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BUILTIN_PLANS, chaptersOf, splitIntoDays } from '../data/readingPlans';

// Same storage key as before, extended with new fields, so existing progress
// on the original plans carries straight over.
const STORAGE_KEY = 'planner_state_v2';
const CUSTOM_KEY = 'planner_custom_plans_v1';

const Ctx = createContext(null);

/*
 * State shape (persisted):
 *   progress:   { [planId]: { [dayIndex]: true } }           completed days
 *   reads:      { [planId]: { [dayIndex]: number[] } }       readings opened within a day
 *   cycles:     { [planId]: number }                         times completed
 *   lastActive: { [planId]: timestamp }
 *   startedAt:  { [planId]: timestamp }
 */
export function PlannerProvider({ children }) {
  const [progress, setProgress] = useState({});
  const [reads, setReads] = useState({});
  const [cycles, setCycles] = useState({});
  const [lastActive, setLastActive] = useState({});
  const [startedAt, setStartedAt] = useState({});
  const [customPlans, setCustomPlans] = useState([]);
  const stateRef = useRef({ progress: {}, reads: {}, cycles: {}, lastActive: {}, startedAt: {} });

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const p = JSON.parse(raw);
          const next = {
            progress: p.progress || {}, reads: p.reads || {}, cycles: p.cycles || {},
            lastActive: p.lastActive || {}, startedAt: p.startedAt || {},
          };
          stateRef.current = next;
          setProgress(next.progress); setReads(next.reads); setCycles(next.cycles);
          setLastActive(next.lastActive); setStartedAt(next.startedAt);
        }
      } catch {}
      try {
        const rawCustom = await AsyncStorage.getItem(CUSTOM_KEY);
        if (rawCustom) setCustomPlans(JSON.parse(rawCustom) || []);
      } catch {}
    })();
  }, []);

  const plans = useMemo(() => [...customPlans, ...BUILTIN_PLANS], [customPlans]);
  const getPlan = (id) => plans.find((p) => p.id === id) || null;

  // Writes go through a ref so several quick updates never clobber each other.
  const commit = async (patch) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    if (patch.progress) setProgress(next.progress);
    if (patch.reads) setReads(next.reads);
    if (patch.cycles) setCycles(next.cycles);
    if (patch.lastActive) setLastActive(next.lastActive);
    if (patch.startedAt) setStartedAt(next.startedAt);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const touch = (planId) => {
    const s = stateRef.current;
    const patch = { lastActive: { ...s.lastActive, [planId]: Date.now() } };
    if (!s.startedAt[planId]) patch.startedAt = { ...s.startedAt, [planId]: Date.now() };
    return patch;
  };

  const isPlanDone = (plan, days) => plan.days.every((_, i) => days[i]);

  /** Marks a whole day complete. */
  const addProgress = async (planId, dayIndex) => {
    const plan = getPlan(planId);
    const s = stateRef.current;
    const planDays = s.progress[planId] || {};
    if (planDays[dayIndex]) return { alreadyDone: true, completedPlan: false };
    const nextPlanDays = { ...planDays, [dayIndex]: true };
    await commit({ progress: { ...s.progress, [planId]: nextPlanDays }, ...touch(planId) });
    return { alreadyDone: false, completedPlan: !!plan && isPlanDone(plan, nextPlanDays) };
  };

  const removeProgress = async (planId, dayIndex) => {
    const s = stateRef.current;
    const planDays = { ...(s.progress[planId] || {}) };
    const planReads = { ...(s.reads[planId] || {}) };
    delete planDays[dayIndex];
    delete planReads[dayIndex];
    await commit({ progress: { ...s.progress, [planId]: planDays }, reads: { ...s.reads, [planId]: planReads } });
  };

  /**
   * Records that one reading of a day was opened. When every reading of that
   * day has been opened, the day is marked complete automatically.
   */
  const markReadingRead = async (planId, dayIndex, readingIndex = 0) => {
    const plan = getPlan(planId);
    if (!plan || !plan.days[dayIndex]) return { completedDay: false, completedPlan: false };
    const s = stateRef.current;
    const dayReads = new Set((s.reads[planId] || {})[dayIndex] || []);
    dayReads.add(readingIndex);
    const nextReads = { ...s.reads, [planId]: { ...(s.reads[planId] || {}), [dayIndex]: [...dayReads] } };
    const allRead = plan.days[dayIndex].every((_, i) => dayReads.has(i));
    const planDays = s.progress[planId] || {};
    if (allRead && !planDays[dayIndex]) {
      const nextPlanDays = { ...planDays, [dayIndex]: true };
      await commit({ reads: nextReads, progress: { ...s.progress, [planId]: nextPlanDays }, ...touch(planId) });
      return { completedDay: true, completedPlan: isPlanDone(plan, nextPlanDays) };
    }
    await commit({ reads: nextReads, ...touch(planId) });
    return { completedDay: false, completedPlan: false };
  };

  const isReadingRead = (planId, dayIndex, readingIndex) =>
    !!(progress[planId] && progress[planId][dayIndex]) ||
    ((reads[planId] || {})[dayIndex] || []).includes(readingIndex);

  const isDayDone = (planId, dayIndex) => !!(progress[planId] && progress[planId][dayIndex]);

  const getDoneCount = (planId) => {
    const plan = getPlan(planId);
    if (!plan) return 0;
    const d = progress[planId] || {};
    return plan.days.filter((_, i) => d[i]).length;
  };

  const getProgress = (planId) => {
    const plan = getPlan(planId);
    if (!plan || !plan.days.length) return 0;
    return Math.round((getDoneCount(planId) / plan.days.length) * 100);
  };

  const isPlanComplete = (planId) => getProgress(planId) === 100;

  /** First day not yet completed (or the last day if all are done). */
  const nextDayIndex = (planId) => {
    const plan = getPlan(planId);
    if (!plan) return 0;
    const d = progress[planId] || {};
    const i = plan.days.findIndex((_, idx) => !d[idx]);
    return i === -1 ? plan.days.length - 1 : i;
  };

  const renewPlan = async (planId) => {
    const s = stateRef.current;
    await commit({
      progress: { ...s.progress, [planId]: {} },
      reads: { ...s.reads, [planId]: {} },
      cycles: { ...s.cycles, [planId]: (s.cycles[planId] || 0) + 1 },
    });
  };

  const resetPlan = async (planId) => {
    const s = stateRef.current;
    await commit({ progress: { ...s.progress, [planId]: {} }, reads: { ...s.reads, [planId]: {} } });
  };

  /** Plans with progress that are not finished, most recently used first. */
  const activePlans = useMemo(() => {
    return plans
      .filter((p) => {
        const done = Object.keys(progress[p.id] || {}).length;
        const started = done > 0 || Object.keys(reads[p.id] || {}).length > 0;
        return started && done < p.days.length;
      })
      .sort((a, b) => (lastActive[b.id] || 0) - (lastActive[a.id] || 0));
  }, [plans, progress, reads, lastActive]);

  // ---------------- Custom plans ----------------

  const saveCustom = async (list) => {
    setCustomPlans(list);
    try { await AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch {}
  };

  /**
   * Creates a user plan.
   *   { label, description?, icon?, bookIds?, fromChapter?, toChapter?, days?, readings? }
   * Either pass bookIds (+ optional chapter range when a single book is
   * chosen) and a number of days to auto-split, or pass `readings` — an
   * explicit list of days built by hand.
   */
  const createCustomPlan = async ({ label, description, icon, bookIds = [], fromChapter, toChapter, days = 7, readings }) => {
    let planDays;
    if (Array.isArray(readings) && readings.length) {
      planDays = readings;
    } else {
      let chapters = chaptersOf(bookIds);
      if (bookIds.length === 1 && (fromChapter || toChapter)) {
        const lo = Math.max(1, fromChapter || 1);
        const hi = toChapter || Number.MAX_SAFE_INTEGER;
        chapters = chapters.filter((c) => c.c >= lo && c.c <= hi);
      }
      if (!chapters.length) throw new Error('Pick at least one book.');
      planDays = splitIntoDays(chapters, Math.max(1, days));
    }
    const plan = {
      id: `custom_${Date.now().toString(36)}`,
      label: String(label || 'My Reading Plan').trim().slice(0, 40),
      description: description || `${planDays.length} days · created by you`,
      icon: icon || 'star-outline',
      category: 'mine',
      custom: true,
      createdAt: Date.now(),
      days: planDays,
    };
    await saveCustom([plan, ...customPlans]);
    await commit(touch(plan.id));
    return plan;
  };

  const deleteCustomPlan = async (planId) => {
    await saveCustom(customPlans.filter((p) => p.id !== planId));
    const s = stateRef.current;
    const strip = (obj) => { const o = { ...obj }; delete o[planId]; return o; };
    await commit({
      progress: strip(s.progress), reads: strip(s.reads), cycles: strip(s.cycles),
      lastActive: strip(s.lastActive), startedAt: strip(s.startedAt),
    });
  };

  const overall = Object.values(progress).reduce((sum, days) => sum + Object.keys(days || {}).length, 0);

  const value = {
    plans, customPlans, progress, reads, cycles, lastActive, startedAt, overall, activePlans,
    getPlan, addProgress, removeProgress, markReadingRead, isReadingRead, isDayDone,
    getDoneCount, getProgress, isPlanComplete, nextDayIndex, renewPlan, resetPlan,
    createCustomPlan, deleteCustomPlan,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlanner() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlanner must be used inside PlannerProvider');
  return ctx;
}
