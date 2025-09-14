import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Page, Course, Unit, Venue, User, FacultySession, LecturerAttendanceRecord, StudentSession } from '../types';
import { useCamera } from '../hooks/useCamera';
import { compareFaces } from '../utils/gemini';
import { calculateDistance } from '../utils/geolocation';
import { getGeoLocation, searchLocation } from '../utils/location';

// --- Global declaration for Leaflet ---
declare const L: any;

type Status = 'READY' | 'CAPTURING' | 'VERIFYING' | 'SUBMITTING' | 'CONFIRMED' | 'ERROR' | 'OFFLINE_QUEUED';

// --- Analytics Sub-component ---
const TickIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 text-emerald-300">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
);

const AttendanceVisuals: React.FC<{ 
    lecturerAttendance: LecturerAttendanceRecord[], 
    percentage: number,
    statusColor: string
}> = ({ lecturerAttendance, percentage, statusColor }) => {
    
    const monthlyData = useMemo(() => {
        const months: { [key: string]: number } = {};
        const sortedAttendance = [...lecturerAttendance].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        sortedAttendance.forEach(record => {
            const month = new Date(record.timestamp).toLocaleString('default', { month: 'short', year: '2-digit' });
            months[month] = (months[month] || 0) + 1;
        });
        const labels = Object.keys(months);
        const data = labels.map(label => months[label]);
        return { labels, data };
    }, [lecturerAttendance]);

    const heatmapData = useMemo(() => {
        return new Set(lecturerAttendance.map(r => new Date(r.timestamp).toDateString()));
    }, [lecturerAttendance]);

    const today = new Date();
    const calendarMonths = Array.from({ length: 4 }).map((_, i) => {
        const d = new Date(today);
        d.setMonth(d.getMonth() - i);
        return d;
    }).reverse();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`p-6 rounded-lg shadow-lg flex flex-col justify-center items-center text-center border-b-4 ${statusColor} bg-gray-700/50`}>
                <div className="text-5xl font-bold text-white">{percentage.toFixed(0)}%</div>
                <div className="text-lg font-semibold text-gray-200 mt-2">Overall Attendance</div>
            </div>

            <div className="lg:col-span-2 bg-gray-700/50 p-6 rounded-lg shadow-lg">
                <h4 className="font-bold text-lg mb-4 text-gray-200">Monthly Presence</h4>
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


// --- Component ---
interface LecturerDashboardProps {
  user: User;
  setPage: (page: Page) => void;
  onStartStudentSession: (context: Omit<StudentSession, 'startTime'>) => void;
  courses: Course[];
  units: Unit[];
  venues: Venue[];
  facultySession: FacultySession | null;
  lecturerAttendance: LecturerAttendanceRecord[];
  setLecturerAttendance: React.Dispatch<React.SetStateAction<LecturerAttendanceRecord[]>>;
}

