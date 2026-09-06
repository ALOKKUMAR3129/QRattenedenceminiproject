import { useState } from 'react';
import { Clock, MapPin, Circle, CheckCircle2 } from 'lucide-react';
import { DAYS, getEntriesByDay, getTodayName, formatTime, isClassActive, isClassStarted } from '@/lib/timetable';
import type { TimetableEntry } from '@/lib/types';

type TimetableProps = {
  highlightActive?: boolean;
};

export default function Timetable({ highlightActive = false }: TimetableProps) {
  const today = getTodayName();
  const [selectedDay, setSelectedDay] = useState(today);

  const entries = getEntriesByDay(selectedDay);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800 dark:text-white">Weekly Timetable</h3>
      </div>

      {/* Day selector */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {DAYS.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              selectedDay === day
                ? 'bg-blue-600 text-white'
                : day === today
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {day.slice(0, 3)}
            {day === today && <span className="ml-1 text-[10px]">•</span>}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-sm">
          No classes scheduled for {selectedDay}
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry: TimetableEntry) => {
            const active = highlightActive && isClassActive(entry);
            const started = highlightActive && isClassStarted(entry);
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                  active
                    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30'
                }`}
              >
                <div className="flex-shrink-0">
                  {active ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{entry.subject}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Clock className="w-3 h-3" />
                      {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <MapPin className="w-3 h-3" />
                      {entry.room}
                    </span>
                  </div>
                </div>
                {active && (
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded-md whitespace-nowrap">
                    Live
                  </span>
                )}
                {!active && started && highlightActive && (
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    Ended
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
