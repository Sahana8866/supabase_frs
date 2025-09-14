import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { User, Student, AttendanceRecord, StudentSession, Course, Unit, Venue } from '../types';
import { useCamera } from '../hooks/useCamera';
import { compareFaces } from '../utils/gemini';
import { calculateDistance } from '../utils/geolocation';
import { getGeoLocation } from '../utils/location';

// --- Global declaration for Leaflet ---
declare const L: any;

type Status = 'READY' | 'CHECKING_LOCATION' | 'CAPTURING' | 'VERIFYING' | 'SUBMITTING' | 'CONFIRMED' | 'ERROR' | 'OFFLINE_QUEUED';


// --- Analytics Sub-component ---
const TickIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 text-emerald-300">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
);

const AttendanceVisuals: React.FC<{ 
    studentAttendance: AttendanceRecord[], 
    percentage: number,
    statusColor: string
}> = ({ studentAttendance, percentage, statusColor }) => {
    
    const monthlyData = useMemo(() => {
        const months: { [key: string]: number } = {};
        const sortedAttendance = [...studentAttendance].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        sortedAttendance.forEach(record => {
            const month = new Date(record.timestamp).toLocaleString('default', { month: 'short', year: '2-digit' });
            months[month] = (months[month] || 0) + 1;
        });
        const labels = Object.keys(months);
        const data = labels.map(label => months[label]);
        return { labels, data };
    }, [studentAttendance]);

    const heatmapData = useMemo(() => {
        return new Set(studentAttendance.map(r => new Date(r.timestamp).toDateString()));
    }, [studentAttendance]);

    const today = new Date();
    const calendarMonths = Array.from({ length: 4 }).map((_, i) => {
        const d = new Date(today);
        d.setMonth(d.getMonth() - i);
        return d;
    }).reverse();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Percentage Card */}
            <div className={`p-6 rounded-lg shadow-lg flex flex-col justify-center items-center text-center border-b-4 ${statusColor} bg-gray-700/50`}>
                <div className="text-5xl font-bold text-white">{percentage.toFixed(0)}%</div>
                <div className="text-lg font-semibold text-gray-200 mt-2">Overall Attendance</div>
            </div>

            {/* Monthly Bar Chart */}
            <div className="lg:col-span-2 bg-gray-700/50 p-6 rounded-lg shadow-lg">
                <h4 className="font-bold text-lg mb-4 text-gray-200">Monthly Attendance</h4>
                {monthlyData.data.length > 0 ? (
                    <div className="flex justify-around items-end h-40 space-x-2 pt-4">
                        {monthlyData.labels.slice(-6).map((label, index) => (
                            <div key={label} className="flex flex-col items-center flex-1 h-full group">
                                <div className="text-white font-bold text-sm mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{monthlyData.data.slice(-6)[index]}</div>
                                <div className="w-full bg-cyan-600 rounded-t-md hover:bg-cyan-500 transition-all duration-300 ease-in-out" style={{ height: `${(monthlyData.data.slice(-6)[index] / Math.max(...monthlyData.data, 1)) * 100}%` }}></div>
                                <div className="text-xs text-gray-400 mt-2">{label}</div>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-gray-500 h-40 flex items-center justify-center">Not enough data for chart.</p>}
            </div>

            {/* Calendar Heatmap */}
            <div className="lg:col-span-3 bg-gray-700/50 p-6 rounded-lg shadow-lg">
                <h4 className="font-bold text-lg mb-4 text-gray-200">Attendance Heatmap (Last 4 Months)</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {calendarMonths.map(monthDate => {
                        const month = monthDate.getMonth();
                        const year = monthDate.getFullYear();
                        const firstDay = new Date(year, month, 1).getDay();
                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                        return (
                            <div key={monthDate.toISOString()} className="text-center">
                                <h5 className="font-semibold mb-2 text-gray-300">{monthDate.toLocaleString('default', { month: 'long' })}</h5>
                                <div className="grid grid-cols-7 gap-1.5 text-xs">
                                    {['S','M','T','W','T','F','S'].map(d => <div key={d} className="font-bold text-gray-500">{d}</div>)}
                                    {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`}></div>)}
                                    {Array.from({ length: daysInMonth }).map((_, day) => {
                                        const date = new Date(year, month, day + 1);
                                        const isPresent = heatmapData.has(date.toDateString());
                                        const isToday = date.toDateString() === today.toDateString();
                                        return (
                                            <div key={day} className={`w-full aspect-square rounded-sm transition-colors flex items-center justify-center ${isPresent ? 'bg-emerald-500/20' : 'bg-gray-600/50'} ${isToday ? 'ring-2 ring-cyan-400' : ''}`} title={date.toDateString()}>
                                                {isPresent && <TickIcon />}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};


// --- Main Component ---
interface StudentDashboardProps {
  user: User;
  students: Student[];
  attendance: AttendanceRecord[];
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  studentSession: StudentSession | null;
  courses: Course[];
  units: Unit[];
  venues: Venue[];
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, students, attendance, setAttendance, studentSession, courses, units, venues }) => {
  const studentData = useMemo(() => students.find(s => s.id === user.studentId), [students, user.studentId]);
  const studentAttendance = useMemo(() => attendance.filter(r => r.studentId === user.studentId).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [attendance, user.studentId]);
  
  const allCourseAttendance = useMemo(() => studentData ? attendance.filter(r => r.courseId === studentData.courseId) : [], [attendance, studentData]);

  const { percentage, statusColor, statusText, statusTextColor, statusBgColor } = useMemo(() => {
    const totalSessions = new Set(allCourseAttendance.map(r => `${r.unitId}-${new Date(r.timestamp).toDateString()}`)).size;
    const studentSessionsAttended = new Set(studentAttendance.map(r => `${r.unitId}-${new Date(r.timestamp).toDateString()}`)).size;
    const perc = totalSessions > 0 ? (studentSessionsAttended / totalSessions) * 100 : 0;

    let cardBorderColor = 'border-yellow-400';
    let textColor = 'text-yellow-300';
    let bgColor = 'bg-yellow-500/10';
    let text = 'Moderate Attendance';

    if (perc < 50) {
        cardBorderColor = 'border-red-400';
        textColor = 'text-red-400';
        bgColor = 'bg-red-500/10';
        text = 'Low Attendance';
    } else if (perc >= 90) {
        cardBorderColor = 'border-green-400';
        textColor = 'text-green-300';
        bgColor = 'bg-green-500/10';
        text = 'Excellent Attendance';
    }
    return { 
        percentage: perc, 
        statusColor: cardBorderColor,
        statusText: text,
        statusTextColor: textColor,
        statusBgColor: bgColor
    };
  }, [studentAttendance, allCourseAttendance]);


  const [status, setStatus] = useState<Status>('READY');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDistanceError, setIsDistanceError] = useState(false);
  const [studentLocation, setStudentLocation] = useState<GeolocationCoordinates | null>(null);
  const { videoRef, canvasRef, isCameraOn, isVideoReady, error: cameraError, startCamera, stopCamera, capturePhoto } = useCamera();
  
  // --- Map State ---
  const [showErrorMap, setShowErrorMap] = useState(false);
  const mapRef = useRef<any>(null);

  const isSessionActiveForStudent = studentSession && studentData && studentData.courseId === studentSession.course.id;
  
  const isAlreadyMarked = useMemo(() => {
    if (!isSessionActiveForStudent || !studentData) return false;
    return attendance.some(
      record => record.studentId === studentData.id &&
                record.unitId === studentSession!.unit.id &&
                new Date(record.timestamp).toDateString() === new Date(studentSession!.startTime).toDateString()
    );
  }, [isSessionActiveForStudent, studentData, attendance, studentSession]);
  
  useEffect(() => {
    if (cameraError) {
        setErrorMessage(cameraError);
        setStatus('ERROR');
    }
  }, [cameraError]);

  useEffect(() => {
    const processQueue = () => {
      const queue = JSON.parse(localStorage.getItem('attendanceQueue') || '[]');
      if (queue.length > 0 && navigator.onLine) {
        setAttendance(prev => [...prev, ...queue]);
        localStorage.removeItem('attendanceQueue');
      }
    };
    window.addEventListener('online', processQueue);
    processQueue();
    return () => window.removeEventListener('online', processQueue);
  }, [setAttendance]);
  
  const handleStartAttendanceProcess = async () => {
    setStatus('CHECKING_LOCATION');
    setErrorMessage(null);
    setIsDistanceError(false);
    try {
        const location = await getGeoLocation();
        setStudentLocation(location.coords);
        
        if (!studentSession) {
             throw new Error("Session is not active.");
        }

        const { lockedLocation, radius } = studentSession;
        const distance = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            lockedLocation.latitude,
            lockedLocation.longitude
        );

        if (distance > radius) {
            setErrorMessage(`You are not in the attendance zone. Please move within ${radius} meters of the lecturer. You are currently ~${Math.round(distance)}m away.`);
            setStatus('ERROR');
            setIsDistanceError(true);
            return;
        }
        
        setStatus('CAPTURING');
        startCamera();

    } catch (err: any) {
        setErrorMessage(err.message || 'Could not get your location.');
        setStatus('ERROR');
    }
  };


  const handleSubmit = async () => {
    setErrorMessage(null);
    setIsDistanceError(false);
    const photoBase64 = capturePhoto();

    if (!photoBase64 || !studentData || !studentSession) {
        setErrorMessage('Could not capture photo or session data is missing.');
        setStatus('ERROR');
        return;
    }

    stopCamera();
    setStatus('VERIFYING');

    try {
        const isMatch = await compareFaces(studentData.photo, photoBase64);

        if (!isMatch) {
            setErrorMessage('Face does not match registered photo. Please try again.');
            setStatus('ERROR');
            return;
        }
        
        setStatus('SUBMITTING');
        if (!studentLocation) {
            setErrorMessage('Location data was lost. Please try the process again.');
            setStatus('ERROR');
            return;
        }
        
        const newRecord: AttendanceRecord = {
            studentId: studentData.id,
            studentName: studentData.name,
            timestamp: new Date().toISOString(),
            courseId: studentSession.course.id,
            unitId: studentSession.unit.id,
            sessionLocation: {
                latitude: studentSession.lockedLocation.latitude,
                longitude: studentSession.lockedLocation.longitude,
                altitude: studentSession.lockedLocation.altitude,
            },
            sessionRadius: studentSession.radius,
            geo: { 
                latitude: studentLocation.latitude, 
                longitude: studentLocation.longitude,
                altitude: studentLocation.altitude
            },
        };

        if (navigator.onLine) {
            setAttendance(prev => [...prev, newRecord]);
            setStatus('CONFIRMED');
        } else {
            const queue = JSON.parse(localStorage.getItem('attendanceQueue') || '[]');
            queue.push(newRecord);
            localStorage.setItem('attendanceQueue', JSON.stringify(queue));
            setStatus('OFFLINE_QUEUED');
        }

    } catch(err: any) {
        setErrorMessage(err.message || 'An unknown error occurred.');
        setStatus('ERROR');
    }
  };

  const handleRetry = () => {
      setStatus('READY');
      setErrorMessage(null);
      setIsDistanceError(false);
      setShowErrorMap(false);
      if (isCameraOn) {
          stopCamera();
      }
  };
  
  // --- Map Effect ---
  useEffect(() => {
    if (showErrorMap && studentSession && studentLocation) {
        const lecturerPos: [number, number] = [studentSession.lockedLocation.latitude, studentSession.lockedLocation.longitude];
        const studentPos: [number, number] = [studentLocation.latitude, studentLocation.longitude];

        if (mapRef.current) mapRef.current.remove();
        
        const map = L.map('student-error-map-container').setView(lecturerPos, 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        mapRef.current = map;

        L.marker(lecturerPos).addTo(map).bindPopup('Lecturer Location (Center of Zone)');
        L.circle(lecturerPos, {
            radius: studentSession.radius,
            color: '#22c55e', // green-500
            fillColor: '#16a34a', // green-600
            fillOpacity: 0.3
        }).addTo(map);

        L.marker(studentPos).addTo(map).bindPopup('Your Current Location');

        const bounds = L.latLngBounds([lecturerPos, studentPos]);
        map.fitBounds(bounds.pad(0.5)); // Add padding to bounds
    }
  }, [showErrorMap, studentSession, studentLocation]);

  const getDataNameById = (data: {id: string, name: string}[], id: string) => {
    return data.find(item => item.id === id)?.name || 'N/A';
  }
  
  const handleExportCSV = () => {
    if (studentAttendance.length === 0) {
      alert("You have no attendance records to export.");
      return;
    }

    const csvHeader = "Date,Time Marked,Unit,Session Location,Session Radius (m)\n";
    const csvRows = studentAttendance.map(record => {
        const date = new Date(record.timestamp);
        const unitName = getDataNameById(units, record.unitId);
        let locationInfo = record.venueId ? getDataNameById(venues, record.venueId) :
                       record.sessionLocation ? `(${record.sessionLocation.latitude.toFixed(5)}, ${record.sessionLocation.longitude.toFixed(5)})` : 'N/A';
        const radius = record.sessionRadius ?? 'N/A';

        return `"${date.toLocaleDateString()}","${date.toLocaleTimeString()}","${unitName}","${locationInfo}","${radius}"`
    }).join("\n");

    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `attendance_${user.studentId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(URL.createObjectURL(blob));
  };


  const renderAttendanceCaptureUI = () => {
    if (!isSessionActiveForStudent) return null;
    
    let content;

    if (isAlreadyMarked || status === 'CONFIRMED') {
        content = (
            <div className="text-center">
                <CheckCircleIcon />
                <h3 className="text-2xl font-bold text-white mt-4">Attendance Marked!</h3>
                <p className="text-gray-400 mt-2">You have been successfully marked present for this session.</p>
            </div>
        );
    } else {
        switch(status) {
            case 'READY':
                content = (
                     <div className="text-center">
                        <h3 className="text-xl font-bold text-white">Ready to Mark Attendance</h3>
                        <p className="text-gray-400 mt-2">The system will first check your location and then start the camera.</p>
                        <button onClick={handleStartAttendanceProcess} className="mt-6 w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-lg transition-colors text-lg">
                            Mark Attendance
                        </button>
                    </div>
                ); break;
             case 'CHECKING_LOCATION':
                content = (
                    <div className="text-center">
                        <Spinner />
                        <h3 className="text-xl font-bold text-white mt-4">Checking Location...</h3>
                        <p className="text-gray-400 mt-2">Please wait while we verify you are in the attendance zone.</p>
                    </div>
                ); break;
            case 'CAPTURING':
                content = (
                    <div>
                        <div className="aspect-video bg-gray-900 rounded-md overflow-hidden relative">
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]"></video>
                            <canvas ref={canvasRef} className="hidden"></canvas>
                        </div>
                         <button 
                            onClick={handleSubmit} 
                            disabled={!isVideoReady} 
                            className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors text-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
                            aria-live="polite"
                         >
                            {isVideoReady ? 'Verify Face & Submit' : 'Camera starting...'}
                        </button>
                    </div>
                ); break;
            case 'VERIFYING':
                content = (
                    <div className="text-center">
                        <Spinner />
                        <h3 className="text-xl font-bold text-white mt-4">Verifying Face...</h3>
                        <p className="text-gray-400 mt-2">Please wait while we compare your photo.</p>
                    </div>
                ); break;
            case 'SUBMITTING':
                 content = (
                    <div className="text-center">
                        <Spinner />
                        <h3 className="text-xl font-bold text-white mt-4">Processing...</h3>
                        <p className="text-gray-400 mt-2">Submitting your geotagged attendance.</p>
                    </div>
                ); break;
             case 'OFFLINE_QUEUED':
                content = (
                    <div className="text-center">
                        <ClockIcon />
                        <h3 className="text-2xl font-bold text-white mt-4">Submission Queued</h3>
                        <p className="text-gray-400 mt-2">You are offline. Your attendance will be submitted automatically when you reconnect.</p>
                    </div>
                ); break;
            case 'ERROR':
                content = (
                    <div className="text-center">
                        <ErrorIcon />
                        <h3 className="text-2xl font-bold text-white mt-4">Submission Failed</h3>
                        <p className="text-red-400 mt-2">{errorMessage}</p>
                        <div className="mt-6 flex flex-col sm:flex-row gap-3">
                            <button onClick={handleRetry} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg">
                                Try Again
                            </button>
                            {isDistanceError && (
                                <button onClick={() => setShowErrorMap(!showErrorMap)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
                                    {showErrorMap ? 'Hide Map' : 'Show on Map'}
                                </button>
                            )}
                        </div>
                        {showErrorMap && <div id="student-error-map-container" className="h-64 mt-4 w-full bg-gray-700 rounded-lg" aria-label="Map showing your location relative to the attendance zone"></div>}
                    </div>
                ); break;
            default:
                content = null;
        }
    }
    
    return (
      <div className="bg-gradient-to-r from-cyan-600 to-blue-700 rounded-lg shadow-lg p-6 mb-8">
        <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-white">Live Attendance Session</h2>
            <p className="text-cyan-200">Session for <strong>{studentSession?.unit.name}</strong> is active.</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 min-h-[250px] flex items-center justify-center">
            {content}
        </div>
      </div>
    );
  }

  if (!studentData) {
    return <div className="text-center p-8 bg-gray-800 rounded-lg"><p className="text-xl text-yellow-400">Could not find student data.</p></div>;
  }
  
  return (
    <div className="max-w-6xl mx-auto">
      {renderAttendanceCaptureUI()}

      <div className={`bg-gray-800 rounded-lg shadow-lg p-8 ${isSessionActiveForStudent ? 'mt-8' : ''}`}>
        <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left">
          <img src={studentData.photo} alt={studentData.name} className="w-32 h-32 rounded-full object-cover border-4 border-gray-700 mb-4 md:mb-0 md:mr-8"/>
          <div>
            <h2 className="text-3xl font-bold text-white">{studentData.name}</h2>
            <p className="text-gray-400">ID: {studentData.id}</p>
            <p className="text-gray-400">Course: {getDataNameById(courses, studentData.courseId)}</p>
             <div className={`mt-3 inline-block px-3 py-1 text-sm font-semibold rounded-full ${statusBgColor} ${statusTextColor}`}>
                {statusText}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-700">
            <h3 className="text-2xl font-bold text-white mb-6">My Attendance Analytics</h3>
            <AttendanceVisuals 
                studentAttendance={studentAttendance} 
                percentage={percentage}
                statusColor={statusColor}
            />
        </div>


        <div className="mt-8 pt-8 border-t border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-white">My Attendance History</h3>
             {studentAttendance.length > 0 && (
                <button onClick={handleExportCSV} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center space-x-2">
                   <DownloadIcon /> <span>Export CSV</span>
                </button>
             )}
          </div>

          {studentAttendance.length > 0 ? (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left">
                <thead className="text-xs text-gray-400 uppercase bg-gray-700 sticky top-0">
                  <tr>
                    <th scope="col" className="px-6 py-3">Date</th>
                    <th scope="col" className="px-6 py-3">Unit</th>
                    <th scope="col" className="px-6 py-3">Time Marked</th>
                  </tr>
                </thead>
                <tbody>
                  {studentAttendance.map(record => (
                    <tr key={record.timestamp} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-600">
                      <td className="px-6 py-4 font-medium text-white">{new Date(record.timestamp).toLocaleDateString()}</td>
                      <td className="px-6 py-4">{getDataNameById(units, record.unitId)}</td>
                      <td className="px-6 py-4">{new Date(record.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center">You have no attendance records yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// --- SVG Icons ---
const Spinner = () => (
    <svg className="animate-spin h-12 w-12 text-cyan-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);
const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
const ClockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-yellow-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
const ErrorIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);


export default StudentDashboard;