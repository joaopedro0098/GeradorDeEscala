'use client';

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Camera, UserRound } from 'lucide-react';
import {
  updateUserProfileAction,
  type ActionState,
} from '@/modules/auth/actions';
import { Alert, PrimaryButton } from '@/components/auth/auth-ui';
import { GlassCard } from '@/components/ui/glass-card';
import { useToastActionState } from '@/components/ui/success-toast';

const VIEWPORT = 168;
const OUTPUT_SIZE = 400;

type MemberProfileFormProps = {
  memberName: string;
  profilePhotoUrl: string | null;
};

export function MemberProfileForm({
  memberName,
  profilePhotoUrl,
}: MemberProfileFormProps) {
  const [state, formAction] = useToastActionState<ActionState>(
    updateUserProfileAction,
    {},
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(memberName);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(profilePhotoUrl);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [isEditingImage, setIsEditingImage] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    setName(memberName);
    if (!isEditingImage) {
      setDisplayUrl(profilePhotoUrl);
    }
  }, [memberName, profilePhotoUrl, isEditingImage]);

  useEffect(() => {
    return () => {
      if (sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function onFileChange(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;

    if (sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
      setSourceUrl(url);
      setDisplayUrl(url);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setIsEditingImage(true);
    };
    image.src = url;
  }

  function getRenderedSize(nextZoom = zoom) {
    if (!naturalSize.width || !naturalSize.height) {
      return { width: VIEWPORT, height: VIEWPORT };
    }
    const scale =
      Math.max(VIEWPORT / naturalSize.width, VIEWPORT / naturalSize.height) * nextZoom;
    return {
      width: naturalSize.width * scale,
      height: naturalSize.height * scale,
    };
  }

  function clampOffset(next: { x: number; y: number }, nextZoom = zoom) {
    const size = getRenderedSize(nextZoom);
    const maxX = Math.max(0, (size.width - VIEWPORT) / 2);
    const maxY = Math.max(0, (size.height - VIEWPORT) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isEditingImage) {
      openFilePicker();
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    setOffset(
      clampOffset({
        x: drag.originX + (event.clientX - drag.startX),
        y: drag.originY + (event.clientY - drag.startY),
      }),
    );
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  async function prepareAndSubmit(formData: FormData) {
    formData.set('memberName', name);

    if (isEditingImage && sourceUrl) {
      const cropped = await cropToDataUrl(sourceUrl, getRenderedSize(), offset);
      if (cropped) {
        formData.set('profilePhotoDataUrl', cropped);
        setDisplayUrl(cropped);
        setIsEditingImage(false);
      }
    }

    formAction(formData);
  }

  const size = getRenderedSize();

  return (
    <GlassCard className="glass-card p-6">
      <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Perfil</h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Nome e foto do seu perfil aparecem para os administradores da equipe.
      </p>

      <form action={prepareAndSubmit} className="mt-5 space-y-5">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-3">
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openFilePicker();
                }
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={(event) => {
                if (!isEditingImage) return;
                event.preventDefault();
                const delta = event.deltaY > 0 ? -0.1 : 0.1;
                const nextZoom = Math.min(3, Math.max(1, zoom + delta));
                setZoom(nextZoom);
                setOffset((current) => clampOffset(current, nextZoom));
              }}
              className="relative h-[168px] w-[168px] cursor-grab touch-none overflow-hidden rounded-full border border-slate-200 bg-slate-100 active:cursor-grabbing"
              aria-label="Alterar foto do perfil"
            >
              {displayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayUrl}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                  style={
                    isEditingImage && naturalSize.width
                      ? {
                          width: size.width,
                          height: size.height,
                          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                        }
                      : {
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transform: 'translate(-50%, -50%)',
                        }
                  }
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-slate-400">
                  <UserRound className="h-16 w-16" strokeWidth={1.25} />
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-slate-900/45 py-2">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                onFileChange(event.target.files?.[0]);
                event.target.value = '';
              }}
            />

            {isEditingImage ? (
              <label className="w-full max-w-[168px] text-xs text-[var(--text-secondary)]">
                Zoom
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(event) => {
                    const nextZoom = Number(event.target.value);
                    setZoom(nextZoom);
                    setOffset((current) => clampOffset(current, nextZoom));
                  }}
                  className="mt-1 w-full accent-[var(--btn-primary-bg)]"
                />
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="mt-2 text-xs font-medium text-[var(--text-primary)] underline-offset-2 hover:underline"
                >
                  Trocar imagem
                </button>
              </label>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <label className="block text-sm font-semibold text-[var(--text-primary)]">
              Nome do Perfil
              <input
                name="memberName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Defina seu nome de perfil"
                required
                minLength={2}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-100/80 px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-300/60"
              />
            </label>
          </div>
        </div>

        {state.error ? <Alert message={state.error} tone="error" /> : null}

        <div className="pt-1">
          <PrimaryButton label="Salvar" fullWidth={false} />
        </div>
      </form>
    </GlassCard>
  );
}

function cropToDataUrl(
  sourceUrl: string,
  rendered: { width: number; height: number },
  offset: { x: number; y: number },
): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      const scale = OUTPUT_SIZE / VIEWPORT;
      const drawWidth = rendered.width * scale;
      const drawHeight = rendered.height * scale;
      const dx = (OUTPUT_SIZE - drawWidth) / 2 + offset.x * scale;
      const dy = (OUTPUT_SIZE - drawHeight) / 2 + offset.y * scale;

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    image.onerror = () => resolve(null);
    image.src = sourceUrl;
  });
}
