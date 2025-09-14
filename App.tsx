import React, { useState, useEffect } from 'react';
import type {
  Page,
  User,
  Course,
  Unit,
  Venue,
  Student,
  AttendanceRecord,
  StudentSession,
  FacultySession,
  LecturerAttendanceRecord,
} from './types';

import LoginPage from './components/LoginPage';
import AdminDashboard from './components/AdminDashboard';
import LecturerDashboard from './components/LecturerDashboard';
import StudentDashboard from './components/StudentDashboard';
import AddStudentPage from './components/AddStudentPage';
import TakeAttendancePage from './components/TakeAttendancePage';
import AttendanceListPage from './components/AttendanceListPage';
import Header from './components/Header';
import ManageLecturersPage from './components/ManageLecturersPage';
import TakeLecturerAttendancePage from './components/TakeLecturerAttendancePage';
import ViewLecturerAttendancePage from './components/ViewLecturerAttendancePage';

import { supabase } from './utils/supabaseClient'; // ✅ new import

// --- Seed Data ---
const INITIAL_COURSES: Course[] = [
  { id: 'cs-101', name: 'Bachelor of Computer Science' },
  { id: 'ba-201', name: 'Bachelor of Business Administration' },
];

const INITIAL_UNITS: Unit[] = [
  { id: 'cs-u1', name: 'Introduction to Programming', courseId: 'cs-101' },
  { id: 'cs-u2', name: 'Data Structures and Algorithms', courseId: 'cs-101' },
  { id: 'ba-u1', name: 'Principles of Management', courseId: 'ba-201' },
  { id: 'ba-u2', name: 'Marketing Fundamentals', courseId: 'ba-201' },
];

const INITIAL_VENUES: Venue[] = [
  { id: 'lh-1', name: 'Lecture Hall 1', latitude: 34.0522, longitude: -118.2437 },
  { id: 'cl-a', name: 'Computer Lab A', latitude: 34.0525, longitude: -118.244 },
  { id: 'cr-5', name: 'Conference Room 5', latitude: 34.052, longitude: -118.2435 },
];

