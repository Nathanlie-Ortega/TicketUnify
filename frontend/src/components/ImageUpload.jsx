// src/components/ImageUpload.jsx
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, User } from 'lucide-react';

export default function ImageUpload({ onImageChange, currentImage }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setError('');
    
    if (rejectedFiles.length > 0) {
      setError('Please upload an image file (JPG, PNG) under 5MB');
      return;
    }

    const file = acceptedFiles[0];
    if (file) {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
      onImageChange(file);
    }
  }, [onImageChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: false
  });

  const removeImage = () => {
    setPreview(null);
    onImageChange(null);
    if (preview) {
      URL.revokeObjectURL(preview);
    }
  };

  React.useEffect(() => {
    // Cleanup preview URL on unmount
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Avatar preview"
            className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`w-full p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-800 dark:border-gray-600 hover:border-gray-600 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
          }`}
        >
          <input {...getInputProps()} />
          <div className="text-center">
            <div className="mx-auto mb-3 w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              {isDragActive ? (
                <Upload className="w-6 h-6 text-blue-500" />
              ) : (
                <User className="w-6 h-6 text-gray-400 dark:text-gray-500" />
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
              {isDragActive
                ? 'Drop your image here'
                : 'Drag & drop an image, or click to select'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              PNG, JPG, GIF up to 5MB
            </p>
          </div>
        </div>
      )}
      
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}