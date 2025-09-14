import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Page, Student, User, Course } from '../types';
import { useCamera } from '../hooks/useCamera';
import { supabase } from '../utils/supabaseClient';

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

  const handleSubmit = async (e: React.FormEvent) => {
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

    try {
      // Insert into Supabase
      const { error: studentError } = await supabase.from('students').insert([newStudent]);
      if (studentError) throw studentError;

      const { error: userError } = await supabase.from('users').insert([newStudentUser]);
      if (userError) throw userError;

      // Update local state
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
    } catch (err: any) {
      console.error("Error adding student:", err.message);
      setMessage({ text: `Error: ${err.message}`, type: 'error' });
    }
  };

  // --- Bulk Add Handlers ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim() !== '');
  
      const parsedStudents = lines.map(line => {
        const [id, name, courseId] = line.split(',').map(part => part.trim());
        return { id, name, courseId, photo: null };
      });
  
      setStudentsToRegister(parsedStudents);
      setBulkAddStep('CAPTURE');
    };
    reader.readAsText(file);
  };

  const handleCaptureBulk = () => {
    const imageDataUrl = capturePhoto();
    if (imageDataUrl && currentStudentIndex < studentsToRegister.length) {
      const updatedStudents = [...studentsToRegister];
      updatedStudents[currentStudentIndex] = {
        ...updatedStudents[currentStudentIndex],
        photo: imageDataUrl,
      };
      setStudentsToRegister(updatedStudents);

      if (currentStudentIndex + 1 < studentsToRegister.length) {
        setCurrentStudentIndex(prev => prev + 1);
      } else {
        stopCamera();
        setBulkAddStep('REVIEW');
      }
    }
  };

  const handleSaveAll = async () => {
    const newStudents = studentsToRegister.filter(s => s.photo !== null) as Student[];
    const newUsers: User[] = newStudents.map(student => ({
        id: `user-${student.id}`,
        email: `${student.id}@school.com`,
        password: 'password',
        name: student.name,
        role: 'STUDENT',
        studentId: student.id,
    }));

    try {
      const { error: studentError } = await supabase.from('students').insert(newStudents);
      if (studentError) throw studentError;

      const { error: userError } = await supabase.from('users').insert(newUsers);
      if (userError) throw userError;

      setStudents(prev => [...prev, ...newStudents]);
      setUsers(prev => [...prev, ...newUsers]);
      setBulkMessage({ text: `${newStudents.length} students added successfully!`, type: 'success' });
      setTimeout(() => {
        handleStartOver();
      }, 3000);
    } catch (err: any) {
      console.error("Error saving bulk students:", err.message);
      setBulkMessage({ text: `Error: ${err.message}`, type: 'error' });
    }
  };

  const handleStartOver = () => {
    setBulkAddStep('UPLOAD');
    setStudentsToRegister([]);
    setCurrentStudentIndex(0);
    setBulkMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // --- Filtered Students for Display ---
  const filteredStudents = useMemo(() => {
    return students.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Add Students</h2>
      
      <div className="flex space-x-4">
        <button 
          className={`px-4 py-2 rounded ${addMode === 'SINGLE' ? 'bg-blue-600' : 'bg-gray-600'}`}
          onClick={() => setAddMode('SINGLE')}
        >
          Add Single Student
        </button>
        <button 
          className={`px-4 py-2 rounded ${addMode === 'BULK' ? 'bg-blue-600' : 'bg-gray-600'}`}
          onClick={() => setAddMode('BULK')}
        >
          Bulk Add Students
        </button>
      </div>

      {addMode === 'SINGLE' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {message && (
            <div className={`p-2 rounded ${message.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
              {message.text}
            </div>
          )}

          <div>
            <label className="block mb-1">Student ID</label>
            <input 
              type="text" 
              value={id} 
              onChange={e => setId(e.target.value)} 
              className="w-full p-2 rounded bg-gray-800 border border-gray-700"
            />
          </div>
          <div>
            <label className="block mb-1">Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full p-2 rounded bg-gray-800 border border-gray-700"
            />
          </div>
          <div>
            <label className="block mb-1">Course</label>
            <select
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              className="w-full p-2 rounded bg-gray-800 border border-gray-700"
            >
              <option value="">Select Course</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1">Photo</label>
            {photo ? (
              <div>
                <img src={photo} alt="Captured" className="w-32 h-32 object-cover rounded" />
                <button type="button" onClick={handleRetake} className="mt-2 px-3 py-1 bg-yellow-600 rounded">
                  Retake
                </button>
              </div>
            ) : (
              <div>
                {isCameraOn ? (
                  <div>
                    <video ref={videoRef} autoPlay className="w-64 h-48 bg-black rounded" />
                    <canvas ref={canvasRef} className="hidden" />
                    <button type="button" onClick={handleCapture} className="mt-2 px-3 py-1 bg-green-600 rounded">
                      Capture
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={startCamera} className="px-3 py-1 bg-blue-600 rounded">
                    Start Camera
                  </button>
                )}
              </div>
            )}
          </div>

          <button type="submit" className="px-4 py-2 bg-blue-600 rounded">Add Student</button>
        </form>
      )}

      {addMode === 'BULK' && (
        <div>
          {bulkMessage && (
            <div className={`p-2 rounded ${bulkMessage.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
              {bulkMessage.text}
            </div>
          )}
          {bulkAddStep === 'UPLOAD' && (
            <div>
              <input 
                type="file" 
                accept=".csv" 
                ref={fileInputRef}
                onChange={handleFileUpload} 
                className="mb-4"
              />
              <p className="text-sm text-gray-400">CSV format: id,name,courseId</p>
            </div>
          )}
          {bulkAddStep === 'CAPTURE' && (
            <div>
              <h3 className="mb-2">Capture photo for: {studentsToRegister[currentStudentIndex]?.name}</h3>
              <video ref={videoRef} autoPlay className="w-64 h-48 bg-black rounded" />
              <canvas ref={canvasRef} className="hidden" />
              <button onClick={handleCaptureBulk} className="mt-2 px-3 py-1 bg-green-600 rounded">Capture</button>
            </div>
          )}
          {bulkAddStep === 'REVIEW' && (
            <div>
              <h3 className="mb-2">Review Students</h3>
              <ul className="space-y-2">
                {studentsToRegister.map(s => (
                  <li key={s.id} className="flex items-center space-x-2">
                    {s.photo ? <img src={s.photo} alt={s.name} className="w-12 h-12 rounded" /> : <span>No Photo</span>}
                    <span>{s.name} ({s.id})</span>
                  </li>
                ))}
              </ul>
              <button onClick={handleSaveAll} className="mt-4 px-4 py-2 bg-blue-600 rounded">Save All</button>
            </div>
          )}
        </div>
      )}

      <button onClick={() => setPage('ADMIN_DASHBOARD')} className="mt-6 px-4 py-2 bg-gray-600 rounded">
        Back to Dashboard
      </button>
    </div>
  );
};

export default AddStudentPage;
