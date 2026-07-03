"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { moveStage } from "@/actions/applications";
import { AppCard } from "./AppCard";
import { cn } from "@/lib/utils";
import type { AppListItem, Stage } from "@/lib/data";

function DraggableCard({
  app,
  onOpen,
  stages,
}: {
  app: AppListItem;
  onOpen: (id: string) => void;
  stages: Stage[];
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: app.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(isDragging && "opacity-30")}
    >
      <AppCard app={app} onOpen={onOpen} stages={stages} />
    </div>
  );
}

function Column({
  stage,
  apps,
  onOpen,
  stages,
}: {
  stage: Stage;
  apps: AppListItem[];
  onOpen: (id: string) => void;
  stages: Stage[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
        <span className="text-sm font-medium">{stage.name}</span>
        <span className="num text-xs text-ink-faint">{apps.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "thin-scroll flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl p-1.5 transition",
          isOver && "bg-accent-soft/60 ring-2 ring-accent/40"
        )}
      >
        {apps.map((a) => (
          <DraggableCard key={a.id} app={a} onOpen={onOpen} stages={stages} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({
  apps,
  stages,
  onOpen,
}: {
  apps: AppListItem[];
  stages: Stage[];
  onOpen: (id: string) => void;
}) {
  // local stage overrides for optimistic drag-and-drop
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => setOverrides({}), [apps]);

  const effectiveStage = (a: AppListItem) => overrides[a.id] ?? a.stageId;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const appId = String(e.active.id);
    const toStageId = e.over ? String(e.over.id) : null;
    const app = apps.find((a) => a.id === appId);
    if (!toStageId || !app || effectiveStage(app) === toStageId) return;

    const fromStageId = effectiveStage(app);
    setOverrides((o) => ({ ...o, [appId]: toStageId }));
    await moveStage(appId, toStageId);
    const toName = stages.find((s) => s.id === toStageId)?.name ?? "stage";
    toast.success(`${app.company} → ${toName}`, {
      action: fromStageId
        ? {
            label: "Undo",
            onClick: async () => {
              setOverrides((o) => ({ ...o, [appId]: fromStageId }));
              await moveStage(appId, fromStageId);
            },
          }
        : undefined,
    });
  }

  const activeApp = activeId ? apps.find((a) => a.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="thin-scroll flex flex-1 gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <Column
            key={stage.id}
            stage={stage}
            stages={stages}
            apps={apps.filter((a) => effectiveStage(a) === stage.id)}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay>
        {activeApp ? (
          <div className="rotate-2">
            <AppCard app={activeApp} onOpen={() => {}} stages={stages} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
