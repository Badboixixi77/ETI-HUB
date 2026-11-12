import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  List,
  Grid,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Loading";
import { toast } from "../components/Toast";
import { cn, formatDate } from "../lib/utils";
import { EVENT_CATEGORY_COLORS } from "../../../shared/types";
import type { EventCategory } from "../../../shared/types";

const WEEKDAYS_LONG = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_SHORT = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const categoryLabels: Record<EventCategory, string> = {
  deadline: "Deadline",
  shipment: "Shipment",
  inspection: "Inspection",
  meeting: "Meeting",
  other: "Other",
};

export default function Calendar() {
  const utils = trpc.useUtils();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

  const { data: events } = trpc.calendar.list.useQuery({
    start: monthStart.toISOString(),
    end: monthEnd.toISOString(),
  });

  const createEvent = trpc.calendar.create.useMutation({
    onSuccess: () => {
      utils.calendar.list.invalidate();
      toast.success("Event created");
      setShowCreate(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteEvent = trpc.calendar.delete.useMutation({
    onSuccess: () => {
      utils.calendar.list.invalidate();
      toast.success("Event deleted");
      setSelectedEvent(null);
    },
  });

  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [year, month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, typeof events>();
    events?.forEach((e) => {
      const key = new Date(e.startDate).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [events]);

  const today = new Date();
  const selectedEventDetails = events?.find((e) => e.id === selectedEvent);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Calendar</h1>
          <p className="text-sm text-ink-500">Team schedule and deadlines</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn btn-primary flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Event</span>
        </button>
      </div>

      {/* Nav row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="btn btn-ghost p-2"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="min-w-[9rem] text-center text-base font-semibold sm:text-lg">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="btn btn-ghost p-2"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentDate(new Date())}
            className="btn btn-secondary px-3 py-1.5 text-xs"
          >
            Today
          </button>
          {/* View toggle */}
          <button
            onClick={() => setView(view === "grid" ? "list" : "grid")}
            className="btn btn-secondary p-2"
            aria-label={view === "grid" ? "List view" : "Grid view"}
          >
            {view === "grid" ? (
              <List className="h-4 w-4" />
            ) : (
              <Grid className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Grid view */}
      {view === "grid" && (
        <div className="card overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-ink-200 dark:border-ink-800">
            {WEEKDAYS_LONG.map((day, i) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-medium text-ink-500"
              >
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{WEEKDAYS_SHORT[i]}</span>
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {grid.map((date, i) => {
              if (!date)
                return (
                  <div
                    key={i}
                    className="border-b border-r border-ink-100 bg-ink-50/50 dark:border-ink-800 dark:bg-ink-900/30 min-h-[4rem] sm:min-h-[6rem]"
                  />
                );
              const dayEvents = eventsByDay.get(date.toDateString()) ?? [];
              const isToday = date.toDateString() === today.toDateString();
              return (
                <div
                  key={i}
                  className="min-h-[4rem] border-b border-r border-ink-100 p-1 dark:border-ink-800 sm:min-h-[6rem] sm:p-1.5"
                >
                  {/* Date number */}
                  <div
                    className={cn(
                      "mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday ? "bg-brand-900 text-white" : "text-ink-500",
                    )}
                  >
                    {date.getDate()}
                  </div>

                  {/* Events — show 1 on mobile, 2 on sm+ */}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 1).map((e) => {
                      const cat = e.category as EventCategory;
                      return (
                        <button
                          key={e.id}
                          onClick={() => setSelectedEvent(e.id)}
                          className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] sm:text-xs"
                          style={{
                            backgroundColor: `${EVENT_CATEGORY_COLORS[cat]}18`,
                            color: EVENT_CATEGORY_COLORS[cat],
                            borderLeft: `2px solid ${EVENT_CATEGORY_COLORS[cat]}`,
                          }}
                        >
                          {e.title}
                        </button>
                      );
                    })}
                    {/* Show second event only on sm+ */}
                    {dayEvents.slice(1, 2).map((e) => {
                      const cat = e.category as EventCategory;
                      return (
                        <button
                          key={e.id}
                          onClick={() => setSelectedEvent(e.id)}
                          className="hidden w-full truncate rounded px-1 py-0.5 text-left text-xs sm:block"
                          style={{
                            backgroundColor: `${EVENT_CATEGORY_COLORS[cat]}18`,
                            color: EVENT_CATEGORY_COLORS[cat],
                            borderLeft: `2px solid ${EVENT_CATEGORY_COLORS[cat]}`,
                          }}
                        >
                          {e.title}
                        </button>
                      );
                    })}
                    {dayEvents.length > 1 && (
                      <p className="px-1 text-[10px] text-ink-400 sm:hidden">
                        +{dayEvents.length - 1}
                      </p>
                    )}
                    {dayEvents.length > 2 && (
                      <p className="hidden px-1 text-xs text-ink-400 sm:block">
                        +{dayEvents.length - 2} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List view — better for mobile */}
      {view === "list" && (
        <div className="card divide-y divide-ink-100 dark:divide-ink-800">
          {events && events.length > 0 ? (
            events
              .sort(
                (a, b) =>
                  new Date(a.startDate).getTime() -
                  new Date(b.startDate).getTime(),
              )
              .map((e) => {
                const cat = e.category as EventCategory;
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelectedEvent(e.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-50 dark:hover:bg-ink-800/50 min-h-[56px]"
                  >
                    <div
                      className="h-10 w-1 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: EVENT_CATEGORY_COLORS[cat] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-sm">{e.title}</p>
                      <p className="text-xs text-ink-400">
                        {formatDate(e.startDate)}
                        {e.location ? ` · ${e.location}` : ""}
                      </p>
                    </div>
                    <span
                      className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${EVENT_CATEGORY_COLORS[cat]}18`,
                        color: EVENT_CATEGORY_COLORS[cat],
                      }}
                    >
                      {categoryLabels[cat]}
                    </span>
                  </button>
                );
              })
          ) : (
            <div className="px-4 py-10 text-center text-sm text-ink-400">
              No events this month
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(EVENT_CATEGORY_COLORS).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-ink-500 capitalize">{cat}</span>
          </div>
        ))}
      </div>

      {/* Event detail modal */}
      <Modal
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Event Details"
        size="md"
      >
        {selectedEventDetails && (
          <div className="space-y-3">
            <span
              className="badge text-xs"
              style={{
                backgroundColor: `${EVENT_CATEGORY_COLORS[selectedEventDetails.category as EventCategory]}18`,
                color:
                  EVENT_CATEGORY_COLORS[
                    selectedEventDetails.category as EventCategory
                  ],
              }}
            >
              {categoryLabels[selectedEventDetails.category as EventCategory]}
            </span>
            <h3 className="text-lg font-semibold">
              {selectedEventDetails.title}
            </h3>
            {selectedEventDetails.description && (
              <p className="text-sm text-ink-500">
                {selectedEventDetails.description}
              </p>
            )}
            <div className="space-y-1.5 rounded-lg bg-ink-50 p-3 text-sm dark:bg-ink-800">
              <p>
                <span className="text-ink-400">Start</span> ·{" "}
                {new Date(selectedEventDetails.startDate).toLocaleString(
                  "en-GB",
                )}
              </p>
              <p>
                <span className="text-ink-400">End</span> ·{" "}
                {new Date(selectedEventDetails.endDate).toLocaleString("en-GB")}
              </p>
              {selectedEventDetails.location && (
                <p>
                  <span className="text-ink-400">Location</span> ·{" "}
                  {selectedEventDetails.location}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                if (confirm("Delete this event?"))
                  deleteEvent.mutate({ id: selectedEventDetails.id });
              }}
              className="btn btn-danger w-full"
            >
              <Trash2 className="h-4 w-4" /> Delete Event
            </button>
          </div>
        )}
      </Modal>

      {/* Create event modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Event"
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const allDay = fd.get("allDay") === "on";
            const startDateStr = fd.get("startDate") as string;
            const endDateStr = fd.get("endDate") as string;
            const startDate = allDay
              ? new Date(startDateStr).toISOString()
              : new Date(
                  `${startDateStr}T${fd.get("startTime") || "09:00"}`,
                ).toISOString();
            const endDate = allDay
              ? new Date(endDateStr || startDateStr).toISOString()
              : new Date(
                  `${endDateStr || startDateStr}T${fd.get("endTime") || "10:00"}`,
                ).toISOString();
            createEvent.mutate({
              title: fd.get("title") as string,
              description: (fd.get("description") as string) || undefined,
              category: fd.get("category") as EventCategory,
              startDate,
              endDate,
              allDay,
              location: (fd.get("location") as string) || undefined,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">Title</label>
            <input
              name="title"
              className="input"
              required
              placeholder="Event title"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select name="category" className="input" defaultValue="meeting">
              {Object.entries(categoryLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Start date</label>
              <input name="startDate" type="date" className="input" required />
            </div>
            <div>
              <label className="label">End date</label>
              <input name="endDate" type="date" className="input" />
            </div>
            <div>
              <label className="label">Start time</label>
              <input
                name="startTime"
                type="time"
                className="input"
                defaultValue="09:00"
              />
            </div>
            <div>
              <label className="label">End time</label>
              <input
                name="endTime"
                type="time"
                className="input"
                defaultValue="10:00"
              />
            </div>
          </div>
          <div>
            <label className="label">Location (optional)</label>
            <input name="location" className="input" placeholder="Location" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              name="description"
              className="input"
              rows={2}
              placeholder="Optional"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allDay" className="h-4 w-4 rounded" />
            All day event
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createEvent.isPending}
            >
              {createEvent.isPending ? (
                <Spinner />
              ) : (
                <Plus className="h-4 w-4" />
              )}{" "}
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
