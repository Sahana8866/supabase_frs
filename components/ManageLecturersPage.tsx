
import React, { useState, useMemo } from 'react';
import type { Page, User } from '../types';
import { useCamera } from '../hooks/useCamera';

interface ManageLecturersPageProps {
  setPage: (page: Page) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const ManageLecturersPage: React.FC<ManageLecturersPageProps> = ({ 
  setPage, 
  users, 
  setUsers, 
}) => {
  const { videoRef, canvasRef, isCameraOn, error, startCamera, stopCamera, capturePhoto } = useCamera();
  const [searchQuery, setSearchQuery] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

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
    if (!name || !email || !password || !photo) {
      setMessage({ text: 'Please fill all fields and capture a photo.', type: 'error' });
      return;
    }
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        setMessage({ text: 'A user with this email already exists.', type: 'error' });
        return;
    }

    const newLecturer: User = {
      id: `user-${Date.now()}`,
      email,
      password,
      name,
      role: 'LECTURER',
      photo,
    };

    setUsers(prev => [...prev, newLecturer]);
    setMessage({ text: `Lecturer ${name} added successfully!`, type: 'success' });
    
    setName('');
    setEmail('');
    setPassword('');
    setPhoto(null);
    setTimeout(() => setMessage(null), 5000);
  };
  
  const lecturers = useMemo(() => users.filter(u => u.role === 'LECTURER'), [users]);

  const filteredLecturers = useMemo(() => lecturers.filter(lecturer => 
    lecturer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lecturer.email.toLowerCase().includes(searchQuery.toLowerCase())
  ), [lecturers, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-cyan-400">Manage Lecturers</h2>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold mb-4">Camera Feed</h3>
          <div className="aspect-video bg-gray-900 rounded-md overflow-hidden relative">
            {photo ? (
              <img src={photo} alt="Captured lecturer" className="w-full h-full object-cover" />
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
          <h3 className="text-xl font-semibold mb-4">Lecturer Details</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="lecturer-name" className="block text-sm font-medium text-gray-300">Full Name</label>
              <input type="text" id="lecturer-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" required />
            </div>
            <div>
              <label htmlFor="lecturer-email" className="block text-sm font-medium text-gray-300">Email Address</label>
              <input type="email" id="lecturer-email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" required />
            </div>
            <div>
              <label htmlFor="lecturer-password" className="block text-sm font-medium text-gray-300">Password</label>
              <input type="password" id="lecturer-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" required />
            </div>
            {message && (
              <div className={`p-3 rounded-md text-sm ${message.type === 'error' ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
                {message.text}
              </div>
            )}
            <button type="submit" disabled={!photo || !name || !email || !password} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
              Add Lecturer
            </button>
          </form>
        </div>
      </div>

      <div className="mt-12">
        <h3 className="text-2xl font-bold mb-4 text-cyan-400">Registered Lecturers</h3>
        <div className="mb-4">
          <input type="search" placeholder="Search lecturers by name or email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"/>
        </div>
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          {filteredLecturers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-gray-400 uppercase bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3">Photo</th>
                    <th scope="col" className="px-6 py-3">Name</th>
                    <th scope="col" className="px-6 py-3">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLecturers.map(lecturer => (
                    <tr key={lecturer.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-600">
                      <td className="px-6 py-4"><img src={lecturer.photo} alt={lecturer.name} className="w-12 h-12 rounded-full object-cover"/></td>
                      <td className="px-6 py-4 font-medium text-white">{lecturer.name}</td>
                      <td className="px-6 py-4 text-gray-300">{lecturer.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center p-8">
              {searchQuery ? `No lecturers found for "${searchQuery}".` : 'No lecturers have been added yet.'}
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

export default ManageLecturersPage;
