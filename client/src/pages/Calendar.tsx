import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { trpc } from '../lib/trpc';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Loading';
import { toast } from '../components/Toast';
import { cn } from '../lib/utils';
import { EVENT_CATEGORY_COLORS } from '../../../shared/types';
import type { EventCategory } from '../../../shared/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const categoryLabels: Record<EventCategory, string> = {
  deadline: 'Deadline',
  shipment: 'Shipment',
  inspection: 'Inspection',
  meeting: 'Meeting',
  other: 'Other',
};

export default function Calendar() {
  const utils = trpc.useUtils();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate month range for query
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

  const { data: events } = trpc.calendar.list.useQuery({
    start: monthStart.toISOString(),
    end: monthEnd.toISOString(),
  });

  const createEvent = trpc.calendar.create.useMutation({
    onSuccess: () => {
      utils.calendar.list.invalidate();
      toast.success('Event created');
      setShowCreate(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteEvent = trpc.calendar.delete.useMutation({
    onSuccess: () => {
      utils.calendar.list.invalidate();
      toast.success('Event deleted');
      setSelectedEvent(null);
    },
  });

  // Build calendar grid
  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
    const daysInMonth = lastDay.getDate();

    const days: (Date | null)[] = [];
    // Previous month padding
    for (let i = 0; i < startOffset; i++) days.push(null);
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    // Next month padding to fill grid
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

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const selectedEventDetails = events?.find((e) => e.id === selectedEvent);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-sm text-ink-500">Team schedule and deadlines</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">
          <Plus className="h-4 w-4" /> New Event
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{MONTHS[month]} {year}</h2>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="btn btn-ghost p-2">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="btn btn-secondary px-3 py-1.5 text-xs">
            Today
          </button>
          <button onClick={nextMonth} className="btn btn-ghost p-2">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="card overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-ink-200 dark:border-ink-800">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-medium text-ink-500">
              {day}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {grid.map((date, i) => {
            if (!date) return <div key={i} className="min-h-24 border-b border-r border-ink-100 bg-ink-50/50 dark:border-ink-800 dark:bg-ink-900/30" />;
            const dayEvents = eventsByDay.get(date.toDateString()) ?? [];
            const isToday = date.toDateString() === today.toDateString();
            return (
              <div
                key={i}
                className="min-h-24 border-b border-r border-ink-100 p-1.5 dark:border-ink-800"
              >
                <div
                  className={cn(
                    'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    isToday ? 'bg-brand-900 font-bold text-white' : 'text-ink-500',
                  )}
                >
                  {date.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((e) => {
                    const category = e.category as EventCategory;
                    return (
                      <button
                        key={e.id}
                        onClick={() => setSelectedEvent(e.id)}
                        className="block w-full truncate rounded px-1.5 py-0.5 text-left text-xs"
                        style={{
                          backgroundColor: `${EVENT_CATEGORY_COLORS[category]}15`,
                          color: EVENT_CATEGORY_COLORS[category],
                          borderLeft: `2px solid ${EVENT_CATEGORY_COLORS[category]}`,
                        }}
                      >
                        {e.allDay ? '⏱ ' : ''}
                        {e.title}
                      </button>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <p className="px-1.5 text-xs text-ink-400">+{dayEvents.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(EVENT_CATEGORY_COLORS).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded" style={{ backgroundColor: color }} />
            <span className="text-xs text-ink-500 capitalize">{cat}</span>
          </div>
        ))}
      </div>

      {/* Event detail modal */}
      <Modal open={!!selectedEvent} onClose={() => setSelectedEvent(null)} title="Event Details" size="md">
        {selectedEventDetails && (
          <div className="space-y-3">
            <div>
              <span
                className="badge text-xs"
                style={{
                  backgroundColor: `${EVENT_CATEGORY_COLORS[selectedEventDetails.category as EventCategory]}15`,
                  color: EVENT_CATEGORY_COLORS[selectedEventDetails.category as EventCategory],
                }}
              >
                {categoryLabels[selectedEventDetails.category as EventCategory]}
              </span>
            </div>
            <h3 className="text-lg font-semibold">{selectedEventDetails.title}</h3>
            {selectedEventDetails.description && (
              <p className="text-sm text-ink-500">{selectedEventDetails.description}</p>
            )}
            <div className="space-y-1 text-sm">
              <p><span className="text-ink-400">Start:</span> {new Date(selectedEventDetails.startDate).toLocaleString('en-GB')}</p>
              <p><span className="text-ink-400">End:</span> {new Date(selectedEventDetails.endDate).toLocaleString('en-GB')}</p>
              {selectedEventDetails.location && <p><span className="text-ink-400">Location:</span> {selectedEventDetails.location}</p>}
            </div>
            <button
              onClick={() => {
                if (confirm('Delete this event?')) {
                  deleteEvent.mutate({ id: selectedEventDetails.id });
                }
              }}
              className="btn btn-danger w-full"
            >
              <Trash2 className="h-4 w-4" /> Delete Event
            </button>
          </div>
        )}
      </Modal>

      {/* Create event modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Event" size="lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const allDay = formData.get('allDay') === 'on';
            const startDateStr = formData.get('startDate') as string;
            const endDateStr = formData.get('endDate') as string;

            let startDate: string;
            let endDate: string;

            if (allDay) {
              startDate = new Date(startDateStr).toISOString();
              endDate = new Date(endDateStr || startDateStr).toISOString();
            } else {
              startDate = new Date(`${startDateStr}T${formData.get('startTime') || '09:00'}`).toISOString();
              endDate = new Date(`${endDateStr || startDateStr}T${formData.get('endTime') || '10:00'}`).toISOString();
            }

            createEvent.mutate({
              title: formData.get('title') as string,
              description: (formData.get('description') as string) || undefined,
              category: formData.get('category') as EventCategory,
              startDate,
              endDate,
              allDay,
              location: (formData.get('location') as string) || undefined,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">Title</label>
            <input name="title" className="input" required placeholder="Event title" autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea name="description" className="input" rows={2} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select name="category" className="input" defaultValue="meeting">
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Location (optional)</label>
              <input name="location" className="input" placeholder="Location" />
            </div>
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
              <input name="startTime" type="time" className="input" defaultValue="09:00" />
            </div>
            <div>
              <label className="label">End time</label>
              <input name="endTime" type="time" className="input" defaultValue="10:00" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allDay" className="rounded" />
            All day event
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={createEvent.isPending}>
              {createEvent.isPending ? <Spinner /> : <Plus className="h-4 w-4" />} Create Event
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
