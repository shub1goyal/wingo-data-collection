import { supabase } from '../lib/supabase';
import { WinGoIssue } from '../types';

/* 
OLD FIREBASE LOGIC (Keeping for reference as requested)
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DailyHistoryDoc } from '../types';

export const fetchIssuesByDate = async (date: string, limitCount: number = 100): Promise<WinGoIssue[]> => {
  try {
    const docRef = doc(db, 'daily_history', date);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as DailyHistoryDoc;
      return [...data.issues].reverse().map(issue => ({
        ...issue,
        number: parseInt(issue.issue.slice(-3))
      })).slice(0, limitCount);
    }
    return [];
  } catch (error) {
    return [];
  }
};
*/

export const fetchRollingWindowIssues = async (limitCount: number = 1500): Promise<WinGoIssue[]> => {
  try {
    console.log(`Fetching latest ${limitCount} issues from Supabase...`);
    
    const { data, error } = await supabase
      .from('wingo_history')
      .select('*')
      .order('issue', { ascending: false })
      .limit(limitCount);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    if (!data) return [];

    // Map Supabase columns to WinGoIssue type
    return data.map((item: any) => ({
      issue: item.issue,
      color: item.color,
      timestamp: item.timestamp,
      number: parseInt(item.issue.slice(-3))
    }));
  } catch (error) {
    console.error("Error fetching issues from Supabase:", error);
    return [];
  }
};

// Legacy stubs to prevent breaking other components
export const fetchIssuesByDate = async (date: string, limitCount: number = 100): Promise<WinGoIssue[]> => {
  return fetchRollingWindowIssues(limitCount);
};

export const fetchLatestIssues = async (limitCount: number = 100): Promise<WinGoIssue[]> => {
  return fetchRollingWindowIssues(limitCount);
};

