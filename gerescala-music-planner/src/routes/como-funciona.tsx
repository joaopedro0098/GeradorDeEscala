import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, ChevronRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({
    meta: [
      { title: "Como funciona — Gerescala" },
      {
        name: "description",
        content:
          "Entenda em três passos como o Gerescala monta automaticamente a escala da sua banda de louvor com base na disponibilidade da equipe.",
      },
      { property: "og:title", content: "Como funciona — Gerescala" },
      {
        property: "og:description",
        content:
          "Cadastre a equipe, defina as regras e gere a escala em segundos com o Gerescala.",
      },
    ],
  }),
  component: ComoFunciona,
});

function ComoFunciona() {
  const steps = [
    {
      number: "01",
      title: "Cadastre sua equipe",
      description:
        "Adicione músicos, vocalistas e técnicos com seus dados, funções e habilidades.",
    },
    {
      number: "02",
      title: "Defina as regras",
      description:
        "Configure frequência, folgas, dias disponíveis e preferências de cada pessoa.",
    },
    {
      number: "03",
      title: "Gere a escala",
      description:
        "Com um clique, o Gerescala monta a escala respeitando todas as regras e envia para a equipe.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-foreground">
              Gerescala
            </span>
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Voltar ao início
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            Como funciona
          </div>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Sua escala pronta em 3 passos
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Três passos simples para deixar a organização da sua escala no piloto automático.
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="rounded-2xl border border-border bg-card p-6">
              <div className="font-display text-5xl font-bold text-gold/30">{step.number}</div>
              <h2 className="mt-4 font-display text-xl font-semibold text-card-foreground">
                {step.title}
              </h2>
              <p className="mt-2 text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          >
            Começar agora
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