const INITIAL_USERS: User[] = [
  { id: 'admin-1', email: 'admin@gmail.com', password: '@admin_', name: 'Admin User', role: 'ADMIN' },
];
// --- End Seed Data ---

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // ✅ students now come from Supabase
  const [students, setStudents] = useState<Student[]>([]);

  const [courses, setCourses] = useState<Course[]>(INITIAL_COURSES);
  const [units, setUnits] = useState<Unit[]>(INITIAL_UNITS);
  const [venues, setVenues] = useState<Venue[]>(INITIAL_VENUES);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  const [studentSession, setStudentSession] = useState<StudentSession | null>(null);
  const [facultySession, setFacultySession] = useState<FacultySession | null>(null);
  const [lecturerAttendance, setLecturerAttendance] = useState<LecturerAttendanceRecord[]>([]);

  const [currentPage, setCurrentPage] = useState<Page>('LOGIN');

  // ✅ Fetch students from Supabase when app loads
  useEffect(() => {
    const getStudents = async () => {
      const { data, error } = await supabase.from('students').select('*');
      if (error) {
        console.error('Error fetching students:', error);
      } else if (data) {
        setStudents(data);
      }
    };

    getStudents();
  }, []);

  useEffect(() => {
    if (currentUser) {
      switch (currentUser.role) {
        case 'ADMIN':
          if (facultySession) {
            setCurrentPage('TAKE_LECTURER_ATTENDANCE');
          } else {
            setCurrentPage('ADMIN_DASHBOARD');
          }
          break;
        case 'LECTURER':
          if (studentSession) {
            setCurrentPage('TAKE_ATTENDANCE');
          } else {
            setCurrentPage('LECTURER_DASHBOARD');
          }
          break;
        case 'STUDENT':
          setCurrentPage('STUDENT_DASHBOARD');
          break;
        default:
          setCurrentPage('LOGIN');
      }
    } else {
      setCurrentPage('LOGIN');
    }
  }, [currentUser, studentSession, facultySession]);

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const handleStartStudentSession = (context: Omit<StudentSession, 'startTime'>) => {
    setStudentSession({
      ...context,
      startTime: new Date().toISOString(),
    });
    setCurrentPage('TAKE_ATTENDANCE');
  };

  const handleEndStudentSession = () => {
    setStudentSession(null);
    setCurrentPage('LECTURER_DASHBOARD');
  };

  const handleStartFacultySession = (
    sessionName: string,
    location: { latitude: number; longitude: number; altitude?: number | null },
    radius: number
  ) => {
    setFacultySession({
      id: `faculty-session-${Date.now()}`,
      name: sessionName,
      startTime: new Date().toISOString(),
      lockedLocation: location,
      radius: radius,
    });
    setCurrentPage('TAKE_LECTURER_ATTENDANCE');
  };

  const handleEndFacultySession = () => {
    setFacultySession(null);
    setCurrentPage('ADMIN_DASHBOARD');
  };

  const renderPage = () => {
    if (!currentUser) {
      return <LoginPage users={users} setCurrentUser={setCurrentUser} />;
    }

    switch (currentPage) {
      case 'ADMIN_DASHBOARD':
        return (
          <AdminDashboard
            setPage={setCurrentPage}
            users={users}
            setUsers={setUsers}
            students={students}
            courses={courses}
            setCourses={setCourses}
            units={units}
            setUnits={setUnits}
            venues={venues}
            setVenues={setVenues}
            attendance={attendance}
            onStartFacultySession={handleStartFacultySession}
          />
        );
      case 'ADD_STUDENT':
        return (
          <AddStudentPage
            setPage={setCurrentPage}
            students={students}
            setStudents={setStudents}
            users={users}
            setUsers={setUsers}
            courses={courses}
          />
        );
      case 'MANAGE_LECTURERS':
        return <ManageLecturersPage setPage={setCurrentPage} users={users} setUsers={setUsers} />;

      case 'LECTURER_DASHBOARD':
        return (
          <LecturerDashboard
            user={currentUser}
            setPage={setCurrentPage}
            onStartStudentSession={handleStartStudentSession}
            courses={courses}
            units={units}
            venues={venues}
            facultySession={facultySession}
            lecturerAttendance={lecturerAttendance}
            setLecturerAttendance={setLecturerAttendance}
          />
        );
      case 'TAKE_ATTENDANCE':
        if (!studentSession) {
          setCurrentPage('LECTURER_DASHBOARD');
          return (
            <LecturerDashboard
              user={currentUser}
              setPage={setCurrentPage}
              onStartStudentSession={handleStartStudentSession}
              courses={courses}
              units={units}
              venues={venues}
              facultySession={facultySession}
              lecturerAttendance={lecturerAttendance}
              setLecturerAttendance={setLecturerAttendance}
            />
          );
        }
        return (
          <TakeAttendancePage
            session={studentSession}
            students={students}
            attendance={attendance}
            endSession={handleEndStudentSession}
          />
        );
      case 'VIEW_ATTENDANCE':
        return (
          <AttendanceListPage
            setPage={setCurrentPage}
            attendance={attendance}
            courses={courses}
            units={units}
            venues={venues}
          />
        );

      case 'TAKE_LECTURER_ATTENDANCE':
        if (!facultySession) {
          setCurrentPage('ADMIN_DASHBOARD');
          return (
            <AdminDashboard
              setPage={setCurrentPage}
              users={users}
              setUsers={setUsers}
              students={students}
              courses={courses}
              setCourses={setCourses}
              units={units}
              setUnits={setUnits}
              venues={venues}
              setVenues={setVenues}
              attendance={attendance}
              onStartFacultySession={handleStartFacultySession}
            />
          );
        }
        return (
          <TakeLecturerAttendancePage
            session={facultySession}
            lecturers={users.filter((u) => u.role === 'LECTURER')}
            attendance={lecturerAttendance}
            endSession={handleEndFacultySession}
          />
        );
      case 'VIEW_LECTURER_ATTENDANCE':
        return <ViewLecturerAttendancePage setPage={setCurrentPage} attendance={lecturerAttendance} />;

      case 'STUDENT_DASHBOARD':
        return (
          <StudentDashboard
            user={currentUser}
            students={students}
            attendance={attendance}
            setAttendance={setAttendance}
            studentSession={studentSession}
            courses={courses}
            units={units}
            venues={venues}
          />
        );

      default:
        switch (currentUser.role) {
          case 'ADMIN':
            return (
              <AdminDashboard
                setPage={setCurrentPage}
                users={users}
                setUsers={setUsers}
                students={students}
                courses={courses}
                setCourses={setCourses}
                units={units}
                setUnits={setUnits}
                venues={venues}
                setVenues={setVenues}
                attendance={attendance}
                onStartFacultySession={handleStartFacultySession}
              />
            );
          case 'LECTURER':
            return (
              <LecturerDashboard
                user={currentUser}
                setPage={setCurrentPage}
                onStartStudentSession={handleStartStudentSession}
                courses={courses}
                units={units}
                venues={venues}
                facultySession={facultySession}
                lecturerAttendance={lecturerAttendance}
                setLecturerAttendance={setLecturerAttendance}
              />
            );
          case 'STUDENT':
            return (
              <StudentDashboard
                user={currentUser}
                students={students}
                attendance={attendance}
                setAttendance={setAttendance}
                studentSession={studentSession}
                courses={courses}
                units={units}
                venues={venues}
              />
            );
          default:
            return <LoginPage users={users} setCurrentUser={setCurrentUser} />;
        }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header user={currentUser} setPage={setCurrentPage} onLogout={handleLogout} />
      <main className="container mx-auto p-4 md:p-8">{renderPage()}</main>
    </div>
  );
};

export default App;
