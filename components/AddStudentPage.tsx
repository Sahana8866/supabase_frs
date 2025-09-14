
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Page, Student, User, Course } from '../types';
import { useCamera } from '../hooks/useCamera';

interface AddStudentPageProps {
  setPage: (page: Page) => void;
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  courses: Course[];
}

type AddMode = 'SINGLE' | 'BULK';
type BulkAddStep = 'UPLOAD' | 'CAPTURE' | 'REVIEW';

const AddStudentPage: React.FC<AddStudentPageProps> = ({ 
  setPage, 
  students, 
  setStudents, 
  users, 
  setUsers, 
  courses, 
}) => {
  // --- Common State & Hooks ---
  const { videoRef, canvasRef, isCameraOn, error, startCamera, stopCamera, capturePhoto } = useCamera();
  const [addMode, setAddMode] = useState<AddMode>('SINGLE');
  const [searchQuery, setSearchQuery] = useState('');

  // --- Single Student State ---
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [lastAddedStudent, setLastAddedStudent] = useState<Student | null>(null);
  
  // --- Bulk Add State ---
  const [bulkAddStep, setBulkAddStep] = useState<BulkAddStep>('UPLOAD');
  const [studentsToRegister, setStudentsToRegister] = useState<(Omit<Student, 'photo'> & { photo: string | null })[]>([]);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [bulkMessage, setBulkMessage] = useState<{ text: string, type: 'error' | 'success'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Camera Management for Bulk Add ---
  useEffect(() => {
    if (addMode === 'BULK' && bulkAddStep === 'CAPTURE' && !isCameraOn) {
      startCamera();
    } else if (addMode !== 'BULK' || bulkAddStep !== 'CAPTURE') {
      if (isCameraOn) {
        stopCamera();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMode, bulkAddStep]);
  
  // --- Single Student Handlers ---
  const handleCapture = () => {
    const imageDataUrl = capturePhoto();
    if (imageDataUrl) {
      setPhoto(imageDataUrl);
      stopCamera();
    }
  };

  const handleRetake = () => {
    setPhoto(null);
    startCamera();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !id || !photo || !courseId) {
      setMessage({ text: 'Please fill all fields, select a course, and capture a photo.', type: 'error' });
      setLastAddedStudent(null);
      return;
    }
    if (students.some(s => s.id === id) || users.some(u => u.email === `${id}@school.com`)) {
        setMessage({ text: 'A student with this ID or email already exists.', type: 'error' });
        setLastAddedStudent(null);
        return;
    }

    const newStudent: Student = { id, name, photo, courseId };
    const newStudentUser: User = {
      id: `user-${id}`,
      email: `${id}@school.com`,
      password: 'password', // Default password
      name: name,
      role: 'STUDENT',
      studentId: id,
    };

    setStudents(prev => [...prev, newStudent]);
    setUsers(prev => [...prev, newStudentUser]);
    setLastAddedStudent(newStudent);
    setMessage({ text: `Student ${name} added successfully! Their login is ${newStudentUser.email} with password 'password'.`, type: 'success' });
    
    setName('');
    setId('');
    setPhoto(null);
    setCourseId('');
    setTimeout(() => {
        setLastAddedStudent(null);
        setMessage(null);
    }, 8000);
  };

  // --- Bulk Add Handlers ---
  const handleStartOver = () => {
    setBulkAddStep('UPLOAD');
    setStudentsToRegister([]);
    setCurrentStudentIndex(0);
    setBulkMessage(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
    if (isCameraOn) {
        stopCamera();
    }
  };

  const handleDownloadSample = () => {
    const csvContent = "data:text/csv;charset=utf-8,id,name,courseId\n101,John Doe,cs-101\n102,Jane Smith,ba-201";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sample_students.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBulkMessage(null);
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) throw new Error('CSV file must have a header and at least one student record.');

            const header = lines[0].split(',').map(h => h.trim().toLowerCase());
            const idIndex = header.indexOf('id');
            const nameIndex = header.indexOf('name');
            const courseIdIndex = header.indexOf('courseid');
            if (idIndex === -1 || nameIndex === -1 || courseIdIndex === -1) throw new Error("CSV header must contain 'id', 'name', and 'courseId' columns.");

            const newStudents: (Omit<Student, 'photo'> & { photo: string | null })[] = [];
            const seenIds = new Set<string>();

            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].split(',');
                const studentId = row[idIndex]?.trim();
                const studentName = row[nameIndex]?.trim();
                const studentCourseId = row[courseIdIndex]?.trim();

                if (!studentId || !studentName || !studentCourseId) throw new Error(`Error on line ${i + 1}: ID, Name, and CourseID cannot be empty.`);
                if (students.some(s => s.id === studentId)) throw new Error(`Error on line ${i + 1}: Student ID '${studentId}' already exists in the system.`);
                if (!courses.some(c => c.id === studentCourseId)) throw new Error(`Error on line ${i + 1}: Course ID '${studentCourseId}' is not a valid course.`);
                if (seenIds.has(studentId)) throw new Error(`Error on line ${i + 1}: Duplicate Student ID '${studentId}' found in the CSV file.`);
                
                seenIds.add(studentId);
                newStudents.push({ id: studentId, name: studentName, courseId: studentCourseId, photo: null });
            }
            
            setStudentsToRegister(newStudents);
            setBulkAddStep('CAPTURE');
        } catch(err: any) {
            setBulkMessage({ text: err.message, type: 'error' });
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    reader.readAsText(file);
  };

  const handleBulkCapture = () => {
    const imageDataUrl = capturePhoto();
    if (imageDataUrl) {
        const updatedStudents = [...studentsToRegister];
        updatedStudents[currentStudentIndex].photo = imageDataUrl;
        setStudentsToRegister(updatedStudents);
    }
  };

  const handleBulkRetake = () => {
    const updatedStudents = [...studentsToRegister];
    updatedStudents[currentStudentIndex].photo = null;
    setStudentsToRegister(updatedStudents);
  };

  const handleConfirmAndNext = () => {
    if (currentStudentIndex < studentsToRegister.length - 1) {
        setCurrentStudentIndex(currentStudentIndex + 1);
    } else {
        stopCamera();
        setBulkAddStep('REVIEW');
    }
  };

  const handleSaveAll = () => {
    const newStudents = studentsToRegister.filter(s => s.photo !== null) as Student[];
    const newUsers: User[] = newStudents.map(student => ({
        id: `user-${student.id}`,
        email: `${student.id}@school.com`,
        password: 'password',
        name: student.name,
        role: 'STUDENT',
        studentId: student.id,
    }));
    setStudents(prev => [...prev, ...newStudents]);
    setUsers(prev => [...prev, ...newUsers]);
    setBulkMessage({ text: `${newStudents.length} students added successfully!`, type: 'success' });
    setTimeout(() => {
       handleStartOver();
    }, 3000);
  };
  
  const currentBulkStudent = studentsToRegister[currentStudentIndex];

  const filteredStudents = useMemo(() => students.filter(student => 
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.id.toLowerCase().includes(searchQuery.toLowerCase())
  ), [students, searchQuery]);
  

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-cyan-400">Manage Students</h2>

      <div className="flex border-b border-gray-700 mb-6">
        <button onClick={() => setAddMode('SINGLE')} className={`py-2 px-4 font-semibold transition-colors duration-300 ${addMode === 'SINGLE' ? 'border-b-2 border-cyan-400 text-white' : 'text-gray-400 hover:text-white'}`}>
          Add Single Student
        </button>
        <button onClick={() => setAddMode('BULK')} className={`py-2 px-4 font-semibold transition-colors duration-300 ${addMode === 'BULK' ? 'border-b-2 border-cyan-400 text-white' : 'text-gray-400 hover:text-white'}`}>
          Add Multiple Students
        </button>
      </div>

      {addMode === 'SINGLE' && (
         <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Camera Feed</h3>
            <div className="aspect-video bg-gray-900 rounded-md overflow-hidden relative">
                {photo ? (
                <img src={photo} alt="Captured student" className="w-full h-full object-cover" />
                ) : (
                <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover scale-x-[-1] ${!isCameraOn && 'hidden'}`}></video>
                )}
                {!isCameraOn && !photo && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <button onClick={startCamera} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded transition-colors">
                    Start Camera
                    </button>
                </div>
                )}
                {error && <p className="text-red-500 text-center absolute inset-0 flex items-center justify-center">{error}</p>}
            </div>
            <canvas ref={canvasRef} className="hidden"></canvas>
            <div className="mt-4 flex justify-center space-x-4">
                {isCameraOn && !photo && (
                <button onClick={handleCapture} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded w-full">
                    Capture Photo
                </button>
                )}
                {photo && (
                <button onClick={handleRetake} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded w-full">
                    Retake
                </button>
                )}
            </div>
            </div>
    
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Student Details</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label htmlFor="student-id" className="block text-sm font-medium text-gray-300">Student ID</label>
                    <input type="text" id="student-id" value={id} onChange={(e) => setId(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" required />
                </div>
                <div>
                    <label htmlFor="student-name" className="block text-sm font-medium text-gray-300">Student Name</label>
                    <input type="text" id="student-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" required />
                </div>
                <div>
                    <label htmlFor="course-select" className="block text-sm font-medium text-gray-300">Course</label>
                    <select id="course-select" value={courseId} onChange={e => setCourseId(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" required>
                        <option value="">Select a Course</option>
                        {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
                    </select>
                </div>

                {message && (
                <div className={`p-3 rounded-md text-sm ${message.type === 'error' ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
                    {message.text}
                </div>
                )}
               
                <button type="submit" disabled={!photo || !name || !id || !courseId} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
                 Add Student
                </button>
            </form>
            </div>
      </div>
      )}

      {addMode === 'BULK' && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg min-h-[400px]">
          {bulkMessage && (
            <div className={`p-3 mb-4 rounded-md text-sm ${bulkMessage.type === 'error' ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
                {bulkMessage.text}
            </div>
          )}

          {bulkAddStep === 'UPLOAD' && (
            <div>
              <h3 className="text-xl font-semibold mb-4">Step 1: Upload CSV</h3>
              <p className="text-gray-400 mb-4">Upload a CSV file with 'id', 'name', and 'courseId' columns for the students you want to add.</p>
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                <UploadIcon />
                <input type="file" accept=".csv" onChange={handleFileChange} ref={fileInputRef} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-700"/>
              </div>
              <div className="mt-4 text-center">
                <button onClick={handleDownloadSample} className="text-cyan-400 hover:text-cyan-300 text-sm">Download sample.csv</button>
              </div>
            </div>
          )}
          
          {bulkAddStep === 'CAPTURE' && currentBulkStudent && (
            <div>
              <h3 className="text-xl font-semibold mb-2">Step 2: Capture Photos</h3>
              <p className="text-lg font-bold text-cyan-400">{`Student ${currentStudentIndex + 1} of ${studentsToRegister.length}: ${currentBulkStudent.name} (${currentBulkStudent.id})`}</p>
              <div className="aspect-video bg-gray-900 rounded-md overflow-hidden relative mt-4">
                 {currentBulkStudent.photo ? ( <img src={currentBulkStudent.photo} alt={`Capture for ${currentBulkStudent.name}`} className="w-full h-full object-cover" />) : (<video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover scale-x-[-1] ${!isCameraOn && 'hidden'}`}></video>)}
                 {error && <p className="text-red-500 text-center absolute inset-0 flex items-center justify-center">{error}</p>}
              </div>
              <canvas ref={canvasRef} className="hidden"></canvas>
              <div className="mt-4 flex justify-center space-x-4">
                {!currentBulkStudent.photo ? (<button onClick={handleBulkCapture} disabled={!isCameraOn} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded w-1/3 disabled:bg-gray-600">Capture</button>) : (
                    <>
                        <button onClick={handleBulkRetake} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded w-1/3">Retake</button>
                        <button onClick={handleConfirmAndNext} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded w-1/3">
                            {currentStudentIndex < studentsToRegister.length - 1 ? 'Confirm & Next' : 'Finish & Review'}
                        </button>
                    </>
                )}
              </div>
            </div>
          )}
          
          {bulkAddStep === 'REVIEW' && (
             <div>
                <h3 className="text-xl font-semibold mb-4">Step 3: Review & Save</h3>
                <p className="text-gray-400 mb-4">Review the students and their captured photos before adding them to the system.</p>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                  {studentsToRegister.map(student => (
                    <div key={student.id} className="bg-gray-700 p-3 rounded-md flex items-center space-x-4">
                        <img src={student.photo!} alt={student.name} className="w-16 h-16 rounded-lg object-cover border-2 border-gray-500" />
                        <div>
                           <p className="font-semibold text-white">{student.name}</p>
                           <p className="text-sm text-gray-400">ID: {student.id}</p>
                        </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={handleStartOver} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Start Over</button>
                    <button onClick={handleSaveAll} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded">Save All Students</button>
                </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-12">
        <h3 className="text-2xl font-bold mb-4 text-cyan-400">Registered Students</h3>
        <div className="mb-4">
          <input type="search" placeholder="Search students by name or ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"/>
        </div>
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          {filteredStudents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-gray-400 uppercase bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3">Photo</th>
                    <th scope="col" className="px-6 py-3">Student Name</th>
                    <th scope="col" className="px-6 py-3">Student ID</th>
                    <th scope="col" className="px-6 py-3">Course</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(student => (
                    <tr key={student.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-600">
                      <td className="px-6 py-4"><img src={student.photo} alt={student.name} className="w-12 h-12 rounded-full object-cover"/></td>
                      <td className="px-6 py-4 font-medium text-white">{student.name}</td>
                      <td className="px-6 py-4 text-gray-300">{student.id}</td>
                      <td className="px-6 py-4 text-gray-300">{courses.find(c => c.id === student.courseId)?.name || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center p-8">
              {searchQuery ? `No students found for "${searchQuery}".` : 'No students have been added yet.'}
            </p>
          )}
        </div>
      </div>

      <button onClick={() => setPage('ADMIN_DASHBOARD')} className="mt-8 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors">
        Back to Dashboard
      </button>
    </div>
  );
};

const UploadIcon = () => (
    <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);


export default AddStudentPage;
