// AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { getGeoLocation, searchLocation } from '../utils/locationUtils';
import { Plus, Trash2, Users, BookOpen, MapPin } from 'lucide-react';

// UI components
import StatCard from './ui/StatCard';
import ActionCard from './ui/ActionCard';
import InputField from './ui/InputField';

interface Course {
  id: string;
  name: string;
}
interface Unit {
  id: string;
  name: string;
}
interface Venue {
  id: string;
  name: string;
}

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'COURSES' | 'UNITS' | 'VENUES'>('COURSES');

  // Data states
  const [courses, setCourses] = useState<Course[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Fetch data from Supabase on mount
  useEffect(() => {
    const fetchData = async () => {
      const { data: courseData } = await supabase.from('courses').select('*');
      if (courseData) setCourses(courseData);

      const { data: unitData } = await supabase.from('units').select('*');
      if (unitData) setUnits(unitData);

      const { data: venueData } = await supabase.from('venues').select('*');
      if (venueData) setVenues(venueData);
    };

    fetchData();
  }, []);

  // Add item
  const handleAddItem = async () => {
    if (!newItemName.trim()) return;

    if (activeTab === 'COURSES') {
      const { data, error } = await supabase.from('courses').insert([{ name: newItemName }]).select();
      if (error) console.error(error);
      if (data) setCourses((prev) => [...prev, data[0]]);
    }

    if (activeTab === 'UNITS') {
      const { data, error } = await supabase.from('units').insert([{ name: newItemName }]).select();
      if (error) console.error(error);
      if (data) setUnits((prev) => [...prev, data[0]]);
    }

    if (activeTab === 'VENUES') {
      const { data, error } = await supabase.from('venues').insert([{ name: newItemName }]).select();
      if (error) console.error(error);
      if (data) setVenues((prev) => [...prev, data[0]]);
    }

    setNewItemName('');
    setIsModalOpen(false);
  };

  // Delete item
  const handleDeleteItem = async () => {
    if (!deleteItemId) return;

    if (activeTab === 'COURSES') {
      const { error } = await supabase.from('courses').delete().eq('id', deleteItemId);
      if (!error) setCourses((prev) => prev.filter((c) => c.id !== deleteItemId));
    }

    if (activeTab === 'UNITS') {
      const { error } = await supabase.from('units').delete().eq('id', deleteItemId);
      if (!error) setUnits((prev) => prev.filter((u) => u.id !== deleteItemId));
    }

    if (activeTab === 'VENUES') {
      const { error } = await supabase.from('venues').delete().eq('id', deleteItemId);
      if (!error) setVenues((prev) => prev.filter((v) => v.id !== deleteItemId));
    }

    setDeleteItemId(null);
  };

  // UI data map
  const dataMap: Record<typeof activeTab, { items: any[]; label: string }> = {
    COURSES: { items: courses, label: 'Course' },
    UNITS: { items: units, label: 'Unit' },
    VENUES: { items: venues, label: 'Venue' },
  };

  return (
    <div className="p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Courses" value={courses.length} icon={BookOpen} />
        <StatCard title="Units" value={units.length} icon={BookOpen} />
        <StatCard title="Venues" value={venues.length} icon={MapPin} />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <ActionCard title="Manage Courses" onClick={() => setActiveTab('COURSES')} />
        <ActionCard title="Manage Units" onClick={() => setActiveTab('UNITS')} />
        <ActionCard title="Manage Venues" onClick={() => setActiveTab('VENUES')} />
      </div>

      {/* Active Tab */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">{activeTab}</h2>
        <div className="space-y-2">
          {dataMap[activeTab].items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-center border p-2 rounded"
            >
              <span>{item.name}</span>
              <button
                onClick={() => setDeleteItemId(item.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Plus className="inline mr-2" size={16} />
          Add {dataMap[activeTab].label}
        </button>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96 shadow-md">
            <h3 className="text-lg font-semibold mb-4">Add {dataMap[activeTab].label}</h3>
            <InputField
              label={`${dataMap[activeTab].label} Name`}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
            <div className="flex justify-end mt-4 space-x-2">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
                Cancel
              </button>
              <button onClick={handleAddItem} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteItemId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96 shadow-md">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p>Are you sure you want to delete this {dataMap[activeTab].label.toLowerCase()}?</p>
            <div className="flex justify-end mt-4 space-x-2">
              <button onClick={() => setDeleteItemId(null)} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
                Cancel
              </button>
              <button onClick={handleDeleteItem} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
