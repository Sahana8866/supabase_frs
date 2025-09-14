import { useState, useEffect, useRef } from 'react';

interface CameraState {
  stream: MediaStream | null;
  error: string | null;
  isCameraOn: boolean;
  isVideoReady: boolean;
}

export const useCamera = () => {
  const [cameraState, setCameraState] = useState<CameraState>({
    stream: null,
    error: null,
    isCameraOn: false,
    isVideoReady: false,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraState.stream) {
        return;
    }

    const handleCanPlay = () => {
        setCameraState(prev => ({ ...prev, isVideoReady: true }));
    };

    video.addEventListener('canplay', handleCanPlay);

    return () => {
        video.removeEventListener('canplay', handleCanPlay);
    };
  }, [cameraState.stream]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraState({ stream, error: null, isCameraOn: true, isVideoReady: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setCameraState({
        stream: null,
        error: 'Could not start camera. Please grant permission.',
        isCameraOn: false,
        isVideoReady: false,
      });
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (cameraState.stream) {
      cameraState.stream.getTracks().forEach(track => track.stop());
      setCameraState({ stream: null, error: null, isCameraOn: false, isVideoReady: false });
    }
  };

  const capturePhoto = (): string | null => {
    const video = videoRef.current;
    if (video && canvasRef.current && cameraState.isVideoReady && video.videoWidth > 0 && video.videoHeight > 0) {
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        // Flip the image horizontally for a mirror effect
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png');
      }
    }
    return null;
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { videoRef, canvasRef, ...cameraState, startCamera, stopCamera, capturePhoto };
};