'use client';

import { useState } from 'react';
import { Project } from '@/types';
import { X } from 'lucide-react';

interface ProjectEditModalProps {
  project: Project;
  onSave: (updates: Partial<Project>) => void;
  onClose: () => void;
}

export default function ProjectEditModal({ project, onSave, onClose }: ProjectEditModalProps) {
  function toDateInputValue(value: Date) {
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().split('T')[0];
  }

  const [projectName, setProjectName] = useState(project.projectName);
  const [address, setAddress] = useState(project.address);
  const [inspector, setInspector] = useState(project.inspector);
  const [gcName, setGcName] = useState(project.gcName);
  const [date, setDate] = useState(toDateInputValue(project.date));

  function handleSave() {
    if (!projectName.trim()) return;

    onSave({
      projectName: projectName.trim(),
      address: address.trim(),
      inspector: inspector.trim(),
      gcName: gcName.trim(),
      date: new Date(date),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="menu-surface w-full max-w-md overflow-y-auto rounded-[1.75rem] max-h-[90vh]">
        <div className="sticky sticky-surface top-0 flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Project</h2>
          <button onClick={onClose} className="rounded-full p-2 text-gray-500 transition hover:bg-black/[0.04] hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.05] dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Inspection Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Inspector Name
            </label>
            <input
              type="text"
              value={inspector}
              onChange={(e) => setInspector(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              GC Name
            </label>
            <input
              type="text"
              value={gcName}
              onChange={(e) => setGcName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="sticky sticky-surface bottom-0 flex gap-3 border-t p-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-gray-300 px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!projectName.trim()}
            className="flex-1 rounded-2xl bg-gray-900 px-4 py-3 font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
