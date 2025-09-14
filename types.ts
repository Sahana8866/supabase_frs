export interface Student {
  id: string;
  name: string;
  photo: string; // base64 encoded image
  courseId: string;
}

export type UserRole = 'ADMIN' | 'LECTURER' | 'STUDENT';

export interface User {
  id:string;
  email: string;
  password: string; 
  name: string;
  role: UserRole;
  studentId?: string;
  photo?: string; // For lecturers
}

export interface Course {
    id: string;
    name: string;
}

export interface Unit {
    id: string;
    name: string;
    courseId: string;
}

export interface Venue {
    id: string;
    name: string;
    latitude?: number;
    longitude?: number;
}

export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  timestamp: string;
  courseId: string;
  unitId: string;
  venueId?: string; // Optional for dynamic sessions
  sessionLocation?: { // For lecturer-defined session locations
    latitude: number;
    longitude: number;
    altitude?: number | null;
  };
  sessionRadius?: number; // Radius in meters for the session
  geo?: { // Student's location
    latitude: number;
    longitude: number;
    altitude?: number | null;
  };
}

export interface LecturerAttendanceRecord {
  userId: string;
  userName: string;
  timestamp: string;
  geo?: {
    latitude: number;
    longitude: number;
    altitude?: number | null;
  };
}


// Session started by a Lecturer for students
export interface StudentSession {
  course: Course;
  unit: Unit;
  startTime: string;
  lecturerId: string;
  lockedLocation: {
    latitude: number;
    longitude: number;
    altitude?: number | null;
  };
  radius: number; // in meters
}

// Session started by an Admin for lecturers
export interface FacultySession {
  id: string;
  name: string;
  startTime: string;
  lockedLocation: {
    latitude: number;
    longitude: number;
    altitude?: number | null;
  };
  radius: number; // in meters
}


export type Page = 
  | 'LOGIN'
  | 'ADMIN_DASHBOARD'
  | 'LECTURER_DASHBOARD'
  | 'STUDENT_DASHBOARD'
  | 'ADD_STUDENT' 
  | 'TAKE_ATTENDANCE' 
  | 'VIEW_ATTENDANCE'
  | 'MANAGE_LECTURERS'
  | 'TAKE_LECTURER_ATTENDANCE'
  | 'VIEW_LECTURER_ATTENDANCE';