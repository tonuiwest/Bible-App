import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PLANS = [
  {id:'peace', label:'Peace & Anxiety', icon:'leaf-outline', days:7, verses: [{bookId:'php', ch:4},{bookId:'isa', ch:26},{bookId:'jhn', ch:14},{bookId:'psa', ch:23},{bookId:'mat', ch:11},{bookId:'php', ch:4},{bookId:'isa', ch:41}]},
  {id:'love', label:'Love & Relationships', icon:'heart-outline', days:14, verses: [{bookId:'1co', ch:13},{bookId:'1jn', ch:4},{bookId:'eph', ch:4},{bookId:'col', ch:3},{bookId:'pro', ch:17},{bookId:'jhn', ch:15},{bookId:'rom', ch:12},{bookId:'1co', ch:13},{bookId:'eph', ch:5},{bookId:'1jn', ch:3},{bookId:'col', ch:3},{bookId:'jhn', ch:13},{bookId:'1pe', ch:4},{bookId:'rom', ch:13}]},
  {id:'faith', label:'Faith & Trust', icon:'shield-checkmark-outline', days:7, verses: [{bookId:'heb', ch:11},{bookId:'rom', ch:8},{bookId:'psa', ch:46},{bookId:'isa', ch:41},{bookId:'mat', ch:17},{bookId:'mrk', ch:11},{bookId:'jas', ch:1}]},
  {id:'healing', label:'Healing & Strength', icon:'medkit-outline', days:14, verses: [{bookId:'isa', ch:41},{bookId:'psa', ch:103},{bookId:'jer', ch:30},{bookId:'psa', ch:147},{bookId:'isa', ch:53},{bookId:'exo', ch:15},{bookId:'psa', ch:34},{bookId:'mat', ch:9},{bookId:'jas', ch:5},{bookId:'psa', ch:41},{bookId:'pro', ch:4},{bookId:'3jn', ch:1},{bookId:'psa', ch:30},{bookId:'isa', ch:57}]},
  {id:'purpose', label:'Purpose & Guidance', icon:'compass-outline', days:30, verses: Array.from({length:30}, (_,i)=>({bookId:['jer','pro','rom','psa','php','isa','eph','col','psa','pro','mat','rom','psa','isa','php','jhn','psa','pro','isa','rom','psa','php','col','isa','psa','pro','jer','mat','psa','rom'][i%30], ch: [29,3,12,32,4,30,2,3,25,16,6,8,119,26,2,14,37,3,40,12,46,4,1,55,27,2,1,11,1,8][i%30]}))},
];

const STORAGE_KEY = 'planner_state_v2';

const Ctx = createContext({
  plans: PLANS,
  progress: {},
  cycles: {},
  addProgress: () => {},
  removeProgress: () => {},
  isDayDone: () => false,
  getProgress: () => 0,
  isPlanComplete: () => false,
  renewPlan: () => {},
});

export function PlannerProvider({ children }) {
  // progress: { [planId]: { [dayIndex]: true } }
  const [progress, setProgress] = useState({});
  // cycles: { [planId]: number } — how many times a plan has been completed
  const [cycles, setCycles] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setProgress(parsed.progress || {});
          setCycles(parsed.cycles || {});
        }
      } catch {}
    })();
  }, []);

  const persist = async (nextProgress, nextCycles) => {
    setProgress(nextProgress);
    setCycles(nextCycles);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ progress: nextProgress, cycles: nextCycles }));
    } catch {}
  };

  const addProgress = async (planId, dayIndex) => {
    const planDays = progress[planId] || {};
    if (planDays[dayIndex]) return { alreadyDone: true, completedPlan: false };
    const nextPlanDays = { ...planDays, [dayIndex]: true };
    await persist({ ...progress, [planId]: nextPlanDays }, cycles);
    const plan = PLANS.find((p) => p.id === planId);
    const completedPlan = !!plan && plan.verses.every((_, i) => nextPlanDays[i]);
    return { alreadyDone: false, completedPlan };
  };

  const removeProgress = async (planId, dayIndex) => {
    const planDays = { ...(progress[planId] || {}) };
    if (!planDays[dayIndex]) return;
    delete planDays[dayIndex];
    await persist({ ...progress, [planId]: planDays }, cycles);
  };

  const isDayDone = (planId, dayIndex) => !!(progress[planId] && progress[planId][dayIndex]);

  const getProgress = (planId) => {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) return 0;
    const planDays = progress[planId] || {};
    const done = plan.verses.filter((_, i) => planDays[i]).length;
    return Math.round((done / plan.verses.length) * 100);
  };

  const isPlanComplete = (planId) => getProgress(planId) === 100;

  /** Clears a finished plan's progress and bumps its completed-cycle count,
   * so the reading plan is renewed and ready to go through again. */
  const renewPlan = async (planId) => {
    const nextProgress = { ...progress, [planId]: {} };
    const nextCycles = { ...cycles, [planId]: (cycles[planId] || 0) + 1 };
    await persist(nextProgress, nextCycles);
  };

  const overall = Object.values(progress).reduce((sum, days) => sum + Object.keys(days).length, 0);

  return (
    <Ctx.Provider value={{ plans: PLANS, progress, cycles, addProgress, removeProgress, isDayDone, getProgress, isPlanComplete, renewPlan, overall }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePlanner() {
  return useContext(Ctx);
}