const LecturerDashboard: React.FC<LecturerDashboardProps> = ({ 
  user,
  setPage, 
  onStartStudentSession, 
  courses, 
  units, 
  venues,
  facultySession,
  lecturerAttendance,
  setLecturerAttendance,
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [radius, setRadius] = useState(100);
  const [error, setError] = useState('');
  
  // --- Location & Map State ---
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [locationError, setLocationError] = useState('');
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  
  // --- Faculty Attendance State ---
  const [status, setStatus] = useState<Status>('READY');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { videoRef, canvasRef, isVideoReady, error: cameraError, startCamera, stopCamera, capturePhoto } = useCamera();
  const [isDistanceError, setIsDistanceError] = useState(false);
  const [lecturerLocation, setLecturerLocation] = useState<GeolocationCoordinates | null>(null);
  const [showErrorMap, setShowErrorMap] = useState(false);
  const errorMapRef = useRef<any>(null);

  const filteredUnits = units.filter(unit => unit.courseId === selectedCourseId);

  // --- Location & Map Effects ---
  useEffect(() => {
    getGeoLocation()
      .then(pos => setLocation(pos))
      .catch(err => setLocationError(err.message))
      .finally(() => setIsLocating(false));
  }, []);

  useEffect(() => {
    if (location && !mapRef.current) {
      const map = L.map('lecturer-map-container').setView([location.coords.latitude, location.coords.longitude], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      mapRef.current = map;

      markerRef.current = L.marker([location.coords.latitude, location.coords.longitude]).addTo(map)
        .bindPopup('Session Location').openPopup();

      circleRef.current = L.circle([location.coords.latitude, location.coords.longitude], {
        radius,
        color: '#06b6d4',
        fillColor: '#0e7490',
        fillOpacity: 0.3
      }).addTo(map);
    } else if (location && mapRef.current) {
        const latLng: [number, number] = [location.coords.latitude, location.coords.longitude];
        mapRef.current.setView(latLng);
        markerRef.current.setLatLng(latLng);
        circleRef.current.setLatLng(latLng);
    }
  }, [location]);

  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius);
    }
  }, [radius]);


  const handleStart = () => {
    if (!selectedCourseId || !selectedUnitId) {
        setError('Please select a course and unit to start.');
        return;
    }
     if (radius < 10 || radius > 5000) {
        setError('Radius must be between 10 and 5000 meters.');
        return;
    }
    if (!location) {
        setError('Could not get your location. Please enable location services and try again.');
        return;
    }
    setError('');

    const context = {
        course: courses.find(c => c.id === selectedCourseId)!,
        unit: units.find(u => u.id === selectedUnitId)!,
        lecturerId: user.id,
        lockedLocation: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            altitude: location.coords.altitude,
        },
        radius: radius
    };
    onStartStudentSession(context);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);
    try {
        const results = await searchLocation(searchQuery);
        if (results.length === 0) {
            setSearchError('No locations found.');
        }
        setSearchResults(results);
    } catch (error) {
        setSearchError('Failed to search. Please try again.');
    } finally {
        setIsSearching(false);
    }
  };

  const handleSelectLocation = (result: any) => {
    const newLocation: GeolocationPosition = {
        coords: {
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
            altitude: null, accuracy: 100, altitudeAccuracy: null, heading: null, speed: null,
        },
        timestamp: Date.now(),
    };
    setLocation(newLocation);
    setLocationError('');
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',')[0]);
  };


  // --- Attendance Marking Logic ---
  const isAlreadyMarked = useMemo(() => {
    if (!facultySession) return false;
    return lecturerAttendance.some(
      record => record.userId === user.id &&
                new Date(record.timestamp).toDateString() === new Date(facultySession!.startTime).toDateString()
    );
  }, [facultySession, user.id, lecturerAttendance]);

  useEffect(() => {
    if (cameraError) {
        setErrorMessage(cameraError);
        setStatus('ERROR');
    }
  }, [cameraError]);

   const handleStartCamera = () => {
    setStatus('CAPTURING');
    startCamera();
  };

  const handleRetry = () => {
      setStatus('READY');
      setErrorMessage(null);
      setIsDistanceError(false);
      setShowErrorMap(false);
      if (videoRef.current?.srcObject) {
          stopCamera();
      }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setIsDistanceError(false);
    const photoBase64 = capturePhoto();

    if (!photoBase64 || !user.photo || !facultySession) {
        setErrorMessage('Could not capture photo or session data is missing.');
        setStatus('ERROR');
        return;
    }
    
    stopCamera();
    setStatus('VERIFYING');

    try {
        const isMatch = await compareFaces(user.photo, photoBase64);
        if (!isMatch) {
            setErrorMessage('Face does not match registered photo. Please try again.');
            setStatus('ERROR');
            return;
        }

        setStatus('SUBMITTING');
        const currentLocation = await getGeoLocation();
        setLecturerLocation(currentLocation.coords);

        const distance = calculateDistance(
            currentLocation.coords.latitude,
            currentLocation.coords.longitude,
            facultySession.lockedLocation.latitude,
            facultySession.lockedLocation.longitude
        );

        if (distance > facultySession.radius) {
            setErrorMessage(`You are not in the attendance zone. You are ~${Math.round(distance)}m away from the center.`);
            setStatus('ERROR');
            setIsDistanceError(true);
            return;
        }

        const newRecord: LecturerAttendanceRecord = {
            userId: user.id,
            userName: user.name,
            timestamp: new Date().toISOString(),
            geo: { 
                latitude: currentLocation.coords.latitude, 
                longitude: currentLocation.coords.longitude,
                altitude: currentLocation.coords.altitude
            },
        };

        if (navigator.onLine) {
            setLecturerAttendance(prev => [...prev, newRecord]);
            setStatus('CONFIRMED');
        } else {
            setStatus('CONFIRMED');
        }
    } catch (err: any) {
        setErrorMessage(err.message || 'An unknown error occurred.');
        setStatus('ERROR');
    }
  };
  
  // --- Error Map Effect ---
  useEffect(() => {
    if (showErrorMap && facultySession && lecturerLocation) {
        const sessionPos: [number, number] = [facultySession.lockedLocation.latitude, facultySession.lockedLocation.longitude];
        const lecturerPos: [number, number] = [lecturerLocation.latitude, lecturerLocation.longitude];

        if (errorMapRef.current) errorMapRef.current.remove();
        
        const map = L.map('lecturer-error-map-container').setView(sessionPos, 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        errorMapRef.current = map;

        L.marker(sessionPos).addTo(map).bindPopup('Session Location (Center of Zone)');
        L.circle(sessionPos, {
            radius: facultySession.radius,
            color: '#22c55e',
            fillColor: '#16a34a',
            fillOpacity: 0.3
        }).addTo(map);

        L.marker(lecturerPos).addTo(map).bindPopup('Your Current Location');

        const bounds = L.latLngBounds([sessionPos, lecturerPos]);
        map.fitBounds(bounds.pad(0.5));
    }
  }, [showErrorMap, facultySession, lecturerLocation]);


  const renderLecturerAttendanceUI = () => {
    if (!facultySession) return null;
    
    let content;

    if (isAlreadyMarked || status === 'CONFIRMED') {
        content = (
            <div className="text-center">
                <CheckCircleIcon />
                <h3 className="text-2xl font-bold text-white mt-4">Attendance Marked!</h3>
                <p className="text-gray-400 mt-2">You have been successfully marked present.</p>
            </div>
        );
    } else {
        switch(status) {
            case 'READY': content = (
                <div className="text-center">
                    <h3 className="text-xl font-bold text-white">Ready to Mark Attendance</h3>
                    <p className="text-gray-400 mt-2">Click below to start your camera.</p>
                    <button onClick={handleStartCamera} className="mt-6 w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-lg text-lg">Start Camera</button>
                </div>
            ); break;
            case 'CAPTURING': content = (
                <div>
                    <div className="aspect-video bg-gray-900 rounded-md overflow-hidden relative">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]"></video>
                        <canvas ref={canvasRef} className="hidden"></canvas>
                    </div>
                    <button onClick={handleSubmit} disabled={!isVideoReady} className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg text-lg disabled:bg-gray-600">{isVideoReady ? 'Verify & Submit' : 'Camera starting...'}</button>
                </div>
            ); break;
            case 'VERIFYING': content = (
                <div className="text-center"><Spinner /><h3 className="text-xl font-bold text-white mt-4">Verifying Face...</h3></div>
            ); break;
            case 'SUBMITTING': content = (
                <div className="text-center"><Spinner /><h3 className="text-xl font-bold text-white mt-4">Processing...</h3></div>
            ); break;
            case 'ERROR': content = (
                <div className="text-center">
                    <ErrorIcon />
                    <h3 className="text-2xl font-bold text-white mt-4">Submission Failed</h3>
                    <p className="text-red-400 mt-2">{errorMessage}</p>
                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <button onClick={handleRetry} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg">Try Again</button>
                        {isDistanceError && (
                            <button onClick={() => setShowErrorMap(!showErrorMap)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
                                {showErrorMap ? 'Hide Map' : 'Show on Map'}
                            </button>
                        )}
                    </div>
                    {showErrorMap && <div id="lecturer-error-map-container" className="h-64 mt-4 w-full bg-gray-700 rounded-lg" aria-label="Map showing your location relative to the session zone"></div>}
                </div>
            ); break;
            default: content = null;
        }
    }
    
    return (
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-lg shadow-lg p-6 mb-8">
        <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-white">Faculty Attendance Session</h2>
            <p className="text-indigo-200">Session for <strong>{facultySession?.name}</strong> is active.</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 min-h-[250px] flex items-center justify-center">
            {content}
        </div>
      </div>
    );
  }

  const currentUserAttendance = useMemo(() => 
    lecturerAttendance.filter(r => r.userId === user.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
  [lecturerAttendance, user.id]);

  const { percentage, statusColor, statusText, statusTextColor, statusBgColor } = useMemo(() => {
    const totalLecturerSessionDays = new Set(lecturerAttendance.map(r => new Date(r.timestamp).toDateString())).size;
    const lecturerPresentDays = new Set(currentUserAttendance.map(r => new Date(r.timestamp).toDateString())).size;
    const perc = totalLecturerSessionDays > 0 ? (lecturerPresentDays / totalLecturerSessionDays) * 100 : 0;

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
  }, [currentUserAttendance, lecturerAttendance]);

  const handleExportCSV = () => {
    if (currentUserAttendance.length === 0) {
      alert("You have no attendance records to export.");
      return;
    }

    const csvHeader = "Name,Date,Time\n";
    const csvRows = currentUserAttendance.map(record => {
        const date = new Date(record.timestamp);
        return `"${record.userName}","${date.toLocaleDateString()}","${date.toLocaleTimeString()}"`
    }).join("\n");

    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `lecturer_attendance_${user.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="max-w-6xl mx-auto">
        {renderLecturerAttendanceUI()}
        <h2 className="text-3xl font-bold mb-6 text-cyan-400">Lecturer Dashboard</h2>
        <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold mb-4 text-white">Start New Student Session</h3>
                <div className="space-y-4">
                    {/* Course & Unit Selection */}
                    <div>
                        <label htmlFor="course-select" className="block text-sm font-medium text-gray-300">1. Select Course & Unit</label>
                        <select id="course-select" value={selectedCourseId} onChange={e => {setSelectedCourseId(e.target.value); setSelectedUnitId('');}} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                            <option value="">Select a Course</option>
                            {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
                        </select>
                        <select id="unit-select" value={selectedUnitId} onChange={e => setSelectedUnitId(e.target.value)} disabled={!selectedCourseId} className="mt-2 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-600">
                            <option value="">Select a Unit</option>
                            {filteredUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                        </select>
                    </div>

                    {/* Map & Location Section */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">2. Set Location & Radius</label>
                        <button onClick={() => { setIsLocating(true); setLocationError(''); getGeoLocation().then(pos => { setLocation(pos); setLocationError('')}).catch(err => setLocationError(err.message)).finally(() => setIsLocating(false))}} disabled={isLocating} className="mb-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-gray-600">
                            Use My Current Location
                        </button>
                        <div className="relative">
                            <div className="flex gap-2">
                                <input type="search" placeholder="Or search for a location..." value={searchQuery} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} onChange={e => { setSearchQuery(e.target.value); setSearchResults([]) }} className="flex-grow w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"/>
                                <button onClick={handleSearch} disabled={isSearching} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md disabled:bg-gray-500">{isSearching ? '...' : 'Search'}</button>
                            </div>
                            {(searchResults.length > 0 || searchError) && (
                                <ul className="absolute z-10 w-full bg-gray-600 text-white rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                                    {searchError && <li className="px-3 py-2 text-red-300">{searchError}</li>}
                                    {searchResults.map((result) => (
                                        <li key={result.place_id}>
                                            <button onClick={() => handleSelectLocation(result)} className="w-full text-left px-3 py-2 hover:bg-cyan-600 focus:bg-cyan-600 focus:outline-none transition-colors duration-150">
                                                {result.display_name}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div id="lecturer-map-container" className="h-64 mt-2 w-full bg-gray-700 rounded-lg" aria-label="Map showing current location for attendance geofencing">
                            {isLocating && <div className="flex items-center justify-center h-full text-gray-400">Locating...</div>}
                            {locationError && <div className="flex items-center justify-center h-full text-red-400 p-4">{locationError}</div>}
                        </div>
                        {location && (
                            <div className="bg-gray-700 p-2 rounded-md text-xs text-gray-300 grid grid-cols-2 gap-2">
                                <p><b>Lat:</b> {location.coords.latitude.toFixed(5)}</p>
                                <p><b>Lon:</b> {location.coords.longitude.toFixed(5)}</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Radius Input */}
                    <div>
                        <label htmlFor="radius-input" className="block text-sm font-medium text-gray-300">Attendance Radius ({radius} meters)</label>
                        <input id="radius-input" type="range" min="10" max="1000" step="10" value={radius} onChange={e => setRadius(parseInt(e.target.value, 10))} className="mt-1 block w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                    </div>

                    {error && <p className="text-red-500 text-sm">{error}</p>}
                     <button onClick={handleStart} disabled={isLocating || !!locationError} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
                        {isLocating ? 'Getting Location...' : 'Start Student Session'}
                    </button>
                </div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center justify-center">
                 <h3 className="text-xl font-semibold mb-4 text-white">Manage Student Attendance</h3>
                 <p className="text-gray-400 mb-6 text-center">View, manage, and export attendance records for all student sessions.</p>
                 <button onClick={() => setPage('VIEW_ATTENDANCE')} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors">
                    View All Student Records
                </button>
            </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left mb-8">
                <img src={user.photo} alt={user.name} className="w-24 h-24 rounded-full object-cover border-4 border-gray-700 mb-4 md:mb-0 md:mr-6"/>
                <div>
                    <h2 className="text-2xl font-bold text-white">My Attendance Analytics</h2>
                    <p className="text-gray-400">A summary of your attendance for official sessions.</p>
                     <div className={`mt-2 inline-block px-3 py-1 text-sm font-semibold rounded-full ${statusBgColor} ${statusTextColor}`}>
                        {statusText}
                    </div>
                </div>
            </div>
            
            <AttendanceVisuals 
                lecturerAttendance={currentUserAttendance} 
                percentage={percentage}
                statusColor={statusColor}
            />

            <div className="mt-8 pt-8 border-t border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-white">My Attendance History</h3>
                     {currentUserAttendance.length > 0 && (
                        <button onClick={handleExportCSV} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center space-x-2">
                           <DownloadIcon /> <span>Export My CSV</span>
                        </button>
                     )}
                </div>
                {currentUserAttendance.length > 0 ? (
                    <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-left">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700 sticky top-0">
                        <tr>
                            <th scope="col" className="px-6 py-3">Date</th>
                            <th scope="col" className="px-6 py-3">Time Marked</th>
                        </tr>
                        </thead>
                        <tbody>
                        {currentUserAttendance.map(record => (
                            <tr key={record.timestamp} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-600">
                            <td className="px-6 py-4 font-medium text-white">{new Date(record.timestamp).toLocaleDateString()}</td>
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
const Spinner = () => (<svg className="animate-spin h-12 w-12 text-cyan-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>);
const CheckCircleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const ErrorIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const DownloadIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>);

export default LecturerDashboard;
