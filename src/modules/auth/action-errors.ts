import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { AuthServiceError } from '@/modules/auth/auth.service';

export type ActionState = {
  error?: string;
  success?: string;
};

export function mapAuthError(error: unknown): ActionState {
  if (error instanceof AuthServiceError) {
    return { error: error.message };
  }

  if (error instanceof z.ZodError) {
    return { error: error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return { error: 'Este e-mail já está cadastrado. Faça login.' };
    }

    if (error.code === 'P2021' || error.code === 'P2022') {
      return { error: 'Banco de dados desatualizado. Rode npm run db:migrate e tente novamente.' };
    }
  }

  if (error instanceof Error) {
    if (error.message === 'SESSION_SECRET is not configured') {
      return { error: 'Configuração do servidor incompleta (SESSION_SECRET).' };
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[auth]', error);
    }
  }

  return { error: 'Ocorreu um erro inesperado. Tente novamente.' };
}

export function handleActionError(error: unknown): ActionState {
  unstable_rethrow(error);
  return mapAuthError(error);
}
