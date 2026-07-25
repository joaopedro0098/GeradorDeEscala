import { MemberAvailabilityCalendar } from '@/components/availability/member-availability-calendar';
import { getMemberAvailabilityPageData } from '@/modules/availability/actions';

export default async function MemberAvailabilityPage() {
  const data = await getMemberAvailabilityPageData();

  return (
    <MemberAvailabilityCalendar
      workingMonth={data.workingMonth}
      events={data.events}
      initialMarkedEventIds={data.markedEventIds}
      minimumDays={data.minimumDays}
    />
  );
}
