'use client';

import { useState } from 'react';
import { EventCalendar } from '@/components/scheduling/event-calendar';
import { RolesAndFormationEditor } from '@/components/scheduling/roles-formation-editor';
import { ScheduleRulesEditor } from '@/components/scheduling/schedule-rules-editor';
import type { ScheduleConfigurationSnapshot } from '@/modules/scheduling/types';

const TABS = [
  { id: 'calendar', label: 'Calendário' },
  { id: 'formation', label: 'Funções & Formação' },
  { id: 'rules', label: 'Regras' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function ConfigurationTabs({
  configuration,
  initialYear,
  initialMonth,
}: {
  configuration: ScheduleConfigurationSnapshot;
  initialYear: number;
  initialMonth: number;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('calendar');

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-4 py-2 text-sm ${
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
            initialYear={initialYear}
            initialMonth={initialMonth}
            eventDates={configuration.events.map((event) => event.date)}
          />
        ) : null}

        {activeTab === 'formation' ? (
          <RolesAndFormationEditor
            roles={configuration.roles}
            dayRequirements={configuration.dayRequirements}
          />
        ) : null}

        {activeTab === 'rules' ? (
          <ScheduleRulesEditor
            roles={configuration.roles}
            generalIntervalRule={configuration.generalIntervalRule}
            roleIntervalRules={configuration.roleIntervalRules}
            priorityRoles={configuration.priorityRoles}
            participationMinimumDays={configuration.participationMinimumDays}
          />
        ) : null}
      </div>
    </div>
  );
}
