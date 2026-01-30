'use client';

import { useState, useEffect } from 'react';
import { Project } from '@/types';
import { X } from 'lucide-react';

interface ProjectEditModalProps {
  project: Project;
  onSave: (updates: Partial<Project>) => void;
  onClose: () => void;
}

export default function ProjectEditModal({ project, onSave, onClose }: ProjectEditModalProps) {
  const [projectName, setProjectName] = useState(project.projectName);
  const [address, setAddress] = useState(project.address);
  const [inspector, setInspector] = useState(project.inspector);
  const [gcName, setGcName] = useState(project.gcName);
  const [gcSignoff, setGcSignoff] = useState(project.gcSignoff);
  const [date, setDate] = useState(
    new Date(project.date).toISOString().split('T')[0]
  );

  function handleSave() {
    if (!projectName.trim()) return;

    onSave({
      projectName: projectName.trim(),
      address: address.trim(),
      inspector: inspector.trim(),
      gcName: gcName.trim(),
      gcSignoff: gcSignoff.trim(),
      date: new Date(date),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit Project</h2>
          <button onClick={onClose} className="p-1 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inspection Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inspector Name
            </label>
            <input
              type="text"
              value={inspector}
              onChange={(e) => setInspector(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GC Name
            </label>
            <input
              type="text"
              value={gcName}
              onChange={(e) => setGcName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GC Signoff
            </label>
            <input
              type="text"
              value={gcSignoff}
              onChange={(e) => setGcSignoff(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!projectName.trim()}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
