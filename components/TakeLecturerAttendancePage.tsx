
import React from 'react';
import type { User, LecturerAttendanceRecord, FacultySession } from '../types';

interface TakeLecturerAttendancePageProps {
  session: FacultySession;
  endSession: () => void;
  lecturers: User[];
  attendance: LecturerAttendanceRecord[];
}

const TakeLecturerAttendancePage: React.FC<TakeLecturerAttendancePageProps> = ({ session, endSession, lecturers, attendance }) => {

  const presentLecturerIds = new Set(
    attendance
      .filter(r => new Date(r.timestamp).toDateString() === new Date(session.startTime).toDateString())
      .map(r => r.userId)
  );

  const presentLecturers = lecturers.filter(s => presentLecturerIds.has(s.id));
  const absentLecturers = lecturers.filter(s => !presentLecturerIds.has(s.id));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-3xl font-bold text-cyan-400">Live Lecturer Attendance</h2>
                <p className="text-gray-300 mt-1">Session: {session.name}</p>
            </div>
            <button 
                onClick={endSession} 
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
            >
                End Session
            </button>
        </div>
        <div className="mt-6 pt-4 border-t border-gray-700 text-center">
            <p className="text-lg text-gray-400">Session Status: <span className="font-bold text-green-400">ACTIVE</span></p>
            <p className="text-4xl font-bold text-white mt-2">{presentLecturerIds.size} / {lecturers.length}</p>
            <p className="text-gray-400">Lecturers Marked Present</p>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Present Lecturers ({presentLecturers.length})</h3>
            {presentLecturers.length > 0 ? (
                <ul className="space-y-3 max-h-96 overflow-y-auto">
                    {presentLecturers.map(lecturer => (
                        <li key={lecturer.id} className="bg-gray-700 p-3 rounded-md flex items-center space-x-4">
                            <img src={lecturer.photo} alt={lecturer.name} className="w-12 h-12 rounded-full object-cover"/>
                            <div>
                                <p className="font-semibold text-white">{lecturer.name}</p>
                                <p className="text-sm text-gray-400">Email: {lecturer.email}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-gray-500">No lecturers have been marked present yet.</p>}
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Absent Lecturers ({absentLecturers.length})</h3>
            {absentLecturers.length > 0 ? (
                <ul className="space-y-3 max-h-96 overflow-y-auto">
                    {absentLecturers.map(lecturer => (
                        <li key={lecturer.id} className="bg-gray-700 p-3 rounded-md flex items-center space-x-4 opacity-60">
                            <img src={lecturer.photo} alt={lecturer.name} className="w-12 h-12 rounded-full object-cover"/>
                            <div>
                                <p className="font-semibold text-white">{lecturer.name}</p>
                                <p className="text-sm text-gray-400">Email: {lecturer.email}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-gray-500">All lecturers are present.</p>}
        </div>
      </div>
    </div>
  );
};

export default TakeLecturerAttendancePage;
