import { useEffect, useMemo, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { api, useTickets } from "./lib/api.ts";
import type { Meta, Ticket } from "./lib/types.ts";
import { TopBar } from "./components/TopBar.tsx";
import { PhonePanel } from "./components/PhonePanel.tsx";
import { MapBoard } from "./components/MapBoard.tsx";
import { Queue } from "./components/Queue.tsx";
import { TicketDrawer } from "./components/TicketDrawer.tsx";
import { BacklogCard } from "./components/BacklogCard.tsx";
import { LabPage } from "./pages/LabPage.tsx";
import { HowPage } from "./pages/HowPage.tsx";

function ControlRoom({ tickets, fresh, backlog, meta }: { tickets: Ticket[]; fresh: string | null; backlog: ReturnType<typeof useTickets>["backlog"]; meta: Meta | null }) {
  const [liveId, setLiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const byId = useMemo(() => new Map(tickets.map((t) => [t.id, t])), [tickets]);
  const live = liveId ? byId.get(liveId) ?? null : null;
  const focus = (fresh ? byId.get(fresh) : null) ?? live;

  return (
    <main className="grid min-h-0 flex-1 grid-cols-[372px_minmax(0,1fr)_400px] gap-3 p-3">
      <PhonePanel ticket={live} onTicket={(t) => setLiveId(t?.id ?? null)} />
      <div className="relative min-h-0">
        <MapBoard tickets={tickets} meta={meta} fresh={fresh} focus={focus ?? null} selected={selected} onSelect={setSelected} />
        <BacklogCard event={backlog} />
        <button
          onClick={() => confirm("Clear all demo tickets?") && api.reset()}
          className="absolute right-3 bottom-3 z-[500] flex items-center gap-1 rounded-full border border-line bg-ink-950/80 px-2.5 py-1 text-[10.5px] text-fog hover:text-chalk"
          title="Clear demo tickets"
        >
          <RotateCcw size={11} /> reset demo
        </button>
      </div>
      <Queue tickets={tickets} selected={selected} onSelect={setSelected} zones={meta?.zones ?? []} />
      <TicketDrawer ticket={selected ? byId.get(selected) ?? null : null} onClose={() => setSelected(null)} />
    </main>
  );
}

export default function App() {
  const { tickets, backlog, fresh } = useTickets();
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    api.meta().then(setMeta).catch(() => undefined);
  }, []);
  return (
    <div className="flex h-full flex-col">
      <TopBar tickets={tickets} />
      <Routes>
        <Route path="/" element={<ControlRoom tickets={tickets} fresh={fresh} backlog={backlog} meta={meta} />} />
        <Route path="/lab" element={<LabPage meta={meta} />} />
        <Route path="/how" element={<HowPage meta={meta} />} />
      </Routes>
      {/* the control room is a desk tool; on a phone, say so instead of breaking the layout */}
      <div className="fixed inset-0 z-[3000] hidden flex-col items-center justify-center gap-3 bg-ink-950 p-8 text-center max-[1100px]:flex">
        <div className="ta text-[28px] font-semibold text-jasmine">துணை</div>
        <div className="font-display text-[28px] font-extrabold tracking-wide">THUNAI 1913</div>
        <p className="max-w-[340px] text-[13px] leading-relaxed text-mist">The control room is built for a call-centre desk. Open it on a laptop or desktop screen, at least 1100 px wide.</p>
      </div>
    </div>
  );
}
