import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Menu,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gerescala — Escala sua equipe de louvor em minutos" },
      {
        name: "description",
        content:
          "Gerescala cria automaticamente a escala das bandas no mês, com base na disponibilidade de cada membro. Cadastre músicos, defina regras e se organize de forma mais eficiente.",
      },
      {
        property: "og:title",
        content: "Gerescala — Escala sua equipe de louvor em minutos",
      },
      {
        property: "og:description",
        content:
          "Escala automática para bandas de louvor, com base na disponibilidade da equipe.",
      },
      { name: "twitter:title", content: "Gerescala — Escala sua equipe de louvor em minutos" },
      {
        name: "twitter:description",
        content:
          "Escala automática para bandas de louvor, com base na disponibilidade da equipe.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-gold/10 blur-3xl" />
      </div>

      <Nav />

      <main className="flex-1">
        <Hero />
        <Features />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}

function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { label: "Funcionalidades", href: "/#features", to: null },
    { label: "Como funciona", href: null, to: "/como-funciona" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <CalendarCheck className="h-4 w-4" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-foreground">
            Gerescala
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) =>
            link.to ? (
              <Link
                key={link.label}
                to={link.to}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href!}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="#cta"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          >
            Começar agora
          </a>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-foreground md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-b border-border bg-background px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {links.map((link) =>
              link.to ? (
                <Link
                  key={link.label}
                  to={link.to}
                  className="text-base font-medium text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href!}
                  className="text-base font-medium text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ),
            )}
            <a
              href="#cta"
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
              onClick={() => setMobileOpen(false)}
            >
              Começar agora
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}

function Hero() {
  const benefits = [
    "Escala automática em poucos cliques",
    "Controle de disponibilidade da equipe",
  ];

  return (
    <section className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-6">
          <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Escale sua equipe de louvor{" "}
            <span className="text-gold">sem complicação</span>
          </h1>

          <p className="max-w-xl text-lg text-muted-foreground">
            Gerescala cria automaticamente a sua escala das bandas no mês, com base na
            disponibilidade de cada membro. Cadastre músicos, defina regras e se organize de forma
            mais eficiente.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#cta"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30"
            >
              Começar agora
              <ChevronRight className="h-4 w-4" />
            </a>
            <Link
              to="/como-funciona"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-6 py-3.5 text-base font-semibold text-foreground transition-all hover:bg-muted"
            >
              Ver como funciona
            </Link>
          </div>

          <ul className="mt-2 flex flex-col gap-2">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-gold" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/20 via-gold/10 to-primary/5 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/10">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-card-foreground">
                  Escala da semana
                </h3>
                <p className="text-sm text-muted-foreground">Culto de domingo • 19h</p>
              </div>
              <div className="rounded-lg bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold-foreground">
                Confirmada
              </div>
            </div>

            <div className="space-y-3">
              <ScheduleRow
                role="Vocal"
                names={"Ana, Lucas, Mariana"}
                color="bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
              />
              <ScheduleRow
                role="Violão"
                names={"Pedro"}
                color="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
              />
              <ScheduleRow
                role="Teclado"
                names={"Julia"}
                color="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              />
              <ScheduleRow
                role="Bateria"
                names={"Rafael"}
                color="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              />
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl bg-muted p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Próxima escala gerada</p>
                  <p className="text-xs text-muted-foreground">Domingo, 28 de julho</p>
                </div>
              </div>
              <div className="text-xs font-semibold text-gold">Tudo certo</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScheduleRow({
  role,
  names,
  color,
}: {
  role: string;
  names: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${color}`}>{role}</div>
        <span className="text-sm font-medium text-foreground">{names}</span>
      </div>
      <CheckCircle2 className="h-5 w-5 shrink-0 text-gold" />
    </div>
  );
}

function Features() {
  const features = [
    {
      icon: <CalendarCheck className="h-6 w-6" />,
      title: "Escala automática",
      description:
        "Gere escalas semanais ou mensais em segundos com base nas regras do seu ministério.",
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Disponibilidade da equipe",
      description:
        "Cada músico informa quando pode servir. O sistema respeita folgas e limitações automaticamente.",
    },
  ];

  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Cansado de perder horas montando escala no papel?
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Conflitos de agenda, mensagens infinitas no grupo, gente esquecida na última hora. Existe
          um jeito melhor.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5"
          >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              {feature.icon}
            </div>
            <h3 className="mt-5 font-display text-xl font-semibold text-card-foreground">
              {feature.title}
            </h3>
            <p className="mt-2 text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="cta" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
      <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center sm:px-12 lg:py-20">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />

        <div className="relative mx-auto max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Pronto para organizar sua escala?
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/80">
            Comece a usar o Gerescala hoje mesmo e libere tempo para o que realmente importa: o
            louvor.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3.5 text-base font-semibold text-gold-foreground shadow-lg shadow-gold/20 transition-all hover:bg-gold/90"
            >
              Criar conta gratuita
              <ChevronRight className="h-4 w-4" />
            </a>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-6 py-3.5 text-base font-semibold text-primary-foreground backdrop-blur-sm transition-all hover:bg-primary-foreground/20"
            >
              Conhecer recursos
            </a>
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-primary-foreground/70">
            <Clock className="h-4 w-4" />
            Configuração em menos de 5 minutos
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">Gerescala</span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="transition-colors hover:text-foreground">
              Funcionalidades
            </a>
            <Link to="/como-funciona" className="transition-colors hover:text-foreground">
              Como funciona
            </Link>
            <a href="#cta" className="transition-colors hover:text-foreground">
              Começar
            </a>
          </nav>

          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Gerescala. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
