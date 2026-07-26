'use client';

import { useState } from 'react';
import { EventCalendar } from '@/components/scheduling/event-calendar';
import { RolesAndFormationEditor } from '@/components/scheduling/roles-formation-editor';
import { ScheduleRulesEditor } from '@/components/scheduling/schedule-rules-editor';
import type { ScheduleConfigurationSnapshot } from '@/modules/scheduling/types';
import type { YearMonth } from '@/modules/scheduling/working-month.logic';

const TABS = [
  { id: 'calendar', label: 'Calendário' },
  { id: 'formation', label: 'Funções & Formação' },
  { id: 'rules', label: 'Regras' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function ConfigurationTabs({
  configuration,
  workingMonth,
  earliestMonth,
}: {
  configuration: ScheduleConfigurationSnapshot;
  workingMonth: YearMonth;
  earliestMonth: YearMonth;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('calendar');

  return (
    <div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm ${
              activeTab === tab.id
                ? 'bg-zinc-900 text-white'
                : 'border border-zinc-300 text-zinc-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'calendar' ? (
          <EventCalendar
            key={`${workingMonth.year}-${workingMonth.month}`}
            workingMonth={workingMonth}
            earliestMonth={earliestMonth}
            eventDates={configuration.events.map((event) => event.date)}
          />
        ) : null}

        {activeTab === 'formation' ? (
          <RolesAndFormationEditor
            roles={configuration.roles}
            dayRequirements={configuration.dayRequirements}
            priorityRoles={configuration.priorityRoles}
            eventDates={configuration.events.map((event) => event.date)}
            workingMonth={workingMonth}
          />
        ) : null}

        {activeTab === 'rules' ? (
          <ScheduleRulesEditor participationMinimumDays={configuration.participationMinimumDays} />
        ) : null}
      </div>
    </div>
  );
}
