import { UserRound } from 'lucide-react';

export function MemberAvatar({
  name,
  photoUrl,
  size = 'sm',
}: {
  name: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md';
}) {
  const sizeClass = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const iconClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        aria-hidden
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${sizeClass} grid shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-400`}
      title={name}
    >
      <UserRound className={iconClass} strokeWidth={1.5} />
    </span>
  );
}
