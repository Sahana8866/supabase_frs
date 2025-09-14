
import React, { useState } from 'react';
import type { Page, LecturerAttendanceRecord } from '../types';

interface ViewLecturerAttendancePageProps {
  setPage: (page: Page) => void;
  attendance: LecturerAttendanceRecord[];
}

const ViewLecturerAttendancePage: React.FC<ViewLecturerAttendancePageProps> = ({ setPage, attendance }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleExportCSV = () => {
    if (attendance.length === 0) {
      alert("No attendance records to export.");
      return;
    }

    const csvHeader = "Lecturer Name,Lecturer ID,Timestamp\n";
    const csvRows = attendance.map(record => {
        return `"${record.userName}","${record.userId}","${new Date(record.timestamp).toLocaleString()}"`
    }).join("\n");

    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "lecturer_attendance_records.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const filteredAttendance = attendance.filter(record =>
    record.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.userId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedAttendance = filteredAttendance.reduce((acc, record) => {
    const date = new Date(record.timestamp).toDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(record);
    return acc;
  }, {} as Record<string, LecturerAttendanceRecord[]>);

  const sortedDates = Object.keys(groupedAttendance).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-cyan-400">Lecturer Attendance Records</h2>
        {attendance.length > 0 && (
          <button 
            onClick={handleExportCSV}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center space-x-2"
            aria-label="Export all records to a CSV file"
          >
            <DownloadIcon />
            <span>Export CSV</span>
          </button>
        )}
      </div>
      
      {attendance.length > 0 && (
         <div className="mb-6">
          <input
            type="search"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
          />
        </div>
      )}
      
      {sortedDates.length > 0 ? (
        <div className="space-y-8">
          {sortedDates.map(date => (
            <div key={date} className="bg-gray-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2 text-white">{date}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-xs text-gray-400 uppercase bg-gray-700">
                    <tr>
                      <th scope="col" className="px-6 py-3">Lecturer Name</th>
                      <th scope="col" className="px-6 py-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedAttendance[date].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map(record => (
                      <tr key={record.userId + record.timestamp} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-600">
                        <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{record.userName}</td>
                        <td className="px-6 py-4">{new Date(record.timestamp).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center bg-gray-800 p-10 rounded-lg">
          <p className="text-gray-400">
            {searchQuery ? `No records found for "${searchQuery}".` : 'No lecturer attendance records found.'}
          </p>
        </div>
      )}

      <button onClick={() => setPage('ADMIN_DASHBOARD')} className="mt-8 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors">
        Back to Dashboard
      </button>
    </div>
  );
};

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

export default ViewLecturerAttendancePage;
