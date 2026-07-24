import { MemberAvailabilityCalendar } from '@/components/availability/member-availability-calendar';
import { getMemberAvailabilityPageData } from '@/modules/availability/actions';

type PageProps = {
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function MemberAvailabilityPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year ?? now.getUTCFullYear());
  const month = Number(params.month ?? now.getUTCMonth() + 1);

  const data = await getMemberAvailabilityPageData(year, month);

  return (
    <MemberAvailabilityCalendar
      initialYear={year}
      initialMonth={month}
      events={data.events}
      initialMarkedEventIds={data.markedEventIds}
      minimumDays={data.minimumDays}
    />
  );
}
