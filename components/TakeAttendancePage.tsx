
import React from 'react';
import type { Student, AttendanceRecord, StudentSession } from '../types';

interface SessionMonitorPageProps {
  session: StudentSession;
  endSession: () => void;
  students: Student[];
  attendance: AttendanceRecord[];
}

const TakeAttendancePage: React.FC<SessionMonitorPageProps> = ({ session, endSession, students, attendance }) => {
  const { course, unit } = session;

  const courseStudents = students.filter(s => s.courseId === course.id);
  
  const presentStudentIds = new Set(
    attendance
      .filter(r => r.unitId === unit.id && new Date(r.timestamp).toDateString() === new Date(session.startTime).toDateString())
      .map(r => r.studentId)
  );

  const presentStudents = courseStudents.filter(s => presentStudentIds.has(s.id));
  const absentStudents = courseStudents.filter(s => !presentStudentIds.has(s.id));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-3xl font-bold text-cyan-400">Live Attendance Session</h2>
                <p className="text-gray-300 mt-1">{course.name} - {unit.name}</p>
                <p className="text-sm text-gray-500">Attendance Radius: {session.radius}m</p>
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
            <p className="text-4xl font-bold text-white mt-2">{presentStudentIds.size} / {courseStudents.length}</p>
            <p className="text-gray-400">Students Marked Present</p>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Present Students ({presentStudents.length})</h3>
            {presentStudents.length > 0 ? (
                <ul className="space-y-3 max-h-96 overflow-y-auto">
                    {presentStudents.map(student => (
                        <li key={student.id} className="bg-gray-700 p-3 rounded-md flex items-center space-x-4">
                            <img src={student.photo} alt={student.name} className="w-12 h-12 rounded-full object-cover"/>
                            <div>
                                <p className="font-semibold text-white">{student.name}</p>
                                <p className="text-sm text-gray-400">ID: {student.id}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-gray-500">No students have been marked present yet.</p>}
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Absent Students ({absentStudents.length})</h3>
            {absentStudents.length > 0 ? (
                <ul className="space-y-3 max-h-96 overflow-y-auto">
                    {absentStudents.map(student => (
                        <li key={student.id} className="bg-gray-700 p-3 rounded-md flex items-center space-x-4 opacity-60">
                            <img src={student.photo} alt={student.name} className="w-12 h-12 rounded-full object-cover"/>
                            <div>
                                <p className="font-semibold text-white">{student.name}</p>
                                <p className="text-sm text-gray-400">ID: {student.id}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-gray-500">All students are present.</p>}
        </div>
      </div>
    </div>
  );
};

export default TakeAttendancePage;
